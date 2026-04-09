import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

type SourceQbUser = {
  qb_user_id: number;
  email: string | null;
  username: string | null;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  payroll_id: string | null;
  active: boolean;
  group_id: number | null;
  last_active_at: string | null;
  last_modified_at: string | null;
  raw_json: Json;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
};

type SourceQbJobcode = {
  qb_jobcode_id: number;
  parent_qb_jobcode_id: number | null;
  name: string;
  type: string | null;
  active: boolean;
  assigned_to_all: boolean;
  billable: boolean;
  last_modified_at: string | null;
  raw_json: Json;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
};

type SourceQbTimesheet = {
  qb_timesheet_id: number;
  qb_user_id: number;
  qb_jobcode_id: number | null;
  timesheet_date: string;
  start_at: string | null;
  end_at: string | null;
  duration_seconds: number | null;
  state: string | null;
  entry_type: string | null;
  source: string | null;
  notes: string | null;
  customfields_json: Json;
  raw_json: Json;
  last_modified_at: string | null;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
};

type SourceSyncRun = {
  id: string;
  integration_target: "quickbooks_time" | "quickbooks_online";
  sync_type: string;
  started_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "failed" | "partial";
  summary_json: Json;
  error_json: Json;
  created_at: string;
};

type SourceTimeProject = {
  id: string;
  project_code: string;
  name: string;
  customer_name: string | null;
  site_name: string | null;
  site_address: string | null;
  site_latitude: number | null;
  site_longitude: number | null;
  site_radius_meters: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SourceProjectMapping = {
  project_id: string;
  qb_jobcode_id: number;
  mapping_source: string;
  confidence_score: number;
  is_active: boolean;
};

type TargetProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
};

type TargetProject = {
  id: string;
  name: string;
  project_number: string | null;
};

type LegacyProjectPortalMapping = {
  projectId: string;
  matchSource: string;
  confidenceScore: number;
};

const PAGE_SIZE = 1000;

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`);
  }

  dotenv.config({ path: filePath, override: true });
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\d{4}-\d{3,4}\s*-\s*/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseProjectNumber(name: string) {
  const match = name.match(/^\s*(\d{4}-\d{3,4})\s*-\s*(.+)$/);
  return match
    ? {
        projectNumber: match[1],
        title: match[2].trim(),
      }
    : {
        projectNumber: null,
        title: name.trim(),
      };
}

function sourceTimeEnvPath() {
  return path.resolve(process.cwd(), "..", "tcc-time", ".env.local");
}

function targetHubEnvPath() {
  return path.resolve(process.cwd(), ".env.local");
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function createAdmin(url: string, key: string) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function fetchAll<T>(client: SupabaseClient, table: string, select: string): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await client.from(table).select(select).range(from, to);
    if (error) throw new Error(`${table}: ${error.message}`);

    const page = (data ?? []) as T[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return rows;
    }

    from += PAGE_SIZE;
  }
}

async function fetchSourceProjectMappings(client: SupabaseClient) {
  const { data, error } = await client
    .from("project_qb_time_mappings")
    .select("project_id, qb_jobcode_id, mapping_source, confidence_score, is_active");

  if (error) throw new Error(`project_qb_time_mappings: ${error.message}`);
  return (data ?? []) as SourceProjectMapping[];
}

async function upsertChunked<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  rows: T[],
  onConflict?: string
) {
  if (!rows.length) return;

  for (let index = 0; index < rows.length; index += PAGE_SIZE) {
    const chunk = rows.slice(index, index + PAGE_SIZE);
    const query = client.from(table).upsert(chunk, onConflict ? { onConflict } : undefined);
    const { error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function updateProjectNumbers(target: SupabaseClient, projects: TargetProject[]) {
  for (const project of projects) {
    if (project.project_number) continue;

    const parsed = parseProjectNumber(project.name);
    if (!parsed.projectNumber) continue;

    const { error } = await target
      .from("projects")
      .update({ project_number: parsed.projectNumber })
      .eq("id", project.id);

    if (error) {
      throw new Error(`projects(project_number): ${error.message}`);
    }
  }
}

async function main() {
  loadEnvFile(targetHubEnvPath());
  const targetUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const targetKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  loadEnvFile(sourceTimeEnvPath());
  const sourceUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const sourceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const target = createAdmin(targetUrl, targetKey);
  const source = createAdmin(sourceUrl, sourceKey);

  const [
    sourceUsers,
    sourceJobcodes,
    sourceTimesheets,
    sourceSyncRuns,
    sourceProjects,
    sourceProjectMappings,
    targetProfiles,
    targetProjects,
  ] = await Promise.all([
    fetchAll<SourceQbUser>(
      source,
      "qb_time_users",
      "qb_user_id,email,username,display_name,first_name,last_name,payroll_id,active,group_id,last_active_at,last_modified_at,raw_json,last_synced_at,created_at,updated_at"
    ),
    fetchAll<SourceQbJobcode>(
      source,
      "qb_time_jobcodes",
      "qb_jobcode_id,parent_qb_jobcode_id,name,type,active,assigned_to_all,billable,last_modified_at,raw_json,last_synced_at,created_at,updated_at"
    ),
    fetchAll<SourceQbTimesheet>(
      source,
      "qb_time_timesheets",
      "qb_timesheet_id,qb_user_id,qb_jobcode_id,timesheet_date,start_at,end_at,duration_seconds,state,entry_type,source,notes,customfields_json,raw_json,last_modified_at,last_synced_at,created_at,updated_at"
    ),
    fetchAll<SourceSyncRun>(
      source,
      "integration_sync_runs",
      "id,integration_target,sync_type,started_at,completed_at,status,summary_json,error_json,created_at"
    ),
    fetchAll<SourceTimeProject>(
      source,
      "projects",
      "id,project_code,name,customer_name,site_name,site_address,site_latitude,site_longitude,site_radius_meters,is_active,created_at,updated_at"
    ),
    fetchSourceProjectMappings(source),
    fetchAll<TargetProfile>(target, "profiles", "id,email,full_name,role"),
    fetchAll<TargetProject>(target, "projects", "id,name,project_number"),
  ]);

  await updateProjectNumbers(target, targetProjects);

  const refreshedTargetProjects = await fetchAll<TargetProject>(target, "projects", "id,name,project_number");

  const profileByEmail = new Map(
    targetProfiles
      .map((profile) => ({ ...profile, email: normalizeEmail(profile.email) }))
      .filter((profile) => profile.email)
      .map((profile) => [profile.email, profile])
  );

  const hubProjectByNumber = new Map(
    refreshedTargetProjects
      .filter((project) => project.project_number)
      .map((project) => [project.project_number!.trim().toLowerCase(), project])
  );

  const hubProjectByNormalizedName = new Map(
    refreshedTargetProjects.map((project) => {
      const parsed = parseProjectNumber(project.name);
      return [normalizeName(parsed.title), project] as const;
    })
  );

  const qbUserByEmail = new Map(
    sourceUsers
      .map((user) => ({ ...user, email: normalizeEmail(user.email) }))
      .filter((user) => user.email)
      .map((user) => [user.email, user])
  );

  const availableQbUserIds = new Set(sourceUsers.map((user) => user.qb_user_id));
  const availableQbJobcodeIds = new Set(sourceJobcodes.map((jobcode) => jobcode.qb_jobcode_id));

  const sanitizedTimesheets = sourceTimesheets
    .filter((timesheet) => availableQbUserIds.has(timesheet.qb_user_id))
    .map((timesheet) => ({
      ...timesheet,
      qb_jobcode_id:
        timesheet.qb_jobcode_id && availableQbJobcodeIds.has(timesheet.qb_jobcode_id)
          ? timesheet.qb_jobcode_id
          : null,
    }));

  const legacyProjectRows = sourceProjects.map((project) => ({
    legacy_time_project_id: project.id,
    project_code: project.project_code,
    name: project.name,
    customer_name: project.customer_name,
    site_name: project.site_name,
    site_address: project.site_address,
    site_latitude: project.site_latitude,
    site_longitude: project.site_longitude,
    site_radius_meters: project.site_radius_meters,
    is_active: project.is_active,
    source_created_at: project.created_at,
    source_updated_at: project.updated_at,
  }));

  const profileMappings = sourceUsers.flatMap((user) => {
    const email = normalizeEmail(user.email);
    const profile = profileByEmail.get(email);
    if (!profile) return [];

    return [
      {
        profile_id: profile.id,
        qb_user_id: user.qb_user_id,
        match_source: "email",
        confidence_score: 100,
        is_active: true,
      },
    ];
  });

  const legacyProjectPortalMappings = new Map<string, LegacyProjectPortalMapping>();

  for (const project of sourceProjects) {
    const projectCode = project.project_code?.trim().toLowerCase() ?? "";
    const byCode = projectCode ? hubProjectByNumber.get(projectCode) : null;
    const byName = hubProjectByNormalizedName.get(normalizeName(project.name)) ?? null;
    const match = byCode ?? byName;

    if (!match) continue;

    legacyProjectPortalMappings.set(project.id, {
      projectId: match.id,
      matchSource: byCode ? "project_code_to_project_number" : "normalized_name",
      confidenceScore: byCode ? 100 : 85,
    });
  }

  const legacyProjectPortalMappingRows = Array.from(legacyProjectPortalMappings.entries()).map(
    ([legacyProjectId, match]) => ({
      legacy_time_project_id: legacyProjectId,
      project_id: match.projectId,
      match_source: match.matchSource,
      confidence_score: match.confidenceScore,
      is_active: true,
    })
  );

  const legacyProjectById = new Map(sourceProjects.map((project) => [project.id, project]));
  const directJobcodeToPortalProject = new Map<string, { projectId: string; source: string; confidence: number }>();

  for (const jobcode of sourceJobcodes) {
    const directHubMatch = hubProjectByNormalizedName.get(normalizeName(jobcode.name));
    if (directHubMatch) {
      directJobcodeToPortalProject.set(String(jobcode.qb_jobcode_id), {
        projectId: directHubMatch.id,
        source: "jobcode_name_to_project_name",
        confidence: 85,
      });
    }
  }

  for (const mapping of sourceProjectMappings) {
    const portalMatch = legacyProjectPortalMappings.get(mapping.project_id);
    if (!portalMatch) continue;

    directJobcodeToPortalProject.set(String(mapping.qb_jobcode_id), {
      projectId: portalMatch.projectId,
      source: `legacy_${mapping.mapping_source}`,
      confidence: mapping.confidence_score,
    });
  }

  for (const project of sourceProjects) {
    const portalMatch = legacyProjectPortalMappings.get(project.id);
    if (!portalMatch) continue;

    const matchingJobcode = sourceJobcodes.find(
      (jobcode) => normalizeName(jobcode.name) === normalizeName(project.name)
    );

    if (!matchingJobcode) continue;

    directJobcodeToPortalProject.set(String(matchingJobcode.qb_jobcode_id), {
      projectId: portalMatch.projectId,
      source: "legacy_project_name_to_jobcode_name",
      confidence: 90,
    });
  }

  const projectMappings = Array.from(directJobcodeToPortalProject.entries()).map(([qbJobcodeId, match]) => ({
    project_id: match.projectId,
    qb_jobcode_id: Number(qbJobcodeId),
    mapping_source: match.source,
    confidence_score: match.confidence,
    is_active: true,
  }));

  await upsertChunked(target, "qb_time_users", sourceUsers, "qb_user_id");
  await upsertChunked(target, "qb_time_jobcodes", sourceJobcodes, "qb_jobcode_id");
  await upsertChunked(target, "qb_time_timesheets", sanitizedTimesheets, "qb_timesheet_id");
  await upsertChunked(target, "integration_sync_runs", sourceSyncRuns, "id");
  await upsertChunked(target, "legacy_time_projects", legacyProjectRows, "legacy_time_project_id");
  await upsertChunked(target, "profile_qb_time_mappings", profileMappings, "profile_id,qb_user_id");
  await upsertChunked(
    target,
    "legacy_time_project_portal_mappings",
    legacyProjectPortalMappingRows,
    "legacy_time_project_id,project_id"
  );
  await upsertChunked(target, "project_qb_time_mappings", projectMappings, "project_id,qb_jobcode_id");

  const unmatchedUsers = sourceUsers.filter((user) => !profileByEmail.has(normalizeEmail(user.email)));
  const unmatchedLegacyProjects = sourceProjects.filter((project) => !legacyProjectPortalMappings.has(project.id));
  const unmatchedJobcodes = sourceJobcodes.filter(
    (jobcode) => !directJobcodeToPortalProject.has(String(jobcode.qb_jobcode_id))
  );

  console.log(
    JSON.stringify(
      {
        counts: {
          source_qb_users: sourceUsers.length,
          source_qb_jobcodes: sourceJobcodes.length,
          source_qb_timesheets: sourceTimesheets.length,
          source_qb_timesheets_after_sanitizing: sanitizedTimesheets.length,
          source_projects: sourceProjects.length,
          target_profiles: targetProfiles.length,
          target_projects: refreshedTargetProjects.length,
          profile_mappings_created: profileMappings.length,
          legacy_project_portal_mappings_created: legacyProjectPortalMappingRows.length,
          project_qb_mappings_created: projectMappings.length,
        },
        unmatched: {
          users: unmatchedUsers.slice(0, 20).map((user) => ({
            email: user.email,
            display_name: user.display_name,
          })),
          legacy_projects: unmatchedLegacyProjects.slice(0, 20).map((project) => ({
            project_code: project.project_code,
            name: project.name,
          })),
          qb_jobcodes: unmatchedJobcodes.slice(0, 20).map((jobcode) => ({
            qb_jobcode_id: jobcode.qb_jobcode_id,
            name: jobcode.name,
          })),
          skipped_timesheets_missing_user: sourceTimesheets
            .filter((timesheet) => !availableQbUserIds.has(timesheet.qb_user_id))
            .slice(0, 20)
            .map((timesheet) => ({
              qb_timesheet_id: timesheet.qb_timesheet_id,
              qb_user_id: timesheet.qb_user_id,
            })),
        },
        examples: {
          matched_user_emails: profileMappings.slice(0, 10).map((mapping) => {
            const profile = targetProfiles.find((item) => item.id === mapping.profile_id);
            const user = qbUserByEmail.get(normalizeEmail(profile?.email));
            return {
              email: profile?.email ?? "",
              profile_id: mapping.profile_id,
              qb_user_id: user?.qb_user_id ?? mapping.qb_user_id,
            };
          }),
          matched_projects: projectMappings.slice(0, 10).map((mapping) => {
            const portalProject = refreshedTargetProjects.find((project) => project.id === mapping.project_id);
            const legacyProject = sourceProjectMappings.find((item) => item.qb_jobcode_id === mapping.qb_jobcode_id);
            return {
              qb_jobcode_id: mapping.qb_jobcode_id,
              project_name: portalProject?.name ?? "",
              project_number: portalProject?.project_number ?? null,
              via_legacy_project_id: legacyProject?.project_id ?? null,
              mapping_source: mapping.mapping_source,
            };
          }),
          legacy_project_lookup: legacyProjectRows.slice(0, 10).map((project) => ({
            legacy_time_project_id: project.legacy_time_project_id,
            project_code: project.project_code,
            name: project.name,
            mapped_project_id:
              legacyProjectPortalMappings.get(project.legacy_time_project_id)?.projectId ?? null,
          })),
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

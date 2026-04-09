import { createClient } from "@supabase/supabase-js";
import type { UserRole } from "@/types/database";

export interface TimeModuleRunSummary {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
}

export interface TimeModuleUser {
  qbUserId: number;
  displayName: string;
  email: string;
  username: string;
  payrollId: string;
  active: boolean;
  groupId: number | null;
  lastActiveAt: string | null;
  lastSyncedAt: string;
  matchedEmployee: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface TimeModuleProject {
  qbJobcodeId: number;
  parentQbJobcodeId: number | null;
  name: string;
  type: string | null;
  active: boolean;
  assignedToAll: boolean;
  billable: boolean;
  lastModifiedAt: string | null;
  lastSyncedAt: string;
  mappedProject: {
    id: string;
    projectCode: string;
    name: string;
  } | null;
}

export interface TimeModuleSnapshot {
  users: TimeModuleUser[];
  projects: TimeModuleProject[];
  latestRun: TimeModuleRunSummary | null;
}

export interface TimeReconcileCandidate {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  score: number;
  reasons: string[];
}

export interface TimeReconcileUser {
  qbUserId: number;
  displayName: string;
  email: string;
  username: string;
  payrollId: string;
  active: boolean;
  suggestions: TimeReconcileCandidate[];
}

export interface TimeReconcileSnapshot {
  users: TimeReconcileUser[];
  ignoredCount: number;
  mappedCount: number;
}

type QbUserRow = {
  qb_user_id: number;
  display_name: string;
  email: string | null;
  username: string | null;
  payroll_id: string | null;
  active: boolean;
  group_id: number | null;
  last_active_at: string | null;
  last_synced_at: string;
};

type QbJobcodeRow = {
  qb_jobcode_id: number;
  parent_qb_jobcode_id: number | null;
  name: string;
  type: string | null;
  active: boolean;
  assigned_to_all: boolean;
  billable: boolean;
  last_modified_at: string | null;
  last_synced_at: string;
};

type PortalProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
};

type PortalReviewStateRow = {
  qb_user_id: number;
  status: "ignored";
};

type PortalProfileMappingRow = {
  qb_user_id: number;
  profile:
    | {
        id?: string;
        full_name?: string;
        email?: string;
      }
    | null
    | undefined;
};

function createPortalTimeClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function createBridgeTimeClient() {
  const url = process.env.TCC_TIME_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.TCC_TIME_SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function normalizeValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeName(value: string | null | undefined) {
  return normalizeValue(value).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function splitNameParts(value: string | null | undefined) {
  return normalizeName(value).split(" ").filter(Boolean);
}

function buildCandidate(user: QbUserRow, profile: PortalProfileRow): TimeReconcileCandidate | null {
  const reasons: string[] = [];
  let score = 0;

  const userEmail = normalizeValue(user.email);
  const profileEmail = normalizeValue(profile.email);
  const userName = normalizeName(user.display_name);
  const profileName = normalizeName(profile.full_name);
  const userEmailLocal = userEmail.split("@")[0] ?? "";
  const profileEmailLocal = profileEmail.split("@")[0] ?? "";

  if (userEmail && profileEmail && userEmail === profileEmail) {
    score += 100;
    reasons.push("Exact email match");
  }

  if (userName && profileName && userName === profileName) {
    score += 85;
    reasons.push("Exact full-name match");
  }

  if (userEmailLocal && profileEmailLocal && userEmailLocal === profileEmailLocal) {
    score += 45;
    reasons.push("Email local-part match");
  }

  const userParts = splitNameParts(user.display_name);
  const profileParts = splitNameParts(profile.full_name);
  const overlappingParts = userParts.filter((part) => profileParts.includes(part));

  if (overlappingParts.length >= 2) {
    score += 40;
    reasons.push("First and last name overlap");
  } else if (overlappingParts.length === 1) {
    score += 18;
    reasons.push(`Name overlap: ${overlappingParts[0]}`);
  }

  if (!score) {
    return null;
  }

  return {
    id: profile.id,
    fullName: profile.full_name ?? "Unnamed profile",
    email: profile.email,
    role: profile.role,
    score,
    reasons
  };
}

async function loadPortalSnapshot() {
  const supabase = createPortalTimeClient();

  const [usersResult, userMappingsResult, jobcodesResult, projectMappingsResult, latestRunResult] =
    await Promise.all([
      supabase.from("qb_time_users").select("*").order("display_name"),
      supabase
        .from("profile_qb_time_mappings")
        .select("qb_user_id, profile:profiles(id, full_name, email)"),
      supabase.from("qb_time_jobcodes").select("*").order("name"),
      supabase
        .from("project_qb_time_mappings")
        .select("qb_jobcode_id, project:projects(id, project_number, name)"),
      supabase
        .from("integration_sync_runs")
        .select("id, status, started_at, completed_at")
        .eq("integration_target", "quickbooks_time")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

  if (usersResult.error) throw usersResult.error;
  if (userMappingsResult.error) throw userMappingsResult.error;
  if (jobcodesResult.error) throw jobcodesResult.error;
  if (projectMappingsResult.error) throw projectMappingsResult.error;
  if (latestRunResult.error) throw latestRunResult.error;

  const userMappingById = new Map(
    (userMappingsResult.data ?? []).map((mapping) => [mapping.qb_user_id, mapping.profile])
  );

  const projectMappingById = new Map(
    (projectMappingsResult.data ?? []).map((mapping) => [mapping.qb_jobcode_id, mapping.project])
  );

  const users = ((usersResult.data ?? []) as QbUserRow[]).map((user) => {
    const mappedProfile = userMappingById.get(user.qb_user_id) as
      | { id?: string; full_name?: string; email?: string }
      | null
      | undefined;

    return {
      qbUserId: user.qb_user_id,
      displayName: user.display_name,
      email: user.email ?? "",
      username: user.username ?? "",
      payrollId: user.payroll_id ?? "",
      active: user.active,
      groupId: user.group_id,
      lastActiveAt: user.last_active_at,
      lastSyncedAt: user.last_synced_at,
      matchedEmployee:
        mappedProfile?.id && mappedProfile.full_name
          ? {
              id: mappedProfile.id,
              fullName: mappedProfile.full_name,
              email: mappedProfile.email ?? ""
            }
          : null
    } satisfies TimeModuleUser;
  });

  const projects = ((jobcodesResult.data ?? []) as QbJobcodeRow[]).map((jobcode) => {
    const mappedProject = projectMappingById.get(jobcode.qb_jobcode_id) as
      | { id?: string; project_number?: string | null; name?: string }
      | null
      | undefined;

    return {
      qbJobcodeId: jobcode.qb_jobcode_id,
      parentQbJobcodeId: jobcode.parent_qb_jobcode_id,
      name: jobcode.name,
      type: jobcode.type,
      active: jobcode.active,
      assignedToAll: jobcode.assigned_to_all,
      billable: jobcode.billable,
      lastModifiedAt: jobcode.last_modified_at,
      lastSyncedAt: jobcode.last_synced_at,
      mappedProject:
        mappedProject?.id && mappedProject.name
          ? {
              id: mappedProject.id,
              projectCode: mappedProject.project_number ?? "Unnumbered",
              name: mappedProject.name
            }
          : null
    } satisfies TimeModuleProject;
  });

  return {
    users,
    projects,
    latestRun: latestRunResult.data
      ? {
          id: latestRunResult.data.id,
          status: latestRunResult.data.status,
          startedAt: latestRunResult.data.started_at,
          completedAt: latestRunResult.data.completed_at
        }
      : null
  } satisfies TimeModuleSnapshot;
}

async function loadBridgeSnapshot() {
  const supabase = createBridgeTimeClient();

  if (!supabase) {
    throw new Error(
      "Merged time tables are not available in ProjectHub yet, and the legacy TCC Time bridge is not configured."
    );
  }

  const [usersResult, userMappingsResult, jobcodesResult, projectMappingsResult, latestRunResult] =
    await Promise.all([
      supabase.from("qb_time_users").select("*").order("display_name"),
      supabase
        .from("employee_qb_time_mappings")
        .select("qb_user_id, employee:employees(id, profile:profiles(full_name, email))"),
      supabase.from("qb_time_jobcodes").select("*").order("name"),
      supabase
        .from("project_qb_time_mappings")
        .select("qb_jobcode_id, project:projects(id, project_code, name)"),
      supabase
        .from("integration_sync_runs")
        .select("id, status, started_at, completed_at")
        .eq("integration_target", "quickbooks_time")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

  if (usersResult.error) throw usersResult.error;
  if (userMappingsResult.error) throw userMappingsResult.error;
  if (jobcodesResult.error) throw jobcodesResult.error;
  if (projectMappingsResult.error) throw projectMappingsResult.error;
  if (latestRunResult.error) throw latestRunResult.error;

  const userMappingById = new Map(
    (userMappingsResult.data ?? []).map((mapping) => [mapping.qb_user_id, mapping.employee])
  );

  const projectMappingById = new Map(
    (projectMappingsResult.data ?? []).map((mapping) => [mapping.qb_jobcode_id, mapping.project])
  );

  const users = ((usersResult.data ?? []) as QbUserRow[]).map((user) => {
    const mappedEmployee = userMappingById.get(user.qb_user_id) as
      | { id?: string; profile?: { full_name?: string; email?: string } | null }
      | null
      | undefined;

    return {
      qbUserId: user.qb_user_id,
      displayName: user.display_name,
      email: user.email ?? "",
      username: user.username ?? "",
      payrollId: user.payroll_id ?? "",
      active: user.active,
      groupId: user.group_id,
      lastActiveAt: user.last_active_at,
      lastSyncedAt: user.last_synced_at,
      matchedEmployee:
        mappedEmployee?.id && mappedEmployee.profile?.full_name
          ? {
              id: mappedEmployee.id,
              fullName: mappedEmployee.profile.full_name,
              email: mappedEmployee.profile.email ?? ""
            }
          : null
    } satisfies TimeModuleUser;
  });

  const projects = ((jobcodesResult.data ?? []) as QbJobcodeRow[]).map((jobcode) => {
    const mappedProject = projectMappingById.get(jobcode.qb_jobcode_id) as
      | { id?: string; project_code?: string; name?: string }
      | null
      | undefined;

    return {
      qbJobcodeId: jobcode.qb_jobcode_id,
      parentQbJobcodeId: jobcode.parent_qb_jobcode_id,
      name: jobcode.name,
      type: jobcode.type,
      active: jobcode.active,
      assignedToAll: jobcode.assigned_to_all,
      billable: jobcode.billable,
      lastModifiedAt: jobcode.last_modified_at,
      lastSyncedAt: jobcode.last_synced_at,
      mappedProject:
        mappedProject?.id && mappedProject.project_code && mappedProject.name
          ? {
              id: mappedProject.id,
              projectCode: mappedProject.project_code,
              name: mappedProject.name
            }
          : null
    } satisfies TimeModuleProject;
  });

  return {
    users,
    projects,
    latestRun: latestRunResult.data
      ? {
          id: latestRunResult.data.id,
          status: latestRunResult.data.status,
          startedAt: latestRunResult.data.started_at,
          completedAt: latestRunResult.data.completed_at
        }
      : null
  } satisfies TimeModuleSnapshot;
}

async function loadPortalReconcileSnapshot() {
  const supabase = createPortalTimeClient();

  const [usersResult, mappingsResult, profilesResult, reviewStatesResult] = await Promise.all([
    supabase.from("qb_time_users").select("qb_user_id, display_name, email, username, payroll_id, active").order("display_name"),
    supabase.from("profile_qb_time_mappings").select("qb_user_id, profile_id, profile:profiles(id, full_name, email)").eq("is_active", true),
    supabase.from("profiles").select("id, full_name, email, role").order("full_name"),
    supabase.from("qb_time_user_review_states").select("qb_user_id, status")
  ]);

  if (usersResult.error) throw usersResult.error;
  if (mappingsResult.error) throw mappingsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (reviewStatesResult.error) throw reviewStatesResult.error;

  const activeMappings = (mappingsResult.data ?? []) as Array<{
    qb_user_id: number;
    profile_id: string;
    profile?: { id?: string; full_name?: string; email?: string } | null;
  }>;
  const mappedQbUserIds = new Set(activeMappings.map((mapping) => mapping.qb_user_id));
  const mappedProfileIds = new Set(activeMappings.map((mapping) => mapping.profile_id));
  const ignoredQbUserIds = new Set(
    ((reviewStatesResult.data ?? []) as PortalReviewStateRow[])
      .filter((state) => state.status === "ignored")
      .map((state) => state.qb_user_id)
  );

  const eligibleProfiles = ((profilesResult.data ?? []) as PortalProfileRow[]).filter(
    (profile) => !mappedProfileIds.has(profile.id)
  );

  const users = ((usersResult.data ?? []) as Array<
    Pick<QbUserRow, "qb_user_id" | "display_name" | "email" | "username" | "payroll_id" | "active">
  >)
    .filter((user) => !mappedQbUserIds.has(user.qb_user_id) && !ignoredQbUserIds.has(user.qb_user_id))
    .map((user) => ({
      qbUserId: user.qb_user_id,
      displayName: user.display_name,
      email: user.email ?? "",
      username: user.username ?? "",
      payrollId: user.payroll_id ?? "",
      active: user.active,
      suggestions: eligibleProfiles
        .map((profile) =>
          buildCandidate(
            {
              qb_user_id: user.qb_user_id,
              display_name: user.display_name,
              email: user.email,
              username: user.username,
              payroll_id: user.payroll_id,
              active: user.active,
              group_id: null,
              last_active_at: null,
              last_synced_at: ""
            },
            profile
          )
        )
        .filter((candidate): candidate is TimeReconcileCandidate => Boolean(candidate))
        .sort((a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName))
        .slice(0, 5)
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return {
    users,
    ignoredCount: ignoredQbUserIds.size,
    mappedCount: mappedQbUserIds.size
  } satisfies TimeReconcileSnapshot;
}

export async function getTimeModuleSnapshot(): Promise<TimeModuleSnapshot> {
  try {
    return await loadPortalSnapshot();
  } catch (error) {
    const bridge = createBridgeTimeClient();
    if (!bridge) {
      throw error;
    }
    return loadBridgeSnapshot();
  }
}

export async function getTimeReconcileSnapshot(): Promise<TimeReconcileSnapshot> {
  return loadPortalReconcileSnapshot();
}

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
  phone: string | null;
  profileId: string | null;
  profileRole: UserRole | null;
  hasPortalAccount: boolean;
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

export interface TimeReconcileProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  profileId: string | null;
  role: UserRole | null;
}

export interface TimeReconcileSnapshot {
  users: TimeReconcileUser[];
  eligibleProfiles: TimeReconcileProfile[];
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

type PortalReviewStateRow = {
  qb_user_id: number;
  status: "ignored";
};

type PortalJobcodeReviewStateRow = {
  qb_jobcode_id: number;
  status: "ignored";
};

type PortalProjectRow = {
  id: string;
  name: string;
  project_number: string | null;
  is_active: boolean;
  customers: { name: string } | { name: string }[] | null;
};

type PmdCandidateRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  profile_id: string | null;
  profile: { id?: string; role?: string } | { id?: string; role?: string }[] | null;
};

export interface ProjectReconcileCandidate {
  id: string;
  name: string;
  projectNumber: string | null;
  customerName: string | null;
  isActive: boolean;
  score: number;
  reasons: string[];
}

export interface ProjectReconcileJobcode {
  qbJobcodeId: number;
  name: string;
  type: string | null;
  active: boolean;
  billable: boolean;
  suggestions: ProjectReconcileCandidate[];
}

export interface ProjectReconcileSnapshot {
  jobcodes: ProjectReconcileJobcode[];
  ignoredCount: number;
  mappedCount: number;
}

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

function buildPmdCandidate(
  user: Pick<QbUserRow, "qb_user_id" | "display_name" | "email">,
  pmd: { id: string; fullName: string; email: string; phone: string | null; profileId: string | null; profileRole: UserRole | null }
): TimeReconcileCandidate | null {
  const reasons: string[] = [];
  let score = 0;

  const userEmail = normalizeValue(user.email);
  const pmdEmail = normalizeValue(pmd.email);
  const userEmailLocal = userEmail.split("@")[0] ?? "";
  const pmdEmailLocal = pmdEmail.split("@")[0] ?? "";

  if (userEmail && pmdEmail && userEmail === pmdEmail) {
    score += 100;
    reasons.push("Exact email match");
  }

  if (normalizeName(user.display_name) === normalizeName(pmd.fullName)) {
    score += 85;
    reasons.push("Exact name match");
  }

  if (userEmailLocal && pmdEmailLocal && userEmailLocal === pmdEmailLocal) {
    score += 45;
    reasons.push("Email local-part match");
  }

  const userParts = splitNameParts(user.display_name);
  const pmdParts = splitNameParts(pmd.fullName);
  const overlap = userParts.filter((p) => pmdParts.includes(p));

  if (overlap.length >= 2) {
    score += 40;
    reasons.push("First and last name overlap");
  } else if (overlap.length === 1) {
    score += 18;
    reasons.push(`Name overlap: ${overlap[0]}`);
  }

  if (!score) return null;

  return {
    id: pmd.id,
    fullName: pmd.fullName,
    email: pmd.email,
    phone: pmd.phone,
    profileId: pmd.profileId,
    profileRole: pmd.profileRole,
    hasPortalAccount: Boolean(pmd.profileId),
    score,
    reasons,
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

  const [qbUsersResult, mappingsResult, pmdResult, reviewStatesResult] = await Promise.all([
    supabase
      .from("qb_time_users")
      .select("qb_user_id, display_name, email, username, payroll_id, active")
      .order("display_name"),
    supabase
      .from("profile_qb_time_mappings")
      .select("qb_user_id, profile_id")
      .eq("is_active", true),
    supabase
      .from("pm_directory")
      .select("id, first_name, last_name, email, phone, profile_id, profile:profiles(id, role)")
      .order("last_name")
      .order("first_name"),
    supabase
      .from("qb_time_user_review_states")
      .select("qb_user_id, status"),
  ]);

  if (qbUsersResult.error) throw qbUsersResult.error;
  if (mappingsResult.error) throw mappingsResult.error;
  if (pmdResult.error) throw pmdResult.error;
  if (reviewStatesResult.error) throw reviewStatesResult.error;

  const mappedQbUserIds = new Set(
    (mappingsResult.data ?? []).map((m: { qb_user_id: number }) => m.qb_user_id)
  );
  const mappedProfileIds = new Set(
    (mappingsResult.data ?? [])
      .map((m: { profile_id: string }) => m.profile_id)
      .filter(Boolean)
  );
  const ignoredQbUserIds = new Set(
    ((reviewStatesResult.data ?? []) as PortalReviewStateRow[])
      .filter((s) => s.status === "ignored")
      .map((s) => s.qb_user_id)
  );

  const allPmd = ((pmdResult.data ?? []) as PmdCandidateRow[]).map((entry) => {
    const profile = Array.isArray(entry.profile) ? entry.profile[0] : entry.profile;
    const profileId = profile?.id ?? entry.profile_id ?? null;
    return {
      id: entry.id,
      fullName:
        [entry.first_name, entry.last_name].filter(Boolean).join(" ").trim() ||
        entry.email ||
        "Unnamed",
      email: entry.email ?? "",
      phone: entry.phone ?? null,
      profileId,
      profileRole: (profile?.role ?? null) as UserRole | null,
    };
  });

  const eligiblePmd = allPmd.filter(
    (p) => !p.profileId || !mappedProfileIds.has(p.profileId)
  );

  const users = (
    (qbUsersResult.data ?? []) as Array<
      Pick<QbUserRow, "qb_user_id" | "display_name" | "email" | "username" | "payroll_id" | "active">
    >
  )
    .filter(
      (u) =>
        !mappedQbUserIds.has(u.qb_user_id) &&
        !ignoredQbUserIds.has(u.qb_user_id)
    )
    .map((user) => ({
      qbUserId: user.qb_user_id,
      displayName: user.display_name,
      email: user.email ?? "",
      username: user.username ?? "",
      payrollId: user.payroll_id ?? "",
      active: user.active,
      suggestions: eligiblePmd
        .map((pmd) => buildPmdCandidate(user, pmd))
        .filter((c): c is TimeReconcileCandidate => Boolean(c))
        .sort((a, b) => b.score - a.score || a.fullName.localeCompare(b.fullName))
        .slice(0, 5),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return {
    users,
    eligibleProfiles: eligiblePmd.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      email: p.email,
      phone: p.phone,
      profileId: p.profileId,
      role: p.profileRole,
    })),
    ignoredCount: ignoredQbUserIds.size,
    mappedCount: mappedQbUserIds.size,
  } satisfies TimeReconcileSnapshot;
}

function buildProjectCandidate(
  jobcode: Pick<QbJobcodeRow, "qb_jobcode_id" | "name">,
  project: PortalProjectRow
): ProjectReconcileCandidate | null {
  const reasons: string[] = [];
  let score = 0;

  const jobcodeName = normalizeName(jobcode.name);
  const projectName = normalizeName(project.name);
  const projectNumber = normalizeValue(project.project_number);

  if (jobcodeName && projectName && jobcodeName === projectName) {
    score += 100;
    reasons.push("Exact name match");
  }

  if (projectNumber && jobcode.name.toLowerCase().includes(projectNumber)) {
    score += 80;
    reasons.push(`Project number match (${project.project_number})`);
  }

  const jobcodeParts = splitNameParts(jobcode.name);
  const projectParts = splitNameParts(project.name);
  const overlapping = jobcodeParts.filter((part) => part.length > 2 && projectParts.includes(part));

  if (!score && overlapping.length >= 3) {
    score += 70;
    reasons.push(`Strong word overlap: ${overlapping.slice(0, 3).join(", ")}`);
  } else if (!score && overlapping.length === 2) {
    score += 40;
    reasons.push(`Word overlap: ${overlapping.join(", ")}`);
  } else if (!score && overlapping.length === 1) {
    score += 15;
    reasons.push(`Partial match: ${overlapping[0]}`);
  }

  if (!score) return null;

  const customerName = Array.isArray(project.customers)
    ? (project.customers[0]?.name ?? null)
    : (project.customers?.name ?? null);

  return {
    id: project.id,
    name: project.name,
    projectNumber: project.project_number,
    customerName,
    isActive: project.is_active,
    score,
    reasons
  };
}

async function loadPortalProjectReconcileSnapshot() {
  const supabase = createPortalTimeClient();

  const [jobcodesResult, mappingsResult, projectsResult, reviewStatesResult] = await Promise.all([
    supabase
      .from("qb_time_jobcodes")
      .select("qb_jobcode_id, parent_qb_jobcode_id, name, type, active, billable")
      .order("name"),
    supabase
      .from("project_qb_time_mappings")
      .select("qb_jobcode_id, project_id")
      .eq("is_active", true),
    supabase
      .from("projects")
      .select("id, name, project_number, is_active, customers(name)")
      .eq("is_active", true)
      .order("name"),
    supabase.from("qb_time_jobcode_review_states").select("qb_jobcode_id, status")
  ]);

  if (jobcodesResult.error) throw jobcodesResult.error;
  if (mappingsResult.error) throw mappingsResult.error;
  if (projectsResult.error) throw projectsResult.error;
  if (reviewStatesResult.error) throw reviewStatesResult.error;

  const mappedJobcodeIds = new Set(
    (mappingsResult.data ?? []).map((m: { qb_jobcode_id: number }) => m.qb_jobcode_id)
  );
  const ignoredJobcodeIds = new Set(
    ((reviewStatesResult.data ?? []) as PortalJobcodeReviewStateRow[])
      .filter((s) => s.status === "ignored")
      .map((s) => s.qb_jobcode_id)
  );

  const projects = (projectsResult.data ?? []) as PortalProjectRow[];

  const jobcodes = ((jobcodesResult.data ?? []) as Array<
    Pick<QbJobcodeRow, "qb_jobcode_id" | "parent_qb_jobcode_id" | "name" | "type" | "active" | "billable">
  >)
    .filter((j) => !mappedJobcodeIds.has(j.qb_jobcode_id) && !ignoredJobcodeIds.has(j.qb_jobcode_id))
    .map((jobcode) => ({
      qbJobcodeId: jobcode.qb_jobcode_id,
      name: jobcode.name,
      type: jobcode.type,
      active: jobcode.active,
      billable: jobcode.billable,
      suggestions: projects
        .map((project) => buildProjectCandidate(jobcode, project))
        .filter((c): c is ProjectReconcileCandidate => Boolean(c))
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, 5)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    jobcodes,
    ignoredCount: ignoredJobcodeIds.size,
    mappedCount: mappedJobcodeIds.size
  } satisfies ProjectReconcileSnapshot;
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

export async function getProjectReconcileSnapshot(): Promise<ProjectReconcileSnapshot> {
  return loadPortalProjectReconcileSnapshot();
}

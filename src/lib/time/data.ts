import { createClient } from "@supabase/supabase-js";

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

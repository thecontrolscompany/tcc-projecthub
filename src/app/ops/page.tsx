import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { OpsProjectList } from "@/components/ops-project-list";
import { normalizeSingle } from "@/lib/utils/normalize";
import { resolvePmName } from "@/lib/project/assignments";
import { linkAndGetPmDirectoryIds } from "@/lib/auth/link-pm-directory";

export const dynamic = "force-dynamic";

type OpsProject = {
  id: string;
  name: string;
  is_active: boolean | null;
  sharepoint_folder?: string | null;
  pm_id?: string | null;
  pm_directory_id?: string | null;
  customer_id?: string | null;
  customer?: { name?: string | null } | Array<{ name?: string | null }> | null;
  project_assignments?: Array<{
    role_on_project?: string | null;
    is_primary?: boolean | null;
    profile_id?: string | null;
    pm_directory_id?: string | null;
    profile?: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }> | null;
    pm_directory?:
      | { first_name?: string | null; last_name?: string | null; email?: string | null }
      | Array<{ first_name?: string | null; last_name?: string | null; email?: string | null }>
      | null;
  }> | null;
};

export type OpsProjectListItem = {
  id: string;
  name: string;
  is_active: boolean;
  customerId: string | null;
  customerName: string | null;
  pmGroupName: string;
  pctComplete: number;
  sharepointFolder: string | null;
};

export default async function OpsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div className="py-10 text-text-secondary">Please sign in.</div>;
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const linkedPmDirectoryIds = await linkAndGetPmDirectoryIds(adminClient, user);

  const assignedProjectsQuery = adminClient
    .from("project_assignments")
    .select(`
      project:projects(
        id,
        name,
        is_active,
        sharepoint_folder,
        pm_id,
        pm_directory_id,
        customer_id,
        customer:customers(name),
        project_assignments(
          role_on_project,
          is_primary,
          profile_id,
          pm_directory_id,
          profile:profiles(full_name, email),
          pm_directory:pm_directory(first_name, last_name, email)
        )
      )
    `)
    .eq("role_on_project", "ops_manager");

  const [{ data: assignedProjects }, { data: allProjects }, { data: recentUpdates }, { data: portalProfiles }] = await Promise.all([
    linkedPmDirectoryIds.length
      ? assignedProjectsQuery.or(`profile_id.eq.${user.id},pm_directory_id.in.(${linkedPmDirectoryIds.join(",")})`)
      : assignedProjectsQuery.eq("profile_id", user.id),
    (profile?.role === "ops_manager" || profile?.role === "admin")
      ? adminClient
          .from("projects")
          .select(`
            id,
            name,
            is_active,
            sharepoint_folder,
            pm_id,
            pm_directory_id,
            customer_id,
            customer:customers(name),
            project_assignments(
              role_on_project,
              is_primary,
              profile_id,
              pm_directory_id,
              profile:profiles(full_name, email),
              pm_directory:pm_directory(first_name, last_name, email)
            )
          `)
          .order("name")
      : Promise.resolve({ data: [] as unknown[] }),
    adminClient
      .from("billing_periods")
      .select("project_id, pct_complete, period_month")
      .order("period_month", { ascending: false }),
    adminClient
      .from("profiles")
      .select("customer_id")
      .eq("role", "customer")
      .not("customer_id", "is", null),
  ]);

  const projectMap = new Map<string, OpsProject>();
  const normalizedAssigned = ((assignedProjects ?? []) as Array<{ project: OpsProject | OpsProject[] | null }>).map((row) =>
    Array.isArray(row.project) ? row.project[0] : row.project
  );

  for (const project of normalizedAssigned) {
    if (project?.id) projectMap.set(project.id, project);
  }

  for (const project of ((allProjects as OpsProject[] | null) ?? [])) {
    if (project?.id) projectMap.set(project.id, project);
  }

  // Most recent billing period per project (already ordered desc)
  const pctByProjectId = new Map<string, number>();
  for (const period of (recentUpdates ?? [])) {
    if (!pctByProjectId.has(period.project_id) && period.pct_complete !== null) {
      pctByProjectId.set(period.project_id, period.pct_complete);
    }
  }
  const normalizedProjects: OpsProjectListItem[] = Array.from(projectMap.values()).map((project) => {
    const customer = Array.isArray(project.customer) ? project.customer[0] : project.customer;
    const allAssignments = project.project_assignments ?? [];

    function toNormalized(a: typeof allAssignments[number] | undefined) {
      if (!a) return null;
      return { profile: normalizeSingle(a.profile), pm_directory: normalizeSingle(a.pm_directory) };
    }

    // 1. Match assignment whose profile_id/pm_directory_id equals projects.pm_id/pm_directory_id
    const canonicalAssignment = allAssignments.find((a) =>
      a.role_on_project === "pm" &&
      ((project.pm_id && a.profile_id === project.pm_id) ||
       (project.pm_directory_id && a.pm_directory_id === project.pm_directory_id))
    );
    // 2. is_primary flag (migration 036+)
    const flaggedAssignment = allAssignments.find((a) => a.role_on_project === "pm" && a.is_primary);
    // 3. First PM in assignments (legacy fallback)
    const firstPmAssignment = allAssignments.find((a) => a.role_on_project === "pm");

    const pmGroupName =
      resolvePmName(toNormalized(canonicalAssignment)) ||
      resolvePmName(toNormalized(flaggedAssignment)) ||
      resolvePmName(toNormalized(firstPmAssignment)) ||
      "Unassigned";

    return {
      id: project.id,
      name: project.name,
      is_active: project.is_active !== false,
      customerId: project.customer_id ?? null,
      customerName: customer?.name ?? null,
      pmGroupName,
      pctComplete: (pctByProjectId.get(project.id) ?? 0) * 100,
      sharepointFolder: project.sharepoint_folder ?? null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const portalCustomerIds = new Set(
    ((portalProfiles ?? []) as Array<{ customer_id: string | null }>)
      .map((p) => p.customer_id)
      .filter(Boolean) as string[]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Operations Portal</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Projects by Project Manager</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Click any row to expand recent weekly updates. Use Edit to open the full project editor. Active projects are shown by default, with completed projects available from the toggle.
        </p>
      </div>

      <OpsProjectList projects={normalizedProjects} portalCustomerIds={portalCustomerIds} />
    </div>
  );
}

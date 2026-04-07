import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { OpsProjectList } from "@/components/ops-project-list";

export const dynamic = "force-dynamic";

type OpsProject = {
  id: string;
  name: string;
  is_active: boolean | null;
  sharepoint_folder?: string | null;
  customer?: { name?: string | null } | Array<{ name?: string | null }> | null;
  pm?: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }> | null;
  pm_directory?:
    | { first_name?: string | null; last_name?: string | null; email?: string | null }
    | Array<{ first_name?: string | null; last_name?: string | null; email?: string | null }>
    | null;
  project_assignments?: Array<{
    role_on_project?: string | null;
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

  if (user.email) {
    const normalizedEmail = user.email.trim().toLowerCase();
    await adminClient
      .from("pm_directory")
      .update({ profile_id: user.id })
      .eq("email", normalizedEmail)
      .is("profile_id", null);
  }

  const { data: linkedPmDirectoryRows } = await adminClient
    .from("pm_directory")
    .select("id")
    .eq("profile_id", user.id);

  const linkedPmDirectoryIds = (linkedPmDirectoryRows ?? []).map((row) => row.id);

  const assignedProjectsQuery = adminClient
    .from("project_assignments")
    .select(`
      project:projects(
        id,
        name,
        is_active,
        sharepoint_folder,
        customer:customers(name),
        pm:profiles(full_name, email),
        pm_directory:pm_directory(first_name, last_name, email),
        project_assignments(
          role_on_project,
          profile:profiles(full_name, email),
          pm_directory:pm_directory(first_name, last_name, email)
        )
      )
    `)
    .eq("role_on_project", "ops_manager");

  const [{ data: assignedProjects }, { data: allProjects }, { data: recentUpdates }] = await Promise.all([
    linkedPmDirectoryIds.length
      ? assignedProjectsQuery.or(`profile_id.eq.${user.id},pm_directory_id.in.(${linkedPmDirectoryIds.join(",")})`)
      : assignedProjectsQuery.eq("profile_id", user.id),
    profile?.role === "ops_manager"
      ? adminClient
          .from("projects")
          .select(`
            id,
            name,
            is_active,
            sharepoint_folder,
            customer:customers(name),
            pm:profiles(full_name, email),
            pm_directory:pm_directory(first_name, last_name, email),
            project_assignments(
              role_on_project,
              profile:profiles(full_name, email),
              pm_directory:pm_directory(first_name, last_name, email)
            )
          `)
          .order("name")
      : Promise.resolve({ data: [] as unknown[] }),
    adminClient
      .from("weekly_updates")
      .select("project_id, pct_complete, week_of")
      .eq("status", "submitted")
      .order("week_of", { ascending: false }),
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

  const pctByProjectId = new Map<string, number>();
  for (const update of (recentUpdates ?? [])) {
    if (!pctByProjectId.has(update.project_id) && update.pct_complete !== null) {
      pctByProjectId.set(update.project_id, update.pct_complete);
    }
  }
  const normalizedProjects: OpsProjectListItem[] = Array.from(projectMap.values()).map((project) => {
    const pm = Array.isArray(project.pm) ? project.pm[0] : project.pm;
    const pmDirectory = Array.isArray(project.pm_directory) ? project.pm_directory[0] : project.pm_directory;
    const customer = Array.isArray(project.customer) ? project.customer[0] : project.customer;
    // Fall back to first PM in assignments only when projects.pm_id / pm_directory_id is not set
    const fallbackAssignment = (project.project_assignments ?? []).find((assignment) => assignment?.role_on_project === "pm");
    const fallbackProfile = Array.isArray(fallbackAssignment?.profile) ? fallbackAssignment?.profile[0] : fallbackAssignment?.profile;
    const fallbackDirectory = Array.isArray(fallbackAssignment?.pm_directory) ? fallbackAssignment?.pm_directory[0] : fallbackAssignment?.pm_directory;
    const fallbackDirectoryName = [fallbackDirectory?.first_name, fallbackDirectory?.last_name].filter(Boolean).join(" ").trim();
    const pmDirectoryName = [pmDirectory?.first_name, pmDirectory?.last_name].filter(Boolean).join(" ").trim();
    // projects.pm_id and pm_directory_id hold the primary PM (written by save-project)
    const pmGroupName =
      pm?.full_name ||
      pmDirectoryName ||
      pm?.email ||
      pmDirectory?.email ||
      fallbackProfile?.full_name ||
      fallbackDirectoryName ||
      fallbackProfile?.email ||
      fallbackDirectory?.email ||
      "Unassigned";

    return {
      id: project.id,
      name: project.name,
      is_active: project.is_active !== false,
      customerName: customer?.name ?? null,
      pmGroupName,
      pctComplete: (pctByProjectId.get(project.id) ?? 0) * 100,
      sharepointFolder: project.sharepoint_folder ?? null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Operations Portal</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Projects by Project Manager</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Click any row to expand recent weekly updates. Use Edit to open the full project editor. Active projects are shown by default, with completed projects available from the toggle.
        </p>
      </div>

      <OpsProjectList projects={normalizedProjects} />
    </div>
  );
}

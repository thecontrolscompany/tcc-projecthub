import { format } from "date-fns";
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

  const currentMonth = format(new Date(), "yyyy-MM-01");

  const [{ data: assignedProjects }, { data: allProjects }, { data: periods }] = await Promise.all([
    adminClient
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
      .eq("profile_id", user.id)
      .eq("role_on_project", "ops_manager"),
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
    adminClient.from("billing_periods").select("project_id, pct_complete").eq("period_month", currentMonth),
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

  const pctByProjectId = new Map((periods ?? []).map((period) => [period.project_id, period.pct_complete]));
  const normalizedProjects: OpsProjectListItem[] = Array.from(projectMap.values()).map((project) => {
    const pm = Array.isArray(project.pm) ? project.pm[0] : project.pm;
    const pmDirectory = Array.isArray(project.pm_directory) ? project.pm_directory[0] : project.pm_directory;
    const customer = Array.isArray(project.customer) ? project.customer[0] : project.customer;
    const primaryAssignment = (project.project_assignments ?? []).find((assignment) => assignment?.role_on_project === "pm");
    const assignmentProfile = Array.isArray(primaryAssignment?.profile) ? primaryAssignment?.profile[0] : primaryAssignment?.profile;
    const assignmentDirectory = Array.isArray(primaryAssignment?.pm_directory) ? primaryAssignment?.pm_directory[0] : primaryAssignment?.pm_directory;
    const assignmentDirectoryName = [assignmentDirectory?.first_name, assignmentDirectory?.last_name].filter(Boolean).join(" ").trim();
    const pmDirectoryName = [pmDirectory?.first_name, pmDirectory?.last_name].filter(Boolean).join(" ").trim();
    const pmGroupName =
      assignmentProfile?.full_name ||
      assignmentDirectoryName ||
      pm?.full_name ||
      pmDirectoryName ||
      assignmentProfile?.email ||
      assignmentDirectory?.email ||
      pm?.email ||
      pmDirectory?.email ||
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
          Click any row to open the full project editor. Active projects are shown by default, with completed projects available from the toggle.
        </p>
      </div>

      <OpsProjectList projects={normalizedProjects} />
    </div>
  );
}

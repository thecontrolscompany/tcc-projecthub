import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { OpsProjectList } from "@/components/ops-project-list";

export const dynamic = "force-dynamic";

type OpsProject = {
  id: string;
  name: string;
  is_active: boolean | null;
  customer?: { name?: string | null } | Array<{ name?: string | null }> | null;
  pm?: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }> | null;
  pm_directory?:
    | { first_name?: string | null; last_name?: string | null; email?: string | null }
    | Array<{ first_name?: string | null; last_name?: string | null; email?: string | null }>
    | null;
};

type OpsProjectListItem = {
  id: string;
  name: string;
  is_active: boolean;
  customerName: string | null;
  pmGroupName: string;
  pctComplete: number;
};

export default async function OpsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div className="py-10 text-text-secondary">Please sign in.</div>;
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const currentMonth = format(new Date(), "yyyy-MM-01");

  const [{ data: projects }, { data: periods }] = await Promise.all([
    adminClient
      .from("projects")
      .select("id, name, is_active, customer:customers(name), pm:profiles(full_name, email), pm_directory:pm_directory(first_name, last_name, email)")
      .order("name"),
    adminClient
      .from("billing_periods")
      .select("project_id, pct_complete")
      .eq("period_month", currentMonth),
  ]);

  const pctByProjectId = new Map((periods ?? []).map((period) => [period.project_id, period.pct_complete]));
  const normalizedProjects: OpsProjectListItem[] = ((projects as OpsProject[] | null) ?? []).map((project) => {
      const pm = Array.isArray(project.pm) ? project.pm[0] : project.pm;
      const pmDirectory = Array.isArray(project.pm_directory) ? project.pm_directory[0] : project.pm_directory;
      const customer = Array.isArray(project.customer) ? project.customer[0] : project.customer;
      const pmDirectoryName = [pmDirectory?.first_name, pmDirectory?.last_name].filter(Boolean).join(" ").trim();
      const pmGroupName =
        pm?.full_name ??
        (pmDirectoryName || pm?.email || pmDirectory?.email || "Unassigned");

      return {
        id: project.id,
        name: project.name,
        is_active: project.is_active !== false,
        customerName: customer?.name ?? null,
        pmGroupName,
        pctComplete: (pctByProjectId.get(project.id) ?? 0) * 100,
      };
    });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Operations Portal</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">All Projects by Project Manager</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Admin-level read-only view of every project, grouped by assigned project manager or left in an unassigned bucket.
        </p>
      </div>

      <OpsProjectList projects={normalizedProjects} />
    </div>
  );
}

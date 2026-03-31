import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

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
  const groupedProjects = ((projects as OpsProject[] | null) ?? []).reduce(
    (acc, project) => {
      const pm = Array.isArray(project.pm) ? project.pm[0] : project.pm;
      const pmDirectory = Array.isArray(project.pm_directory) ? project.pm_directory[0] : project.pm_directory;
      const pmDirectoryName = [pmDirectory?.first_name, pmDirectory?.last_name].filter(Boolean).join(" ").trim();
      const groupName =
        pm?.full_name ??
        (pmDirectoryName || pm?.email || pmDirectory?.email || "Unassigned");

      if (!acc.has(groupName)) {
        acc.set(groupName, []);
      }

      acc.get(groupName)?.push(project);
      return acc;
    },
    new Map<string, OpsProject[]>()
  );

  const sortedGroups = Array.from(groupedProjects.entries()).sort(([a], [b]) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    return a.localeCompare(b);
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

      <div className="space-y-6">
        {sortedGroups.map(([groupName, groupProjects]) => (
          <section key={groupName} className="overflow-hidden rounded-2xl border border-border-default">
            <div className="flex items-center justify-between border-b border-border-default bg-surface-raised px-4 py-3">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{groupName}</h2>
                <p className="text-xs text-text-secondary">
                  {groupProjects.length} project{groupProjects.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-surface-raised/60">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Project</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Customer</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">% Complete</th>
                  </tr>
                </thead>
                <tbody>
                  {groupProjects.map((project) => {
                    const customer = Array.isArray(project.customer) ? project.customer[0] : project.customer;
                    const pct = (pctByProjectId.get(project.id) ?? 0) * 100;

                    return (
                      <tr key={project.id} className="border-b border-border-default hover:bg-surface-raised">
                        <td className="px-4 py-2.5 font-medium text-text-primary">{project.name}</td>
                        <td className="px-4 py-2.5 text-text-secondary">{customer?.name ?? "-"}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              project.is_active === false
                                ? "bg-surface-overlay text-text-secondary"
                                : "bg-status-success/10 text-status-success",
                            ].join(" ")}
                          >
                            {project.is_active === false ? "Completed" : "Active"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-text-primary">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

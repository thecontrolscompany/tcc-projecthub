import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type OpsProject = {
  id: string;
  name: string;
  customer?: { name?: string | null } | Array<{ name?: string | null }> | null;
  pm?: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }> | null;
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
      .select("id, name, customer:customers(name), pm:profiles(full_name, email)")
      .eq("is_active", true)
      .order("name"),
    adminClient
      .from("billing_periods")
      .select("project_id, pct_complete")
      .eq("period_month", currentMonth),
  ]);

  const pctByProjectId = new Map((periods ?? []).map((period) => [period.project_id, period.pct_complete]));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Operations Portal</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Active Projects</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Read-only view of all active projects and current progress across the company.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border-default">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default bg-surface-raised/80">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Project</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Customer</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">PM</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">% Complete</th>
            </tr>
          </thead>
          <tbody>
            {(projects as OpsProject[] | null)?.map((project) => {
              const customer = Array.isArray(project.customer) ? project.customer[0] : project.customer;
              const pm = Array.isArray(project.pm) ? project.pm[0] : project.pm;
              const pct = (pctByProjectId.get(project.id) ?? 0) * 100;

              return (
                <tr key={project.id} className="border-b border-border-default hover:bg-surface-raised">
                  <td className="px-4 py-2.5 font-medium text-text-primary">{project.name}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{customer?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{pm?.full_name ?? pm?.email ?? "-"}</td>
                  <td className="px-4 py-2.5 text-right text-text-primary">{pct.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

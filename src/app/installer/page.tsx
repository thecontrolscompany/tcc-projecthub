import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { normalizeSingle } from "@/lib/utils/normalize";
import { linkAndGetPmDirectoryIds } from "@/lib/auth/link-pm-directory";

export const dynamic = "force-dynamic";

const SHAREPOINT_SITE_URL = "https://controlsco.sharepoint.com/sites/TCCProjects";

type InstallerAssignmentRow = {
  project:
    | InstallerProjectRow
    | InstallerProjectRow[]
    | null;
};

type InstallerProjectRow = {
  id: string;
  name: string;
  job_number: string | null;
  site_address: string | null;
  sharepoint_folder: string | null;
  is_active: boolean | null;
  customer?: { name: string | null } | Array<{ name: string | null }> | null;
};

type InstallerProjectCard = {
  id: string;
  name: string;
  jobNumber: string | null;
  siteAddress: string | null;
  sharepointFolder: string | null;
  isActive: boolean;
  customerName: string | null;
  pctComplete: number | null;
};

function toSharePointUrl(folder: string | null) {
  if (!folder) return null;
  const encodedPath = folder.split("/").filter(Boolean).map((segment) => encodeURIComponent(segment)).join("/");
  return `${SHAREPOINT_SITE_URL}/Shared%20Documents/${encodedPath}`;
}

export default async function InstallerPage() {
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

  const linkedPmDirectoryIds = await linkAndGetPmDirectoryIds(adminClient, user);
  const assignmentsQuery = adminClient
    .from("project_assignments")
    .select(`
      project:projects(
        id,
        name,
        job_number,
        site_address,
        sharepoint_folder,
        is_active,
        customer:customers(name)
      )
    `)
    .eq("role_on_project", "installer");

  const { data: assignments } = linkedPmDirectoryIds.length
    ? await assignmentsQuery.or(`profile_id.eq.${user.id},pm_directory_id.in.(${linkedPmDirectoryIds.join(",")})`)
    : await assignmentsQuery.eq("profile_id", user.id);

  const baseProjects = ((assignments ?? []) as InstallerAssignmentRow[])
    .map((assignment) => normalizeSingle(assignment.project))
    .filter((project): project is InstallerProjectRow => Boolean(project));

  const projectIds = baseProjects.map((project) => project.id);
  const { data: billingRows } = projectIds.length
    ? await supabase
        .from("billing_periods")
        .select("project_id, period_month, pct_complete")
        .in("project_id", projectIds)
        .order("period_month", { ascending: false })
    : { data: [] as Array<{ project_id: string; period_month: string; pct_complete: number }> };

  const latestPctByProjectId = new Map<string, number>();
  for (const row of billingRows ?? []) {
    if (!latestPctByProjectId.has(row.project_id)) {
      latestPctByProjectId.set(row.project_id, row.pct_complete);
    }
  }

  const projects: InstallerProjectCard[] = baseProjects
    .map((project) => {
      const customer = normalizeSingle(project.customer);
      return {
        id: project.id,
        name: project.name,
        jobNumber: project.job_number ?? null,
        siteAddress: project.site_address ?? null,
        sharepointFolder: project.sharepoint_folder ?? null,
        isActive: project.is_active !== false,
        customerName: customer?.name ?? null,
        pctComplete: latestPctByProjectId.has(project.id) ? (latestPctByProjectId.get(project.id) ?? 0) * 100 : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen bg-surface-base text-text-primary">
      <main className="mx-auto max-w-5xl px-5 py-6 sm:px-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Installer Portal</p>
          <h1 className="text-2xl font-bold text-text-primary">Assigned Projects</h1>
          <p className="max-w-2xl text-sm text-text-secondary">
            Field-ready access to your assigned jobs, with current progress and a direct link into the project SharePoint folder.
          </p>
        </div>

        {!projects.length ? (
          <div className="mt-6 rounded-3xl border border-dashed border-border-default bg-surface-raised px-6 py-14 text-center">
            <p className="text-lg font-semibold text-text-primary">No projects assigned yet</p>
            <p className="mt-2 text-sm text-text-secondary">
              When you are assigned as an installer on a project, it will show up here automatically.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {projects.map((project) => {
              const sharePointUrl = toSharePointUrl(project.sharepointFolder);

              return (
                <section
                  key={project.id}
                  className="rounded-3xl border border-border-default bg-surface-raised p-5 shadow-[0_12px_28px_rgba(15,23,42,0.18)]"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-text-primary">{project.name}</h2>
                        <span
                          className={[
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                            project.isActive
                              ? "bg-status-success/10 text-status-success"
                              : "bg-surface-overlay text-text-secondary",
                          ].join(" ")}
                        >
                          {project.isActive ? "Active" : "Completed"}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary">{project.customerName ?? "Customer not set"}</p>
                    </div>

                    {sharePointUrl ? (
                      <Link
                        href={sharePointUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/20"
                      >
                        Open in SharePoint
                      </Link>
                    ) : (
                      <span className="inline-flex items-center rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm text-text-secondary">
                        No SharePoint folder
                      </span>
                    )}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <InstallerStat label="Job Number" value={project.jobNumber ?? "Not assigned"} />
                    <InstallerStat label="Current % Complete" value={project.pctComplete !== null ? `${project.pctComplete.toFixed(1)}%` : "Not reported"} />
                    <InstallerStat label="Site Address" value={project.siteAddress ?? "Not provided"} />
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function InstallerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-overlay px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">{label}</p>
      <p className="mt-1 text-sm font-medium text-text-primary">{value}</p>
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SHAREPOINT_SITE_URL = "https://controlsco.sharepoint.com/sites/TCCProjects";

function toSharePointUrl(folder: string | null) {
  if (!folder) return null;
  const encodedPath = folder
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

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

  const { data: linkedEntries } = await adminClient
    .from("pm_directory")
    .select("id")
    .eq("profile_id", user.id);

  const linkedIds = (linkedEntries ?? []).map((entry) => entry.id);
  let projectQuery = adminClient
    .from("projects")
    .select("id, name, job_number, sharepoint_folder, is_active")
    .eq("is_active", true)
    .order("name");

  if (linkedIds.length > 0) {
    projectQuery = projectQuery.or(`pm_id.eq.${user.id},pm_directory_id.in.(${linkedIds.join(",")})`);
  } else {
    projectQuery = projectQuery.eq("pm_id", user.id);
  }

  const { data: projects } = await projectQuery;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Installer Portal</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Assigned Projects</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Read-only access to your assigned projects and their SharePoint folders.
        </p>
      </div>

      {!projects?.length ? (
        <div className="rounded-2xl border border-dashed border-border-default p-12 text-center text-text-secondary">
          No active projects are assigned to you.
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => {
            const sharePointUrl = toSharePointUrl(project.sharepoint_folder ?? null);
            return (
              <div key={project.id} className="rounded-2xl border border-border-default bg-surface-raised p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">{project.name}</h2>
                    <p className="mt-1 text-sm text-text-secondary">
                      {project.job_number ?? "No job number"} • {project.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>
                  {sharePointUrl ? (
                    <Link
                      href={sharePointUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-brand-primary/40 bg-brand-primary/10 px-4 py-2 text-sm font-medium text-brand-primary transition hover:bg-brand-primary/20"
                    >
                      Open in SharePoint
                    </Link>
                  ) : (
                    <span className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm text-text-secondary">
                      No SharePoint Folder
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

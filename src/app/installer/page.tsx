import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SHAREPOINT_SITE_URL = "https://controlsco.sharepoint.com/sites/TCCProjects";

function toSharePointUrl(folder: string | null) {
  if (!folder) return null;
  const encodedPath = folder.split("/").map((segment) => encodeURIComponent(segment)).join("/");
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

  const { data: assignments } = await supabase
    .from("project_assignments")
    .select(`
      role_on_project,
      project:projects(
        id,
        name,
        job_number,
        sharepoint_folder,
        is_active
      )
    `)
    .eq("profile_id", user.id)
    .eq("role_on_project", "installer");

  const projects = ((assignments ?? []) as Array<{
    role_on_project: "installer";
    project:
      | { id: string; name: string; job_number: string | null; sharepoint_folder: string | null; is_active: boolean | null }
      | Array<{ id: string; name: string; job_number: string | null; sharepoint_folder: string | null; is_active: boolean | null }>;
  }>)
    .map((assignment) => Array.isArray(assignment.project) ? assignment.project[0] : assignment.project)
    .filter((project): project is { id: string; name: string; job_number: string | null; sharepoint_folder: string | null; is_active: boolean | null } => Boolean(project))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Installer Portal</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Assigned Projects</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Read-only access to projects where you are assigned as an installer.
        </p>
      </div>

      {!projects.length ? (
        <div className="rounded-2xl border border-dashed border-border-default p-12 text-center text-text-secondary">
          No projects are assigned to you as an installer.
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => {
            const sharePointUrl = toSharePointUrl(project.sharepoint_folder ?? null);
            return (
              <div key={project.id} className="rounded-2xl border border-border-default bg-surface-raised p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-text-primary">{project.name}</h2>
                      <span className="inline-flex rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-medium text-brand-primary">
                        Installer
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">
                      {project.job_number ?? "No job number"} • {project.is_active === false ? "Completed" : "Active"}
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

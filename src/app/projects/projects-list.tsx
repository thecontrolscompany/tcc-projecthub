"use client";

import { useMemo, useState } from "react";

interface ProjectListItem {
  id: string;
  name: string;
  job_number: string | null;
  is_active: boolean;
  migration_status: "legacy" | "migrated" | "clean" | null;
  sharepoint_folder: string | null;
  created_at: string;
}

function sharePointUrl(folder: string) {
  const encodedPath = folder
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://controlsco.sharepoint.com/sites/TCCProjects/Shared%20Documents/${encodedPath}`;
}

function ProjectTable({ projects }: { projects: ProjectListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-raised">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-border-default bg-surface-overlay">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Job Number</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Project Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Legacy</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">SharePoint</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id} className="border-b border-border-default last:border-b-0">
              <td className="px-4 py-3 font-medium text-text-primary">{project.job_number ?? "-"}</td>
              <td className="px-4 py-3 text-text-primary">{project.name}</td>
              <td className="px-4 py-3">
                <span
                  className={[
                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                    project.is_active
                      ? "bg-status-success/10 text-status-success"
                      : "bg-surface-overlay text-text-tertiary",
                  ].join(" ")}
                >
                  {project.is_active ? "Active" : "Completed"}
                </span>
              </td>
              <td className="px-4 py-3">
                {project.migration_status === "legacy" ? (
                  <span className="inline-flex items-center rounded border border-status-warning/20 bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning">
                    ⚠ Legacy
                  </span>
                ) : (
                  <span className="text-text-tertiary">-</span>
                )}
              </td>
              <td className="px-4 py-3">
                {project.sharepoint_folder ? (
                  <a
                    href={sharePointUrl(project.sharepoint_folder)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-brand-primary hover:text-brand-hover"
                  >
                    ↗ Open
                  </a>
                ) : (
                  <span className="text-text-tertiary">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectsList({ projects }: { projects: ProjectListItem[] }) {
  const [query, setQuery] = useState("");

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return projects;

    return projects.filter((project) => {
      const jobNumber = project.job_number?.toLowerCase() ?? "";
      const name = project.name.toLowerCase();
      return jobNumber.includes(normalized) || name.includes(normalized);
    });
  }, [projects, query]);

  const activeProjects = filteredProjects.filter((project) => project.is_active);
  const completedProjects = filteredProjects.filter((project) => !project.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Projects</h1>
        <p className="mt-1 text-text-secondary">
          View all active and completed projects with job numbers, PMs, and billing status.
        </p>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-raised p-4">
        <label className="block text-sm font-medium text-text-secondary" htmlFor="project-search">
          Search projects
        </label>
        <input
          id="project-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by project name or job number"
          className="mt-2 w-full rounded-lg border border-border-default bg-surface-base px-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand-primary focus:outline-none"
        />
        <p className="mt-3 text-sm text-text-secondary">
          Showing {filteredProjects.length} of {projects.length} projects
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-text-primary">Active Projects</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {activeProjects.length} active project{activeProjects.length !== 1 ? "s" : ""}
          </p>
        </div>
        {activeProjects.length > 0 ? (
          <ProjectTable projects={activeProjects} />
        ) : (
          <div className="rounded-xl border border-border-default bg-surface-raised p-6 text-sm text-text-secondary">
            No active projects match your current filter.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-text-primary">Completed Projects</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {completedProjects.length} completed project{completedProjects.length !== 1 ? "s" : ""}
          </p>
        </div>
        {completedProjects.length > 0 ? (
          <ProjectTable projects={completedProjects} />
        ) : (
          <div className="rounded-xl border border-border-default bg-surface-raised p-6 text-sm text-text-secondary">
            No completed projects match your current filter.
          </div>
        )}
      </section>
    </div>
  );
}

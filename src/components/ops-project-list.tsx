"use client";

import { useMemo, useState } from "react";

type OpsProjectListItem = {
  id: string;
  name: string;
  is_active: boolean;
  customerName: string | null;
  pmGroupName: string;
  pctComplete: number;
};

export function OpsProjectList({ projects }: { projects: OpsProjectListItem[] }) {
  const [showCompleted, setShowCompleted] = useState(false);

  const visibleProjects = useMemo(
    () => (showCompleted ? projects : projects.filter((project) => project.is_active)),
    [projects, showCompleted]
  );

  const groupedProjects = useMemo(() => {
    return visibleProjects.reduce((acc, project) => {
      if (!acc.has(project.pmGroupName)) {
        acc.set(project.pmGroupName, []);
      }

      acc.get(project.pmGroupName)?.push(project);
      return acc;
    }, new Map<string, OpsProjectListItem[]>());
  }, [visibleProjects]);

  const sortedGroups = useMemo(() => {
    return Array.from(groupedProjects.entries()).sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });
  }, [groupedProjects]);

  return (
    <div className="space-y-6">
      <label className="inline-flex items-center gap-3 rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={showCompleted}
          onChange={(event) => setShowCompleted(event.target.checked)}
          className="h-4 w-4 accent-[var(--color-brand-primary)]"
        />
        Show completed projects
      </label>

      {sortedGroups.length === 0 ? (
        <div className="rounded-2xl border border-border-default bg-surface-raised px-4 py-6 text-sm text-text-secondary">
          No projects match the current filter.
        </div>
      ) : (
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
                    {groupProjects.map((project) => (
                      <tr key={project.id} className="border-b border-border-default hover:bg-surface-raised">
                        <td className="px-4 py-2.5 font-medium text-text-primary">{project.name}</td>
                        <td className="px-4 py-2.5 text-text-secondary">{project.customerName ?? "-"}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              project.is_active
                                ? "bg-status-success/10 text-status-success"
                                : "bg-surface-overlay text-text-secondary",
                            ].join(" ")}
                          >
                            {project.is_active ? "Active" : "Completed"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-text-primary">{project.pctComplete.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

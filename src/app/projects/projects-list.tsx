"use client";

import { Fragment, useMemo, useState } from "react";

interface ProjectListItem {
  id: string;
  name: string;
  job_number: string | null;
  is_active: boolean;
  migration_status: "legacy" | "migrated" | "clean" | null;
  sharepoint_folder: string | null;
  created_at: string;
  billed_in_full: boolean;
  paid_in_full: boolean;
  completed_at: string | null;
  contract_price: number | null;
  customer_poc: string | null;
  site_address: string | null;
}

function sharePointUrl(folder: string) {
  const encodedPath = folder
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://controlsco.sharepoint.com/sites/TCCProjects/Shared%20Documents/${encodedPath}`;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-1 text-sm text-text-primary">{value}</p>
    </div>
  );
}

function DetailRow({ project }: { project: ProjectListItem }) {
  return (
    <tr className="border-b border-border-default bg-surface-base last:border-b-0">
      <td colSpan={7} className="px-4 py-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DetailItem
            label="Contract Price"
            value={
              project.contract_price !== null
                ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(project.contract_price)
                : "-"
            }
          />
          <DetailItem label="Customer POC" value={project.customer_poc ?? "-"} />
          <DetailItem label="Site Address" value={project.site_address ?? "-"} />
          <DetailItem label="Completed At" value={project.completed_at ? new Date(project.completed_at).toLocaleDateString() : "-"} />
        </div>
      </td>
    </tr>
  );
}

type SortField = "job_number" | "name";
type SortDir = "asc" | "desc";

function SortIndicator({ field, active, dir }: { field: string; active: boolean; dir: SortDir }) {
  return (
    <span className={["ml-1 inline-block text-xs", active ? "text-brand-primary" : "text-text-tertiary"].join(" ")}>
      {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );
}

function ProjectTable({ projects }: { projects: ProjectListItem[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("job_number");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      let aVal: string;
      let bVal: string;
      if (sortField === "job_number") {
        aVal = a.job_number ?? "";
        bVal = b.job_number ?? "";
      } else {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
      }
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [projects, sortField, sortDir]);

  return (
    <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-raised">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b border-border-default bg-surface-overlay">
            <th
              className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hover:text-text-primary"
              onClick={() => handleSort("job_number")}
            >
              Job Number
              <SortIndicator field="job_number" active={sortField === "job_number"} dir={sortDir} />
            </th>
            <th
              className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hover:text-text-primary"
              onClick={() => handleSort("name")}
            >
              Project Name
              <SortIndicator field="name" active={sortField === "name"} dir={sortDir} />
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Legacy</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Billed in Full</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Paid in Full</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">SharePoint</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((project) => {
            const isExpanded = expandedId === project.id;
            return (
              <Fragment key={project.id}>
                <tr
                  className="cursor-pointer border-b border-border-default last:border-b-0 hover:bg-surface-base"
                  onClick={() => setExpandedId(isExpanded ? null : project.id)}
                >
                  <td className="px-4 py-3 font-medium text-text-primary">{project.job_number ?? "-"}</td>
                  <td className="px-4 py-3 text-text-primary">{project.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                        project.is_active ? "bg-status-success/10 text-status-success" : "bg-surface-overlay text-text-tertiary",
                      ].join(" ")}
                    >
                      {project.is_active ? "Active" : "Completed"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {project.migration_status === "legacy" ? (
                      <span className="inline-flex items-center rounded border border-status-warning/20 bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning">
                        Warning Legacy
                      </span>
                    ) : (
                      <span className="text-text-tertiary">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {project.billed_in_full ? (
                      <span className="inline-flex items-center rounded-full bg-status-success/10 px-2.5 py-1 text-xs font-medium text-status-success">
                        Billed
                      </span>
                    ) : (
                      <span className="text-text-tertiary">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {project.paid_in_full ? (
                      <span className="inline-flex items-center rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-medium text-brand-primary">
                        Paid
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
                        onClick={(event) => event.stopPropagation()}
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-text-tertiary">-</span>
                    )}
                  </td>
                </tr>
                {isExpanded && <DetailRow project={project} />}
              </Fragment>
            );
          })}
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

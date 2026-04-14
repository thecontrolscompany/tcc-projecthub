"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { ProjectHoursRow, ProjectWorkerHoursRow } from "@/types/database";

type ProjectHoursResponse = {
  weekStart: string;
  weekEnd: string;
  rows: ProjectHoursRow[];
};

type ProjectWorkerHoursResponse = {
  weekStart: string;
  weekEnd: string;
  projectId: string;
  rows: ProjectWorkerHoursRow[];
};

function formatHours(hours: number) {
  return hours.toFixed(1);
}

function formatWeekRangeLabel(weekStart: string, weekEnd: string) {
  const start = new Date(`${weekStart}T12:00:00`);
  const endExclusive = new Date(`${weekEnd}T12:00:00`);
  endExclusive.setDate(endExclusive.getDate() - 1);

  const startFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  });
  const endFormatter = new Intl.DateTimeFormat("en-US", {
    month: start.getMonth() === endExclusive.getMonth() ? undefined : "short",
    day: "numeric"
  });

  return `${startFormatter.format(start)} – ${endFormatter.format(endExclusive)}`;
}

export function ProjectHoursSection() {
  const [data, setData] = useState<ProjectHoursResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [workerRowsByProjectId, setWorkerRowsByProjectId] = useState<Record<string, ProjectWorkerHoursRow[]>>({});
  const [detailLoadingProjectId, setDetailLoadingProjectId] = useState<string | null>(null);
  const [detailErrorByProjectId, setDetailErrorByProjectId] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadProjectHours() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/time/project-hours", { credentials: "include" });
        const json = (await response.json()) as ProjectHoursResponse & { error?: string };
        if (!response.ok) {
          throw new Error(json.error ?? "Unable to load weekly project hours.");
        }

        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load weekly project hours.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProjectHours();

    return () => {
      cancelled = true;
    };
  }, []);

  const weekLabel = useMemo(() => {
    if (!data) {
      return "Current week";
    }

    return formatWeekRangeLabel(data.weekStart, data.weekEnd);
  }, [data]);

  async function toggleProject(projectId: string) {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      return;
    }

    setExpandedProjectId(projectId);
    if (workerRowsByProjectId[projectId]) {
      return;
    }

    setDetailLoadingProjectId(projectId);
    setDetailErrorByProjectId((current) => {
      const next = { ...current };
      delete next[projectId];
      return next;
    });

    try {
      const response = await fetch(`/api/time/project-hours?project_id=${projectId}`, {
        credentials: "include"
      });
      const json = (await response.json()) as ProjectWorkerHoursResponse & { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Unable to load worker breakdown.");
      }

      setWorkerRowsByProjectId((current) => ({
        ...current,
        [projectId]: json.rows
      }));
    } catch (err) {
      setDetailErrorByProjectId((current) => ({
        ...current,
        [projectId]: err instanceof Error ? err.message : "Unable to load worker breakdown."
      }));
    } finally {
      setDetailLoadingProjectId((current) => (current === projectId ? null : current));
    }
  }

  return (
    <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">This Week&apos;s Hours</p>
          <h2 className="mt-2 text-xl font-semibold text-text-primary">Portal-mapped project hours</h2>
          <p className="mt-2 text-sm text-text-secondary">{weekLabel}</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-2xl border border-border-default bg-surface-overlay"
            />
          ))}
        </div>
      ) : error ? (
        <p className="mt-5 text-sm text-rose-300">{error}</p>
      ) : !data || data.rows.length === 0 ? (
        <p className="mt-5 text-sm text-text-tertiary">No hours logged this week.</p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border-default">
          <table className="min-w-full divide-y divide-border-default text-sm">
            <thead className="bg-surface-overlay text-left text-text-tertiary">
              <tr>
                <th className="px-4 py-3 font-medium">Project Name</th>
                <th className="px-4 py-3 font-medium">Hours This Week</th>
                <th className="px-4 py-3 font-medium">Workers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default bg-surface-raised text-text-secondary">
              {data.rows.map((row) => {
                const isExpanded = expandedProjectId === row.project_id;
                const workerRows = workerRowsByProjectId[row.project_id] ?? [];
                const detailError = detailErrorByProjectId[row.project_id];
                const detailLoading = detailLoadingProjectId === row.project_id;

                return (
                  <Fragment key={row.project_id}>
                    <tr
                      tabIndex={0}
                      role="button"
                      aria-expanded={isExpanded}
                      onClick={() => void toggleProject(row.project_id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void toggleProject(row.project_id);
                        }
                      }}
                      className="cursor-pointer transition hover:bg-surface-overlay focus:bg-surface-overlay focus:outline-none"
                    >
                      <td className="px-4 py-4 font-medium text-text-primary">{row.project_name}</td>
                      <td className="px-4 py-4">{formatHours(row.total_hours)}</td>
                      <td className="px-4 py-4">{row.worker_count}</td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${row.project_id}-detail`} className="bg-surface-overlay">
                        <td colSpan={3} className="px-4 py-4">
                          {detailLoading ? (
                            <div className="space-y-2">
                              {Array.from({ length: 3 }).map((_, index) => (
                                <div
                                  key={index}
                                  className="h-10 animate-pulse rounded-xl border border-border-default bg-surface-raised"
                                />
                              ))}
                            </div>
                          ) : detailError ? (
                            <p className="text-sm text-rose-300">{detailError}</p>
                          ) : workerRows.length === 0 ? (
                            <p className="text-sm text-text-tertiary">No worker breakdown found for this project.</p>
                          ) : (
                            <div className="space-y-2">
                              {workerRows.map((worker) => (
                                <div
                                  key={`${row.project_id}-${worker.qb_user_id}`}
                                  className="flex items-center justify-between rounded-xl border border-border-default bg-surface-raised px-4 py-3"
                                >
                                  <span className="font-medium text-text-primary">{worker.display_name}</span>
                                  <span>{formatHours(worker.total_hours)} hrs</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

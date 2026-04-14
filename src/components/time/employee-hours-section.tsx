"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { EmployeeHoursRow, EmployeeProjectHoursRow } from "@/types/database";

type EmployeeHoursResponse = {
  weekStart: string;
  weekEnd: string;
  rows: EmployeeHoursRow[];
};

type EmployeeProjectHoursResponse = {
  weekStart: string;
  weekEnd: string;
  qbUserId: number;
  rows: EmployeeProjectHoursRow[];
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

export function EmployeeHoursSection() {
  const [data, setData] = useState<EmployeeHoursResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [projectRowsByUserId, setProjectRowsByUserId] = useState<Record<number, EmployeeProjectHoursRow[]>>({});
  const [detailLoadingUserId, setDetailLoadingUserId] = useState<number | null>(null);
  const [detailErrorByUserId, setDetailErrorByUserId] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadEmployeeHours() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/time/employee-hours", { credentials: "include" });
        const json = (await response.json()) as EmployeeHoursResponse & { error?: string };
        if (!response.ok) {
          throw new Error(json.error ?? "Unable to load weekly employee hours.");
        }

        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load weekly employee hours.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEmployeeHours();

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

  async function toggleEmployee(qbUserId: number) {
    if (expandedUserId === qbUserId) {
      setExpandedUserId(null);
      return;
    }

    setExpandedUserId(qbUserId);
    if (projectRowsByUserId[qbUserId]) {
      return;
    }

    setDetailLoadingUserId(qbUserId);
    setDetailErrorByUserId((current) => {
      const next = { ...current };
      delete next[qbUserId];
      return next;
    });

    try {
      const response = await fetch(`/api/time/employee-hours?qb_user_id=${qbUserId}`, {
        credentials: "include"
      });
      const json = (await response.json()) as EmployeeProjectHoursResponse & { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Unable to load employee project breakdown.");
      }

      setProjectRowsByUserId((current) => ({
        ...current,
        [qbUserId]: json.rows
      }));
    } catch (err) {
      setDetailErrorByUserId((current) => ({
        ...current,
        [qbUserId]: err instanceof Error ? err.message : "Unable to load employee project breakdown."
      }));
    } finally {
      setDetailLoadingUserId((current) => (current === qbUserId ? null : current));
    }
  }

  return (
    <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">This Week&apos;s Hours</p>
        <h2 className="mt-2 text-xl font-semibold text-text-primary">Employee hours breakdown</h2>
        <p className="mt-2 text-sm text-text-secondary">{weekLabel}</p>
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
        <p className="mt-5 text-sm text-text-tertiary">No hours data this week.</p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border-default">
          <table className="min-w-full divide-y divide-border-default text-sm">
            <thead className="bg-surface-overlay text-left text-text-tertiary">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Hours This Week</th>
                <th className="px-4 py-3 font-medium">Projects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default bg-surface-raised text-text-secondary">
              {data.rows.map((row) => {
                const isExpanded = expandedUserId === row.qb_user_id;
                const projectRows = projectRowsByUserId[row.qb_user_id] ?? [];
                const detailError = detailErrorByUserId[row.qb_user_id];
                const detailLoading = detailLoadingUserId === row.qb_user_id;

                return (
                  <Fragment key={row.qb_user_id}>
                    <tr
                      tabIndex={0}
                      role="button"
                      aria-expanded={isExpanded}
                      onClick={() => void toggleEmployee(row.qb_user_id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void toggleEmployee(row.qb_user_id);
                        }
                      }}
                      className="cursor-pointer transition hover:bg-surface-overlay focus:bg-surface-overlay focus:outline-none"
                    >
                      <td className="px-4 py-4 font-medium text-text-primary">{row.display_name}</td>
                      <td className="px-4 py-4">{formatHours(row.total_hours)}</td>
                      <td className="px-4 py-4">{row.jobcode_count}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-surface-overlay">
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
                          ) : projectRows.length === 0 ? (
                            <p className="text-sm text-text-tertiary">No project breakdown found for this employee.</p>
                          ) : (
                            <div className="space-y-2">
                              {projectRows.map((project, index) => (
                                <div
                                  key={`${row.qb_user_id}-${project.project_id ?? "unmapped"}-${index}`}
                                  className="flex items-center justify-between rounded-xl border border-border-default bg-surface-raised px-4 py-3"
                                >
                                  <span className="font-medium text-text-primary">{project.project_name}</span>
                                  <span>{formatHours(project.total_hours)} hrs</span>
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

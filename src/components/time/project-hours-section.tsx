"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { TimeRangePicker } from "@/components/time/time-range-picker";
import { getPresetRange, type TimeRange, type TimeRangePreset } from "@/lib/time/date-range";
import type { ProjectHoursRow, ProjectWorkerHoursRow, TimeDayHoursRow } from "@/types/database";

type ProjectHoursResponse = {
  startDate: string;
  endDate: string;
  rows: ProjectHoursRow[];
};

type ProjectWorkerHoursResponse = {
  startDate: string;
  endDate: string;
  projectId: string;
  rows: ProjectWorkerHoursRow[];
};

type ProjectWorkerDayResponse = {
  startDate: string;
  endDate: string;
  projectId: string;
  qbUserId: number;
  rows: TimeDayHoursRow[];
};

function formatHours(hours: number) {
  return hours.toFixed(1);
}

function formatRangeLabel(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);

  const startFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  });
  const endFormatter = new Intl.DateTimeFormat("en-US", {
    month: start.getMonth() === end.getMonth() ? undefined : "short",
    day: "numeric"
  });

  return `${startFormatter.format(start)} – ${endFormatter.format(end)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

export function ProjectHoursSection() {
  const defaultRange = useMemo(() => getPresetRange("current_week"), []);
  const [selectedRange, setSelectedRange] = useState<TimeRange>(defaultRange);
  const [selectedPreset, setSelectedPreset] = useState<TimeRangePreset>("current_week");
  const [data, setData] = useState<ProjectHoursResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [expandedWorkerKey, setExpandedWorkerKey] = useState<string | null>(null);
  const [workerRowsByProjectId, setWorkerRowsByProjectId] = useState<Record<string, ProjectWorkerHoursRow[]>>({});
  const [dayRowsByWorkerKey, setDayRowsByWorkerKey] = useState<Record<string, TimeDayHoursRow[]>>({});
  const [detailLoadingProjectId, setDetailLoadingProjectId] = useState<string | null>(null);
  const [dayLoadingWorkerKey, setDayLoadingWorkerKey] = useState<string | null>(null);
  const [detailErrorByProjectId, setDetailErrorByProjectId] = useState<Record<string, string>>({});
  const [dayErrorByWorkerKey, setDayErrorByWorkerKey] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadProjectHours() {
      setLoading(true);
      setError(null);
      setExpandedProjectId(null);
      setExpandedWorkerKey(null);

      try {
        const params = new URLSearchParams({
          start_date: selectedRange.startDate,
          end_date: selectedRange.endDate,
        });
        const response = await fetch(`/api/time/project-hours?${params.toString()}`, { credentials: "include" });
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
  }, [selectedRange.endDate, selectedRange.startDate]);

  const rangeLabel = useMemo(() => {
    if (!data) {
      return formatRangeLabel(selectedRange.startDate, selectedRange.endDate);
    }

    return formatRangeLabel(data.startDate, data.endDate);
  }, [data, selectedRange.endDate, selectedRange.startDate]);

  async function toggleProject(projectId: string) {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      setExpandedWorkerKey(null);
      return;
    }

    setExpandedProjectId(projectId);
    setExpandedWorkerKey(null);

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
      const params = new URLSearchParams({
        project_id: projectId,
        start_date: selectedRange.startDate,
        end_date: selectedRange.endDate,
      });
      const response = await fetch(`/api/time/project-hours?${params.toString()}`, {
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

  async function toggleWorker(projectId: string, qbUserId: number) {
    const workerKey = `${projectId}:${qbUserId}`;
    if (expandedWorkerKey === workerKey) {
      setExpandedWorkerKey(null);
      return;
    }

    setExpandedWorkerKey(workerKey);
    if (dayRowsByWorkerKey[workerKey]) {
      return;
    }

    setDayLoadingWorkerKey(workerKey);
    setDayErrorByWorkerKey((current) => {
      const next = { ...current };
      delete next[workerKey];
      return next;
    });

    try {
      const params = new URLSearchParams({
        project_id: projectId,
        qb_user_id: String(qbUserId),
        start_date: selectedRange.startDate,
        end_date: selectedRange.endDate,
      });
      const response = await fetch(`/api/time/project-hours?${params.toString()}`, { credentials: "include" });
      const json = (await response.json()) as ProjectWorkerDayResponse & { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Unable to load daily worker hours.");
      }

      setDayRowsByWorkerKey((current) => ({
        ...current,
        [workerKey]: json.rows,
      }));
    } catch (err) {
      setDayErrorByWorkerKey((current) => ({
        ...current,
        [workerKey]: err instanceof Error ? err.message : "Unable to load daily worker hours.",
      }));
    } finally {
      setDayLoadingWorkerKey((current) => (current === workerKey ? null : current));
    }
  }

  return (
    <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Project Hours</p>
          <h2 className="mt-2 text-xl font-semibold text-text-primary">Portal-mapped project hours</h2>
          <p className="mt-2 text-sm text-text-secondary">{rangeLabel}</p>
        </div>
      </div>

      <TimeRangePicker
        value={selectedRange}
        preset={selectedPreset}
        onChange={({ range, preset }) => {
          setSelectedRange(range);
          setSelectedPreset(preset);
          setWorkerRowsByProjectId({});
          setDayRowsByWorkerKey({});
          setExpandedProjectId(null);
          setExpandedWorkerKey(null);
          setDetailErrorByProjectId({});
          setDayErrorByWorkerKey({});
          setDetailLoadingProjectId(null);
          setDayLoadingWorkerKey(null);
        }}
      />

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
        <p className="mt-5 text-sm text-text-tertiary">No hours logged in this date range.</p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border-default">
          <table className="min-w-full divide-y divide-border-default text-sm">
            <thead className="bg-surface-overlay text-left text-text-tertiary">
              <tr>
                <th className="px-4 py-3 font-medium">Project Name</th>
                <th className="px-4 py-3 font-medium">Hours</th>
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
                          ) : workerRows.length === 0 ? (
                            <p className="text-sm text-text-tertiary">No worker breakdown found for this project.</p>
                          ) : (
                            <div className="space-y-2">
                              {workerRows.map((worker) => {
                                const workerKey = `${row.project_id}:${worker.qb_user_id}`;
                                const dayRows = dayRowsByWorkerKey[workerKey] ?? [];
                                const dayError = dayErrorByWorkerKey[workerKey];
                                const dayLoading = dayLoadingWorkerKey === workerKey;

                                return (
                                  <Fragment key={workerKey}>
                                    <button
                                      type="button"
                                      onClick={() => void toggleWorker(row.project_id, worker.qb_user_id)}
                                      className="flex w-full items-center justify-between rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-left"
                                    >
                                      <span className="font-medium text-text-primary">{worker.display_name}</span>
                                      <span>{formatHours(worker.total_hours)} hrs</span>
                                    </button>
                                    {expandedWorkerKey === workerKey && (
                                      <div className="ml-4 mt-2 space-y-2 rounded-xl border border-border-default bg-surface-raised p-3">
                                        {dayLoading ? (
                                          Array.from({ length: 2 }).map((_, index) => (
                                            <div
                                              key={index}
                                              className="h-9 animate-pulse rounded-lg border border-border-default bg-surface-overlay"
                                            />
                                          ))
                                        ) : dayError ? (
                                          <p className="text-sm text-rose-300">{dayError}</p>
                                        ) : dayRows.length === 0 ? (
                                          <p className="text-sm text-text-tertiary">No daily postings found.</p>
                                        ) : (
                                          dayRows.map((day) => (
                                            <div
                                              key={day.work_date}
                                              className="flex items-center justify-between rounded-lg border border-border-default bg-surface-overlay px-3 py-2"
                                            >
                                              <span className="text-text-primary">{formatDate(day.work_date)}</span>
                                              <span>{formatHours(day.total_hours)} hrs</span>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </Fragment>
                                );
                              })}
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

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { TimeRangePicker } from "@/components/time/time-range-picker";
import { getPresetRange, type TimeRange, type TimeRangePreset } from "@/lib/time/date-range";
import type { EmployeeHoursRow, EmployeeProjectHoursRow, TimeDayHoursRow } from "@/types/database";

type EmployeeHoursResponse = {
  startDate: string;
  endDate: string;
  rows: EmployeeHoursRow[];
};

type EmployeeProjectHoursResponse = {
  startDate: string;
  endDate: string;
  qbUserId: number;
  rows: EmployeeProjectHoursRow[];
};

type EmployeeProjectDayResponse = {
  startDate: string;
  endDate: string;
  qbUserId: number;
  projectKey: string;
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

export function EmployeeHoursSection() {
  const defaultRange = useMemo(() => getPresetRange("current_week"), []);
  const [selectedRange, setSelectedRange] = useState<TimeRange>(defaultRange);
  const [selectedPreset, setSelectedPreset] = useState<TimeRangePreset>("current_week");
  const [data, setData] = useState<EmployeeHoursResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [expandedProjectKey, setExpandedProjectKey] = useState<string | null>(null);
  const [projectRowsByUserId, setProjectRowsByUserId] = useState<Record<number, EmployeeProjectHoursRow[]>>({});
  const [dayRowsByProjectKey, setDayRowsByProjectKey] = useState<Record<string, TimeDayHoursRow[]>>({});
  const [detailLoadingUserId, setDetailLoadingUserId] = useState<number | null>(null);
  const [dayLoadingProjectKey, setDayLoadingProjectKey] = useState<string | null>(null);
  const [detailErrorByUserId, setDetailErrorByUserId] = useState<Record<number, string>>({});
  const [dayErrorByProjectKey, setDayErrorByProjectKey] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadEmployeeHours() {
      setLoading(true);
      setError(null);
      setExpandedUserId(null);
      setExpandedProjectKey(null);

      try {
        const params = new URLSearchParams({
          start_date: selectedRange.startDate,
          end_date: selectedRange.endDate,
        });
        const response = await fetch(`/api/time/employee-hours?${params.toString()}`, { credentials: "include" });
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
  }, [selectedRange.endDate, selectedRange.startDate]);

  const rangeLabel = useMemo(() => {
    if (!data) {
      return formatRangeLabel(selectedRange.startDate, selectedRange.endDate);
    }

    return formatRangeLabel(data.startDate, data.endDate);
  }, [data, selectedRange.endDate, selectedRange.startDate]);

  async function toggleEmployee(qbUserId: number) {
    if (expandedUserId === qbUserId) {
      setExpandedUserId(null);
      setExpandedProjectKey(null);
      return;
    }

    setExpandedUserId(qbUserId);
    setExpandedProjectKey(null);

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
      const params = new URLSearchParams({
        qb_user_id: String(qbUserId),
        start_date: selectedRange.startDate,
        end_date: selectedRange.endDate,
      });
      const response = await fetch(`/api/time/employee-hours?${params.toString()}`, {
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

  async function toggleProject(qbUserId: number, projectKey: string) {
    const expansionKey = `${qbUserId}:${projectKey}`;
    if (expandedProjectKey === expansionKey) {
      setExpandedProjectKey(null);
      return;
    }

    setExpandedProjectKey(expansionKey);
    if (dayRowsByProjectKey[expansionKey]) {
      return;
    }

    setDayLoadingProjectKey(expansionKey);
    setDayErrorByProjectKey((current) => {
      const next = { ...current };
      delete next[expansionKey];
      return next;
    });

    try {
      const params = new URLSearchParams({
        qb_user_id: String(qbUserId),
        project_key: projectKey,
        start_date: selectedRange.startDate,
        end_date: selectedRange.endDate,
      });
      const response = await fetch(`/api/time/employee-hours?${params.toString()}`, {
        credentials: "include"
      });
      const json = (await response.json()) as EmployeeProjectDayResponse & { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Unable to load daily project hours.");
      }

      setDayRowsByProjectKey((current) => ({
        ...current,
        [expansionKey]: json.rows,
      }));
    } catch (err) {
      setDayErrorByProjectKey((current) => ({
        ...current,
        [expansionKey]: err instanceof Error ? err.message : "Unable to load daily project hours.",
      }));
    } finally {
      setDayLoadingProjectKey((current) => (current === expansionKey ? null : current));
    }
  }

  return (
    <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Employee Hours</p>
        <h2 className="mt-2 text-xl font-semibold text-text-primary">Employee hours breakdown</h2>
        <p className="mt-2 text-sm text-text-secondary">{rangeLabel}</p>
      </div>

      <TimeRangePicker
        value={selectedRange}
        preset={selectedPreset}
        onChange={({ range, preset }) => {
          setSelectedRange(range);
          setSelectedPreset(preset);
          setProjectRowsByUserId({});
          setDayRowsByProjectKey({});
          setExpandedUserId(null);
          setExpandedProjectKey(null);
          setDetailErrorByUserId({});
          setDayErrorByProjectKey({});
          setDetailLoadingUserId(null);
          setDayLoadingProjectKey(null);
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
        <p className="mt-5 text-sm text-text-tertiary">No hours data in this date range.</p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border-default">
          <table className="min-w-full divide-y divide-border-default text-sm">
            <thead className="bg-surface-overlay text-left text-text-tertiary">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Hours</th>
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
                              {projectRows.map((project, index) => {
                                const projectKey = project.project_key ?? project.project_id ?? `row-${index}`;
                                const expansionKey = `${row.qb_user_id}:${projectKey}`;
                                const dayRows = dayRowsByProjectKey[expansionKey] ?? [];
                                const dayError = dayErrorByProjectKey[expansionKey];
                                const dayLoading = dayLoadingProjectKey === expansionKey;

                                return (
                                  <Fragment key={expansionKey}>
                                    <button
                                      type="button"
                                      onClick={() => void toggleProject(row.qb_user_id, projectKey)}
                                      className="flex w-full items-center justify-between rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-left"
                                    >
                                      <span className="font-medium text-text-primary">{project.project_name}</span>
                                      <span>{formatHours(project.total_hours)} hrs</span>
                                    </button>
                                    {expandedProjectKey === expansionKey && (
                                      <div className="ml-4 mt-2 space-y-2 rounded-xl border border-border-default bg-surface-raised p-3">
                                        {dayLoading ? (
                                          Array.from({ length: 2 }).map((_, detailIndex) => (
                                            <div
                                              key={detailIndex}
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

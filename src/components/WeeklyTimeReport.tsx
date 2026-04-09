'use client';

import { useEffect, useState } from 'react';
import { addWeeks, endOfWeek, format, startOfWeek, subWeeks } from 'date-fns';

interface Project {
  id: string;
  name: string;
  customer_id: string;
  customers?: {
    name: string;
  } | null;
}

interface TimeEntry {
  id: string;
  employee_name: string;
  work_date: string;
  hours: number;
  system_category: string;
  notes: string;
  approved: boolean;
}

interface WeeklyReport {
  week_of: string;
  project_id: string;
  summary: {
    num_employees: number;
    total_hours: number;
    num_entries: number;
    fully_approved: boolean;
  } | null;
  time_entries: TimeEntry[];
  approval: unknown;
}

interface WeeklyTimeReportProps {
  projects: Project[];
  userRole?: string;
}

type NoticeState =
  | {
      type: 'error';
      text: string;
    }
  | null;

const fieldClassName =
  'w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none';

function toMonday(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

function StateChip({
  label,
  tone
}: {
  label: string;
  tone: 'success' | 'warn' | 'info';
}) {
  const classes =
    tone === 'success'
      ? 'bg-emerald-100 text-emerald-800'
      : tone === 'warn'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-sky-100 text-sky-800';

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${classes}`}>
      {label}
    </span>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function ChevronButton({
  direction,
  onClick
}: {
  direction: 'prev' | 'next';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-text-primary hover:border-brand-primary"
      aria-label={direction === 'prev' ? 'Previous week' : 'Next week'}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        {direction === 'prev' ? <path d="m15 6-6 6 6 6" /> : <path d="m9 6 6 6-6 6" />}
      </svg>
    </button>
  );
}

export default function WeeklyTimeReport({ projects, userRole }: WeeklyTimeReportProps) {
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(format(toMonday(new Date()), 'yyyy-MM-dd'));
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);

  const selectedWeekDate = toMonday(new Date(selectedWeek));
  const weekLabel = `${format(selectedWeekDate, 'EEE MMM d')} – ${format(endOfWeek(selectedWeekDate, { weekStartsOn: 1 }), 'EEE MMM d')}`;

  const loadReport = async () => {
    if (!selectedProject) {
      setReport(null);
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/time/weekly-report?projectId=${selectedProject}&weekOf=${selectedWeek}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load weekly report.');
      }

      setReport(data);
    } catch (error) {
      setReport(null);
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to load weekly report.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, [selectedProject, selectedWeek]);

  const handleApprove = async () => {
    if (!selectedProject) return;

    setApproving(true);
    setNotice(null);

    try {
      const response = await fetch('/api/time/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: selectedProject,
          week_of: selectedWeek,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve time.');
      }

      await loadReport();
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to approve time.'
      });
    } finally {
      setApproving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Weekly Report</p>
      <h2 className="mt-2 text-2xl font-semibold text-text-primary">Review project time</h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">
        Review weekly entries, totals, and approval state for the selected project.
      </p>

      {projects.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-border-default bg-surface-overlay px-4 py-5 text-center text-sm text-text-secondary">
          No projects are assigned to your account yet.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="project" className="text-sm font-medium text-text-primary">
                Project
              </label>
              <select
                id="project"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className={`${fieldClassName} mt-2`}
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.customers?.name ? `${project.customers.name} - ` : ''}{project.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-text-primary">Week</label>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-border-default bg-surface-overlay px-3 py-2">
                <ChevronButton
                  direction="prev"
                  onClick={() => setSelectedWeek(format(subWeeks(selectedWeekDate, 1), 'yyyy-MM-dd'))}
                />
                <div className="min-w-[180px] text-center text-sm font-medium text-text-primary">{weekLabel}</div>
                <ChevronButton
                  direction="next"
                  onClick={() => setSelectedWeek(format(addWeeks(selectedWeekDate, 1), 'yyyy-MM-dd'))}
                />
              </div>
            </div>
          </div>

          {loading && (
            <p className="rounded-2xl border border-border-default bg-surface-overlay px-4 py-3 text-sm text-text-secondary">
              Loading report...
            </p>
          )}

          {notice?.type === 'error' && (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {notice.text}
            </p>
          )}

          {report && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Employees" value={String(report.summary?.num_employees ?? 0)} />
                <MetricCard label="Total Hours" value={String(report.summary?.total_hours ?? 0)} />
                <MetricCard label="Entries" value={String(report.summary?.num_entries ?? report.time_entries.length)} />
                <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">Status</p>
                  <div className="mt-3">
                    <StateChip
                      label={report.summary?.fully_approved ? 'Approved' : 'Pending'}
                      tone={report.summary?.fully_approved ? 'success' : 'warn'}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {report.time_entries.length === 0 ? (
                  <div className="rounded-2xl border border-border-default bg-surface-overlay px-4 py-5 text-center text-sm text-text-secondary">
                    No time entries for this week.
                  </div>
                ) : (
                  report.time_entries.map((entry) => (
                    <article key={entry.id} className="rounded-2xl border border-border-default bg-surface-overlay p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-text-primary">{entry.employee_name}</h3>
                            {entry.system_category && <StateChip label={entry.system_category} tone="info" />}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
                            <span>{format(new Date(entry.work_date), 'EEE, MMM d')}</span>
                            <span>{entry.hours} hours</span>
                          </div>
                          {entry.notes && <p className="text-sm leading-6 text-text-secondary">{entry.notes}</p>}
                        </div>
                        <div className="shrink-0">
                          <StateChip label={entry.approved ? 'Approved' : 'Pending'} tone={entry.approved ? 'success' : 'warn'} />
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>

              {(userRole === 'pm' || userRole === 'admin') && report.time_entries.length > 0 && !report.summary?.fully_approved && (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:opacity-60"
                >
                  {approving ? 'Approving...' : 'Approve All Time Entries'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { ViewReportLink } from "@/components/view-report-link";
import { formatWeekEndingSaturday } from "@/lib/utils/week-ending";
import type { CustomerFeedback, PortalFeedback } from "@/types/database";

export function FeedbackTab() {
  const supabase = createClient();
  const [section, setSection] = useState<"customer" | "team">("customer");
  const [feedback, setFeedback] = useState<
    Array<
      CustomerFeedback & {
        project?: { name: string } | { name: string }[] | null;
        profile?: { email: string } | { email: string }[] | null;
      }
    >
  >([]);
  const [teamFeedback, setTeamFeedback] = useState<
    Array<
      PortalFeedback & {
        profile?: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
      }
    >
  >([]);
  const [loading, setLoading] = useState(true);
  const [showUnreviewedOnly, setShowUnreviewedOnly] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [teamTypeFilter, setTeamTypeFilter] = useState("all");
  const [teamStatusFilter, setTeamStatusFilter] = useState("all");
  const customerUnreviewedCount = feedback.filter((item) => !item.reviewed).length;
  const teamNewCount = teamFeedback.filter((item) => item.status === "new").length;

  useEffect(() => {
    void loadFeedback();
  }, [showUnreviewedOnly]);

  useEffect(() => {
    void loadTeamFeedback();
  }, []);

  async function loadFeedback() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/data?section=feedback&unreviewedOnly=${showUnreviewedOnly ? "true" : "false"}`, {
        credentials: "include",
      });
      const json = await readJsonSafely(res);
      if (!res.ok) {
        setFeedback([]);
      } else {
        setFeedback((json?.feedback as typeof feedback) ?? []);
      }
    } catch {
      setFeedback([]);
    }
    setLoading(false);
  }

  async function loadTeamFeedback() {
    try {
      const res = await fetch("/api/feedback", {
        credentials: "include",
      });
      const json = await readJsonSafely(res);
      if (!res.ok) {
        setTeamFeedback([]);
      } else {
        setTeamFeedback((json?.feedback as typeof teamFeedback) ?? []);
      }
    } catch {
      setTeamFeedback([]);
    }
  }

  async function markReviewed(id: string) {
    setSavingId(id);
    const { error } = await supabase.from("customer_feedback").update({ reviewed: true }).eq("id", id);
    setSavingId(null);
    if (!error) {
      await loadFeedback();
    }
  }

  async function updateTeamStatus(id: string, status: string) {
    setSavingId(id);
    const res = await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, status }),
    });
    setSavingId(null);
    if (res.ok) {
      await loadTeamFeedback();
    }
  }

  const filteredTeamFeedback = teamFeedback.filter((item) => {
    if (teamTypeFilter !== "all" && item.type !== teamTypeFilter) return false;
    if (teamStatusFilter !== "all" && item.status !== teamStatusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-text-primary">Feedback Inbox</h2>
          <p className="text-sm text-text-secondary">
            Review customer questions and internal team suggestions in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "customer", label: "Customer Feedback" },
              { id: "team", label: "Team Feedback" },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
            className={[
                "rounded-full px-4 py-2 text-sm font-medium transition",
                section === id
                  ? "bg-brand-primary text-text-inverse"
                  : "border border-border-default bg-surface-raised text-text-secondary hover:bg-surface-overlay hover:text-text-primary",
              ].join(" ")}
            >
              <span className="inline-flex items-center gap-2">
                <span>{label}</span>
                {id === "customer" && customerUnreviewedCount > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-status-danger px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {customerUnreviewedCount}
                  </span>
                ) : null}
                {id === "team" && teamNewCount > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-status-danger px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    {teamNewCount}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>

      {section === "customer" ? (
        <>
          <label className="inline-flex items-center gap-3 rounded-xl border border-border-default bg-surface-raised px-4 py-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={showUnreviewedOnly}
              onChange={(event) => setShowUnreviewedOnly(event.target.checked)}
              className="h-4 w-4 accent-[var(--color-brand-primary)]"
            />
            Unreviewed only
          </label>

          {loading ? (
            <div className="py-10 text-center text-text-tertiary">Loading...</div>
          ) : feedback.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-default px-6 py-10 text-center text-sm text-text-secondary">
              No customer feedback found for the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border-default">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-surface-raised/80">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Project</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Customer Email</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Message</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Submitted</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.map((item) => {
                    const project = Array.isArray(item.project) ? item.project[0] : item.project;
                    const profile = Array.isArray(item.profile) ? item.profile[0] : item.profile;

                    return (
                      <tr key={item.id} className="border-b border-border-default align-top hover:bg-surface-raised">
                        <td className="px-4 py-3 text-text-primary">{project?.name ?? item.project_id}</td>
                        <td className="px-4 py-3 text-text-secondary">{profile?.email ?? item.profile_id}</td>
                        <td className="px-4 py-3 text-text-secondary">{item.message}</td>
                        <td className="px-4 py-3 text-text-secondary">{format(new Date(item.submitted_at), "MMM d, yyyy h:mm a")}</td>
                        <td className="px-4 py-3 text-right">
                          {item.reviewed ? (
                            <span className="inline-flex rounded-full bg-status-success/10 px-2.5 py-0.5 text-xs font-medium text-status-success">
                              Reviewed
                            </span>
                          ) : (
                            <button
                              onClick={() => void markReviewed(item.id)}
                              disabled={savingId === item.id}
                              className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingId === item.id ? "Saving..." : "Mark Reviewed"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <select
              value={teamTypeFilter}
              onChange={(event) => setTeamTypeFilter(event.target.value)}
              className="rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="bug">Bug Reports</option>
              <option value="feature">Feature Ideas</option>
              <option value="ux">UX Issues</option>
              <option value="other">Other</option>
            </select>
            <select
              value={teamStatusFilter}
              onChange={(event) => setTeamStatusFilter(event.target.value)}
              className="rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="reviewing">Reviewing</option>
              <option value="planned">Planned</option>
              <option value="done">Done</option>
              <option value="wont_fix">Won&apos;t Fix</option>
            </select>
          </div>

          {filteredTeamFeedback.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-default px-6 py-10 text-center text-sm text-text-secondary">
              No team feedback found for the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border-default">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-surface-raised/80">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Type</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Title</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Description</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Priority</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Page/Area</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Submitted By</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeamFeedback.map((item) => {
                    const profile = Array.isArray(item.profile) ? item.profile[0] : item.profile;
                    const submittedBy = profile?.full_name || profile?.email || item.submitted_by;

                    return (
                      <tr key={item.id} className="border-b border-border-default align-top hover:bg-surface-raised">
                        <td className="px-4 py-3 text-text-secondary">{TEAM_TYPE_LABELS[item.type]}</td>
                        <td className="px-4 py-3 font-medium text-text-primary">{item.title}</td>
                        <td className="px-4 py-3 text-text-secondary">{item.description}</td>
                        <td className="px-4 py-3 text-text-secondary">{TEAM_PRIORITY_LABELS[item.priority]}</td>
                        <td className="px-4 py-3 text-text-secondary">{item.page_area || "-"}</td>
                        <td className="px-4 py-3 text-text-secondary">{submittedBy}</td>
                        <td className="px-4 py-3 text-text-secondary">{format(new Date(item.created_at), "MMM d, yyyy h:mm a")}</td>
                        <td className="px-4 py-3">
                          <select
                            value={item.status}
                            onChange={(event) => void updateTeamStatus(item.id, event.target.value)}
                            disabled={savingId === item.id}
                            className="rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none disabled:opacity-60"
                          >
                            <option value="new">New</option>
                            <option value="reviewing">Reviewing</option>
                            <option value="planned">Planned</option>
                            <option value="done">Done</option>
                            <option value="wont_fix">Won&apos;t Fix</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const TEAM_TYPE_LABELS: Record<PortalFeedback["type"], string> = {
  bug: "Bug Report",
  feature: "Feature Idea",
  ux: "UX Issue",
  other: "Other",
};

const TEAM_PRIORITY_LABELS: Record<PortalFeedback["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

async function readJsonSafely(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const bodyText = await response.text();
  if (!contentType.includes("application/json") || !bodyText) return null;

  try {
    return JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    return null;
  }
}

type WeeklyUpdatesAdminRow = {
  id: string;
  week_of: string;
  pct_complete: number | null;
  blockers: string | null;
  status: "draft" | "submitted";
  submitted_at: string | null;
  project?: {
    name: string;
    customer?: { name: string } | Array<{ name: string }> | null;
    project_assignments?: Array<{
      role_on_project?: string | null;
      profile?: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }> | null;
      pm_directory?:
        | { first_name?: string | null; last_name?: string | null; email?: string | null }
        | Array<{ first_name?: string | null; last_name?: string | null; email?: string | null }>
        | null;
    }>;
  } | Array<{
    name: string;
    customer?: { name: string } | Array<{ name: string }> | null;
    project_assignments?: Array<{
      role_on_project?: string | null;
      profile?: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }> | null;
      pm_directory?:
        | { first_name?: string | null; last_name?: string | null; email?: string | null }
        | Array<{ first_name?: string | null; last_name?: string | null; email?: string | null }>
        | null;
    }>;
  }> | null;
  pm?: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }> | null;
};

export function WeeklyUpdatesTab() {
  const [updates, setUpdates] = useState<WeeklyUpdatesAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [blockersOnly, setBlockersOnly] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  useEffect(() => {
    void loadUpdates();
  }, []);

  async function loadUpdates() {
    setLoading(true);
    const res = await fetch("/api/admin/data?section=weekly-updates", {
      credentials: "include",
    });
    const json = await readJsonSafely(res);

    if (!res.ok) {
      setUpdates([]);
    } else {
      setUpdates((json?.updates as WeeklyUpdatesAdminRow[]) ?? []);
    }

    setLoading(false);
  }

  async function handleDelete(updateId: string) {
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/weekly-update", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ updateId }),
      });
      if (res.ok) {
        setUpdates((prev) => prev.filter((u) => u.id !== updateId));
      }
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  const filteredUpdates = updates.filter((update) => {
    const project = Array.isArray(update.project) ? update.project[0] : update.project;
    const projectName = project?.name ?? "";
    const hasBlockers = Boolean(update.blockers?.trim());

    if (blockersOnly && !hasBlockers) return false;
    if (search.trim()) {
      return projectName.toLowerCase().includes(search.trim().toLowerCase());
    }
    return true;
  });

  const groupedByProject = useMemo(() => {
    const map = new Map<string, { projectName: string; updates: typeof filteredUpdates }>();
    for (const update of filteredUpdates) {
      const project = Array.isArray(update.project) ? update.project[0] : update.project;
      const name = project?.name ?? "Unknown Project";
      if (!map.has(name)) map.set(name, { projectName: name, updates: [] });
      map.get(name)?.updates.push(update);
    }
    return Array.from(map.values()).sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [filteredUpdates]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-text-primary">Weekly Updates</h2>
          <p className="text-sm text-text-secondary">
            Review draft and submitted field activity across all projects.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search project name"
            className="w-64 rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
          />
          <label className="inline-flex items-center gap-3 rounded-xl border border-border-default bg-surface-raised px-4 py-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={blockersOnly}
              onChange={(event) => setBlockersOnly(event.target.checked)}
              className="h-4 w-4 accent-[var(--color-brand-primary)]"
            />
            Blockers only
          </label>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-text-tertiary">Loading...</div>
      ) : filteredUpdates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-default px-6 py-10 text-center text-sm text-text-secondary">
          No weekly updates match the current filters.
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByProject.map(({ projectName, updates }) => (
            <div key={projectName} className="overflow-hidden rounded-2xl border border-border-default">
              <button
                type="button"
                onClick={() => setExpandedProject(expandedProject === projectName ? null : projectName)}
                className="flex w-full items-center justify-between border-b border-border-default bg-surface-raised px-4 py-3 text-left hover:bg-surface-overlay/60"
              >
                <div>
                  <span className="font-semibold text-text-primary">{projectName}</span>
                  <span className="ml-2 text-xs text-text-tertiary">
                    {updates.length} update{updates.length === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="text-xs text-text-tertiary">{expandedProject === projectName ? "Hide" : "Show"}</span>
              </button>

              {expandedProject === projectName && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-default bg-surface-raised/60">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Week Ending</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">PM</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">% Complete</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">Blockers</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Submitted At</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Report</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {updates.map((update) => {
                const project = Array.isArray(update.project) ? update.project[0] : update.project;
                const pm = Array.isArray(update.pm) ? update.pm[0] : update.pm;
                const primaryAssignment = (project?.project_assignments ?? []).find((assignment) => assignment?.role_on_project === "pm");
                const assignmentProfile = Array.isArray(primaryAssignment?.profile) ? primaryAssignment?.profile[0] : primaryAssignment?.profile;
                const assignmentDirectory = Array.isArray(primaryAssignment?.pm_directory) ? primaryAssignment?.pm_directory[0] : primaryAssignment?.pm_directory;
                const assignmentDirectoryName = [assignmentDirectory?.first_name, assignmentDirectory?.last_name].filter(Boolean).join(" ").trim();
                const pmName =
                  pm?.full_name?.trim() ||
                  assignmentProfile?.full_name?.trim() ||
                  assignmentDirectoryName ||
                  assignmentDirectory?.email ||
                  pm?.email ||
                  "-";
                const hasBlockers = Boolean(update.blockers?.trim());
                const isConfirming = confirmDeleteId === update.id;

                return (
                  <tr key={update.id} className="border-b border-border-default hover:bg-surface-raised">
                    <td className="px-4 py-3 text-text-secondary">{formatWeekEndingSaturday(update.week_of, "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 text-text-secondary">{pmName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          update.status === "draft"
                            ? "bg-status-warning/10 text-status-warning"
                            : "bg-status-success/10 text-status-success",
                        ].join(" ")}
                      >
                        {update.status === "draft" ? "Draft" : "Submitted"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-text-primary">
                      {update.pct_complete !== null ? `${(update.pct_complete * 100).toFixed(1)}%` : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                          hasBlockers
                            ? "bg-status-danger/10 text-status-danger"
                            : "bg-status-success/10 text-status-success",
                        ].join(" ")}
                      >
                        {hasBlockers ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {update.submitted_at ? format(new Date(update.submitted_at), "MMM d, yyyy h:mm a") : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {update.status === "submitted" ? <ViewReportLink updateId={update.id} /> : <span className="text-xs text-text-tertiary">Draft only</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isConfirming ? (
                        <span className="inline-flex items-center gap-1">
                          <button
                            onClick={() => void handleDelete(update.id)}
                            disabled={deleting}
                            className="rounded-lg bg-status-danger px-2 py-1 text-xs font-semibold text-white hover:opacity-80 disabled:opacity-50"
                          >
                            {deleting ? "..." : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-lg bg-surface-overlay px-2 py-1 text-xs text-text-secondary hover:bg-surface-overlay"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(update.id)}
                          className="rounded-lg px-2 py-1 text-xs text-text-tertiary hover:bg-status-danger/10 hover:text-status-danger"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { format, startOfWeek } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import type { BillingPeriod, ProjectAssignmentRole, WeeklyUpdate } from "@/types/database";

type ViewState = "list" | "update";

interface ProjectWithBilling {
  id: string;
  customer_id: string | null;
  pm_id: string | null;
  name: string;
  estimated_income: number;
  onedrive_path: string | null;
  sharepoint_folder: string | null;
  sharepoint_item_id: string | null;
  job_number: string | null;
  migration_status: "legacy" | "migrated" | "clean" | null;
  is_active: boolean;
  created_at: string;
  assignmentRole: ProjectAssignmentRole;
  customer?: { name: string } | null;
  current_period?: BillingPeriod;
}

export default function PmPage() {
  const supabase = createClient();
  const [view, setView] = useState<ViewState>("list");
  const [projects, setProjects] = useState<ProjectWithBilling[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectWithBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          await loadProjects(user.id);
        } else {
          setProjects([]);
          setLoading(false);
        }
      } catch {
        setProjects([]);
        setLoading(false);
      }
    }

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProjects(profileId: string) {
    const currentMonth = format(new Date(), "yyyy-MM-01");

    try {
      const { data: assignmentData } = await supabase
        .from("project_assignments")
        .select(`
          role_on_project,
          project:projects(
            id,
            customer_id,
            pm_id,
            name,
            estimated_income,
            onedrive_path,
            sharepoint_folder,
            sharepoint_item_id,
            job_number,
            migration_status,
            is_active,
            created_at,
            customer:customers(name)
          )
        `)
        .eq("profile_id", profileId)
        .in("role_on_project", ["pm", "lead"]);

      const normalizedProjects = (((assignmentData ?? []) as Array<{
        role_on_project: ProjectAssignmentRole;
        project:
          | {
              id: string;
              customer_id: string | null;
              pm_id: string | null;
              name: string;
              estimated_income: number;
              onedrive_path: string | null;
              sharepoint_folder: string | null;
              sharepoint_item_id: string | null;
              job_number: string | null;
              migration_status: "legacy" | "migrated" | "clean" | null;
              is_active: boolean;
              created_at: string;
              customer?: { name: string } | Array<{ name: string }> | null;
            }
          | Array<{
              id: string;
              customer_id: string | null;
              pm_id: string | null;
              name: string;
              estimated_income: number;
              onedrive_path: string | null;
              sharepoint_folder: string | null;
              sharepoint_item_id: string | null;
              job_number: string | null;
              migration_status: "legacy" | "migrated" | "clean" | null;
              is_active: boolean;
              created_at: string;
              customer?: { name: string } | Array<{ name: string }> | null;
            }>;
      }>)
        .map((assignment) => {
          const project = Array.isArray(assignment.project) ? assignment.project[0] : assignment.project;
          if (!project || project.is_active === false) return null;
          const customer = Array.isArray(project.customer) ? project.customer[0] : project.customer;
          return {
            ...project,
            assignmentRole: assignment.role_on_project,
            customer: customer ?? null,
          };
        })
        .filter(Boolean) as ProjectWithBilling[])
        .sort((a, b) => a.name.localeCompare(b.name));

      if (!normalizedProjects.length) {
        setProjects([]);
        return;
      }

      const ids = normalizedProjects.map((project) => project.id);
      const { data: periods } = await supabase
        .from("billing_periods")
        .select("*")
        .in("project_id", ids)
        .eq("period_month", currentMonth);

      const periodMap = new Map((periods ?? []).map((period) => [period.project_id, period]));
      setProjects(normalizedProjects.map((project) => ({ ...project, current_period: periodMap.get(project.id) })));
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <CenteredMsg>Loading your projects...</CenteredMsg>;
  }

  return (
    <div className="min-h-screen bg-surface-base text-text-primary">
      <main className="mx-auto max-w-4xl px-6 py-6">
        {view === "list" ? (
          <ProjectList
            projects={projects}
            onSelectProject={(project) => {
              setSelectedProject(project);
              setView("update");
            }}
          />
        ) : selectedProject ? (
          <UpdateForm
            project={selectedProject}
            pmId={userId!}
            onBack={() => {
              setView("list");
              setSelectedProject(null);
              if (userId) void loadProjects(userId);
            }}
          />
        ) : null}
      </main>
    </div>
  );
}

function ProjectList({
  projects,
  onSelectProject,
}: {
  projects: ProjectWithBilling[];
  onSelectProject: (project: ProjectWithBilling) => void;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const roleBadgeStyles: Record<ProjectAssignmentRole, string> = {
    pm: "bg-status-info/10 text-status-info border-status-info/20",
    lead: "bg-status-warning/10 text-status-warning border-status-warning/20",
    installer: "bg-brand-primary/10 text-brand-primary border-brand-primary/20",
    ops_manager: "bg-surface-overlay text-text-primary border-border-default",
  };

  const roleLabels: Record<ProjectAssignmentRole, string> = {
    pm: "PM",
    lead: "Lead",
    installer: "Installer",
    ops_manager: "Ops Manager",
  };

  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-default p-12 text-center">
        <p className="text-text-secondary">No active projects assigned to you as a PM or lead.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">My Projects</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {projects.length} active project{projects.length !== 1 ? "s" : ""} - click to submit a weekly update.
        </p>
      </div>

      {projects.map((project) => {
        const period = project.current_period;
        const pct = period ? period.pct_complete * 100 : null;
        const toBill = period
          ? Math.max(period.estimated_income_snapshot * period.pct_complete - period.prev_billed, 0)
          : null;

        let statusColor = "bg-status-success/10 text-status-success border-status-success/20";
        let statusLabel = "On Track";
        if (period) {
          if (period.pct_complete >= 1) {
            statusColor = "bg-surface-overlay/50 text-text-secondary border-border-strong";
            statusLabel = "Complete";
          } else if (period.pct_complete < period.prior_pct) {
            statusColor = "bg-status-danger/10 text-status-danger border-status-danger/20";
            statusLabel = "Behind";
          }
        }

        return (
          <button
            key={project.id}
            onClick={() => onSelectProject(project)}
            className="w-full rounded-2xl border border-border-default bg-surface-raised p-5 text-left transition hover:border-status-success/30 hover:bg-surface-overlay"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-text-primary">{project.name}</p>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${roleBadgeStyles[project.assignmentRole]}`}>
                    {roleLabels[project.assignmentRole]}
                  </span>
                  {project.migration_status === "legacy" && (
                    <span className="inline-flex items-center rounded border border-status-warning/20 bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning">
                      Legacy
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-text-secondary">{project.customer?.name}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                {statusLabel}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Est. Income" value={fmt(project.estimated_income)} />
              <Stat label="% Complete" value={pct !== null ? `${pct.toFixed(1)}%` : "-"} />
              <Stat label="Prev. Billed" value={period ? fmt(period.prev_billed) : "-"} />
              <Stat label="To Bill" value={toBill !== null ? fmt(toBill) : "-"} highlight />
            </div>

            {period && (
              <div className="mt-3 overflow-hidden rounded-full bg-surface-overlay">
                <div
                  className="h-1.5 rounded-full bg-status-success transition-all"
                  style={{ width: `${Math.min(period.pct_complete * 100, 100)}%` }}
                />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function UpdateForm({
  project,
  pmId,
  onBack,
}: {
  project: ProjectWithBilling;
  pmId: string;
  onBack: () => void;
}) {
  const supabase = createClient();
  const thisMonday = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const [weekOf, setWeekOf] = useState(thisMonday);
  const [pctComplete, setPctComplete] = useState(project.current_period ? project.current_period.pct_complete * 100 : 0);
  const [notes, setNotes] = useState("");
  const [blockers, setBlockers] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recentUpdates, setRecentUpdates] = useState<WeeklyUpdate[]>([]);

  useEffect(() => {
    async function loadRecentUpdates() {
      try {
        const { data } = await supabase
          .from("weekly_updates")
          .select("*")
          .eq("project_id", project.id)
          .order("week_of", { ascending: false })
          .limit(4);

        setRecentUpdates((data as WeeklyUpdate[]) ?? []);
      } catch {
        setRecentUpdates([]);
      }
    }

    void loadRecentUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      const pctDecimal = Math.min(Math.max(pctComplete / 100, 0), 1);

      await supabase.from("weekly_updates").upsert({
        project_id: project.id,
        pm_id: pmId,
        week_of: weekOf,
        pct_complete: pctDecimal,
        notes: notes || null,
        blockers: blockers || null,
      }, { onConflict: "project_id,week_of" });

      if (project.current_period) {
        await supabase.from("billing_periods").update({ pct_complete: pctDecimal }).eq("id", project.current_period.id);
      }

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onBack();
      }, 1500);
    } catch {
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-status-success hover:text-status-success">
        &larr; Back to projects
      </button>

      <div className="rounded-2xl border border-status-success/20 bg-status-success/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-status-success">Weekly Update</p>
        <h2 className="mt-1 text-xl font-bold text-text-primary">{project.name}</h2>
        <p className="text-sm text-text-secondary">{project.customer?.name}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Week of</label>
          <input
            type="date"
            value={weekOf}
            onChange={(e) => setWeekOf(e.target.value)}
            className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm text-text-primary focus:border-status-success/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 flex items-center justify-between text-sm font-medium text-text-secondary">
            <span>Overall % Complete</span>
            <span className="text-lg font-bold text-status-success">{pctComplete.toFixed(1)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={pctComplete}
            onChange={(e) => setPctComplete(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-overlay accent-status-success"
          />
          <div className="mt-1 flex justify-between text-xs text-text-tertiary">
            <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
          </div>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={pctComplete}
            onChange={(e) => setPctComplete(Number(e.target.value))}
            className="mt-2 w-24 rounded-xl border border-border-default bg-surface-overlay px-3 py-1.5 text-sm text-text-primary focus:border-status-success/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">Work completed this week</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What was accomplished this week?"
            className="w-full rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-status-success/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-secondary">
            Blockers <span className="text-text-tertiary">(optional)</span>
          </label>
          <textarea
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            rows={2}
            placeholder="Issues, delays, or items needing admin attention?"
            className="w-full rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-status-success/50 focus:outline-none"
          />
        </div>

        {saved ? (
          <div className="rounded-xl bg-status-success/10 px-4 py-3 text-center text-sm font-medium text-status-success">
            Update saved!
          </div>
        ) : (
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-status-success px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:bg-status-success disabled:opacity-50"
          >
            {saving ? "Saving..." : "Submit Weekly Update"}
          </button>
        )}
      </form>

      {recentUpdates.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Recent Updates</h3>
          {recentUpdates.map((update) => (
            <div key={update.id} className="rounded-xl border border-border-default bg-surface-raised p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-tertiary">Week of {update.week_of}</span>
                {update.pct_complete !== null && (
                  <span className="text-sm font-semibold text-status-success">
                    {(update.pct_complete * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              {update.notes && <p className="mt-1.5 text-sm text-text-secondary">{update.notes}</p>}
              {update.blockers && <p className="mt-1 text-sm text-status-danger">Blocker: {update.blockers}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${highlight ? "text-brand-primary" : "text-text-primary"}`}>{value}</p>
    </div>
  );
}

function CenteredMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base text-text-secondary">
      {children}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import type { WeeklyUpdate, BillingPeriod } from "@/types/database";

interface CustomerProject {
  id: string;
  name: string;
  estimated_income: number;
  billing_periods: BillingPeriod[];
  weekly_updates: WeeklyUpdate[];
}

export default function CustomerPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<CustomerProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<CustomerProject | null>(null);

  useEffect(() => {
    loadProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProjects() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProjects([]);
        return;
      }

      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("contact_email", user.email)
        .single();

      if (!customer) {
        setProjects([]);
        return;
      }

      const { data: projectData } = await supabase
        .from("projects")
        .select("id, name, estimated_income")
        .eq("customer_id", customer.id)
        .eq("is_active", true)
        .order("name");

      if (!projectData?.length) {
        setProjects([]);
        return;
      }

      const ids = projectData.map((p) => p.id);

      const [{ data: periods }, { data: updates }] = await Promise.all([
        supabase
          .from("billing_periods")
          .select("*")
          .in("project_id", ids)
          .order("period_month", { ascending: false }),
        supabase
          .from("weekly_updates")
          .select("id, project_id, pm_id, week_of, pct_complete, notes, blockers, submitted_at")
          .in("project_id", ids)
          .order("week_of", { ascending: false })
          .limit(50),
      ]);

      const combined = projectData.map((p) => ({
        ...p,
        billing_periods: (periods ?? []).filter((bp) => bp.project_id === p.id),
        weekly_updates: (updates ?? []).filter((u) => u.project_id === p.id),
      }));

      setProjects(combined as CustomerProject[]);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base text-text-secondary">
        Loading your projects...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base text-text-primary">
      <header className="border-b border-border-default">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
              Customer Portal
            </p>
            <h1 className="text-lg font-bold text-text-primary">Project Updates</h1>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-6">
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-default p-12 text-center">
            <p className="text-text-secondary">No active projects found for your account.</p>
            <p className="mt-1 text-sm text-text-tertiary">Contact The Controls Company if you believe this is an error.</p>
          </div>
        ) : selectedProject ? (
          <ProjectDetail
            project={selectedProject}
            onBack={() => setSelectedProject(null)}
          />
        ) : (
          <ProjectList projects={projects} onSelect={setSelectedProject} />
        )}
      </main>
    </div>
  );
}

function ProjectList({
  projects,
  onSelect,
}: {
  projects: CustomerProject[];
  onSelect: (p: CustomerProject) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        {projects.length} active project{projects.length !== 1 ? "s" : ""}
      </p>
      {projects.map((p) => {
        const latestPeriod = p.billing_periods[0];
        const latestUpdate = p.weekly_updates[0];
        const pct = latestPeriod ? latestPeriod.pct_complete * 100 : null;

        return (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="w-full rounded-2xl border border-border-default bg-surface-raised p-5 text-left transition hover:border-brand-primary/30 hover:bg-surface-overlay"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="font-semibold text-text-primary">{p.name}</p>
              {pct !== null && (
                <span className="shrink-0 rounded-full bg-brand-primary/10 px-3 py-0.5 text-sm font-semibold text-brand-primary">
                  {pct.toFixed(0)}% complete
                </span>
              )}
            </div>

            {latestUpdate?.notes && (
              <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{latestUpdate.notes}</p>
            )}

            {latestPeriod && (
              <div className="mt-3 overflow-hidden rounded-full bg-surface-overlay">
                <div
                  className="h-1.5 rounded-full bg-brand-primary transition-all"
                  style={{ width: `${Math.min(latestPeriod.pct_complete * 100, 100)}%` }}
                />
              </div>
            )}

            {latestUpdate && (
              <p className="mt-2 text-xs text-text-tertiary">
                Last update: {format(new Date(latestUpdate.week_of), "MMM d, yyyy")}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ProjectDetail({
  project,
  onBack,
}: {
  project: CustomerProject;
  onBack: () => void;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD", maximumFractionDigits: 0,
    }).format(n);

  const [view, setView] = useState<"updates" | "billing">("updates");
  const latestPeriod = project.billing_periods[0];

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-brand-primary hover:text-brand-primary">
        &larr; Back to projects
      </button>

      <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-5">
        <h2 className="text-xl font-bold text-text-primary">{project.name}</h2>
        {latestPeriod && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Overall progress</span>
              <span className="font-semibold text-brand-primary">
                {(latestPeriod.pct_complete * 100).toFixed(1)}%
              </span>
            </div>
            <div className="overflow-hidden rounded-full bg-surface-overlay">
              <div
                className="h-2 rounded-full bg-brand-primary transition-all"
                style={{ width: `${Math.min(latestPeriod.pct_complete * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-border-default">
        {(["updates", "billing"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setView(t)}
            className={[
              "border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition",
              view === t
                ? "border-brand-primary text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            {t === "updates" ? "Weekly Updates" : "Billing History"}
          </button>
        ))}
      </div>

      {view === "updates" && (
        <div className="space-y-3">
          {project.weekly_updates.length === 0 ? (
            <p className="text-sm text-text-tertiary">No updates submitted yet.</p>
          ) : (
            project.weekly_updates.map((u) => (
              <div key={u.id} className="rounded-xl border border-border-default bg-surface-raised p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">
                    Week of {format(new Date(u.week_of), "MMM d, yyyy")}
                  </span>
                  {u.pct_complete !== null && (
                    <span className="text-sm font-semibold text-brand-primary">
                      {(u.pct_complete * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                {u.notes && <p className="mt-2 text-sm text-text-secondary">{u.notes}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {view === "billing" && (
        <div className="overflow-x-auto rounded-2xl border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-raised/80">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Period</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">% Complete</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Billed</th>
              </tr>
            </thead>
            <tbody>
              {project.billing_periods.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-text-tertiary">
                    No billing records yet.
                  </td>
                </tr>
              ) : (
                project.billing_periods.map((bp) => (
                  <tr key={bp.id} className="border-b border-border-default hover:bg-surface-raised">
                    <td className="px-4 py-2.5 text-text-primary">
                      {format(new Date(bp.period_month), "MMMM yyyy")}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-secondary">
                      {(bp.pct_complete * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right text-status-success">
                      {bp.actual_billed !== null ? fmt(bp.actual_billed) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SignOutButton() {
  const supabase = createClient();
  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
      }}
      className="rounded-full border border-border-default px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary"
    >
      Sign out
    </button>
  );
}

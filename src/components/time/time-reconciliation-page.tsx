"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  TimeEmployeesDirectorySection,
  TimeProjectsDirectorySection,
} from "@/components/time/time-module";
import { TimeSubnav } from "@/components/time/time-subnav";
import type {
  ProjectReconcileSnapshot,
  TimeModuleSnapshot,
  TimeReconcileSnapshot,
  WeeklyTimeSummary,
} from "@/lib/time/data";
import { TimeReconcileUsersPanel } from "@/components/time/time-reconcile-page";
import { TimeReconcileProjectsPanel } from "@/components/time/time-reconcile-projects-page";

type ReconciliationTab = "overview" | "employees" | "projects";

export function TimeReconciliationPage({
  moduleSnapshot,
  employeeSnapshot,
  projectSnapshot,
  weeklySummary,
  isAdmin,
  activeTab,
}: {
  moduleSnapshot: TimeModuleSnapshot;
  employeeSnapshot: TimeReconcileSnapshot;
  projectSnapshot: ProjectReconcileSnapshot;
  weeklySummary?: WeeklyTimeSummary | null;
  isAdmin?: boolean;
  activeTab: ReconciliationTab;
}) {
  return (
    <div className="space-y-6">
      <TimeSubnav />
      <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Reconciliation</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-text-primary">Match imported QB Time data to ProjectHub</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
          Review unmatched employees and jobcodes from QuickBooks Time, then map them to existing
          ProjectHub records without leaving the time module.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <TabLink href="/time/reconciliation?tab=overview" active={activeTab === "overview"}>
            Overview
          </TabLink>
          <TabLink href="/time/reconciliation?tab=employees" active={activeTab === "employees"}>
            Employees
          </TabLink>
          <TabLink href="/time/reconciliation?tab=projects" active={activeTab === "projects"}>
            Projects
          </TabLink>
        </div>
      </section>

      {activeTab === "overview" ? (
        <TimeReconciliationOverview
          snapshot={moduleSnapshot}
          weeklySummary={weeklySummary ?? null}
          isAdmin={isAdmin ?? false}
        />
      ) : activeTab === "projects" ? (
        <>
          <TimeProjectsDirectorySection projects={moduleSnapshot.projects} />
          <TimeReconcileProjectsPanel snapshot={projectSnapshot} />
        </>
      ) : (
        <>
          <TimeEmployeesDirectorySection users={moduleSnapshot.users} />
          <TimeReconcileUsersPanel snapshot={employeeSnapshot} />
        </>
      )}
    </div>
  );
}

function TimeReconciliationOverview({
  snapshot,
  weeklySummary,
  isAdmin,
}: {
  snapshot: TimeModuleSnapshot;
  weeklySummary: WeeklyTimeSummary | null;
  isAdmin: boolean;
}) {
  const activeUsers = snapshot.users.filter((user) => user.active).length;
  const activeProjects = snapshot.projects.filter((project) => project.active).length;
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncTimestamp, setSyncTimestamp] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/admin/sync-qb-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ days: 30 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      setSyncResult(
        `Sync complete — ${json.timesheetsImported} timesheets, ${json.usersImported} users, ${json.jobcodesImported} jobcodes imported.`
      );
      setSyncTimestamp(new Date().toISOString());
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="QB users" value={String(snapshot.users.length)} />
        <MetricCard label="Active users" value={String(activeUsers)} />
        <MetricCard label="QB jobcodes" value={String(snapshot.projects.length)} />
        <MetricCard label="Active jobcodes" value={String(activeProjects)} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Hours this week" value={weeklySummary ? weeklySummary.totalHours.toFixed(1) : "—"} />
        <MetricCard label="Workers active" value={weeklySummary ? String(weeklySummary.activeWorkers) : "—"} />
        <MetricCard label="Projects active" value={weeklySummary ? String(weeklySummary.activeProjects) : "—"} />
      </div>

      {isAdmin && (
        <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Data</p>
              <h2 className="mt-2 text-xl font-semibold text-text-primary">Sync QB Time</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                Pull the last 30 days of QuickBooks Time users, jobcodes, and timesheets into ProjectHub.
              </p>
              <p className="mt-2 text-xs text-text-tertiary">Syncs last 30 days of timesheets.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={syncing}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse transition hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync QB Time"}
            </button>
          </div>

          {syncResult && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <p>{syncResult}</p>
              {syncTimestamp && <p className="mt-1 text-xs text-emerald-700">Updated {formatDateTime(syncTimestamp)}</p>}
            </div>
          )}

          {syncError && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {syncError}
            </div>
          )}
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Next routes</p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <ActionCard href="/time/clock" title="Clock" description="Future clock in / out workflow." />
            <ActionCard href="/time/employees" title="Employees" description="Labor drilldowns by employee, project, and day." />
            <ActionCard href="/time/projects" title="Projects" description="Labor drilldowns by project, employee, and day." />
            <ActionCard href="/time/export" title="Export" description="Download QB Time entries for a project to Excel." />
          </div>
        </section>

        <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Merge status</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-text-secondary">
            <p>
              ProjectHub is the long-term home. The time data layer is being merged in so QuickBooks
              imports, portal users, and portal projects can line up in one database.
            </p>
            <p>
              During transition, the module can still fall back to the legacy TCC Time bridge if the
              merged tables are not available yet in this environment.
            </p>
            <p>
              Latest QuickBooks import:{" "}
              <span className="font-medium text-text-primary">
                {snapshot.latestRun
                  ? `${snapshot.latestRun.status} at ${formatDateTime(snapshot.latestRun.startedAt)}`
                  : "No import run found"}
              </span>
            </p>
          </div>
        </section>
      </div>
    </>
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

function ActionCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-border-default bg-surface-overlay p-4 transition hover:border-brand-primary">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
    </Link>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-brand-primary text-text-inverse"
          : "border border-border-default bg-surface-overlay text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </Link>
  );
}

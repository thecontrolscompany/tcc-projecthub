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
import type { QuickBooksTimeConnectionStatus } from "@/lib/qb-time/tokens";

type ReconciliationTab = "overview" | "employees" | "projects";

export function TimeReconciliationPage({
  moduleSnapshot,
  employeeSnapshot,
  projectSnapshot,
  weeklySummary,
  isAdmin,
  activeTab,
  qbTimeConnectionStatus,
  qbTimeOAuthState,
  qbTimeOAuthMessage,
}: {
  moduleSnapshot: TimeModuleSnapshot;
  employeeSnapshot: TimeReconcileSnapshot;
  projectSnapshot: ProjectReconcileSnapshot;
  weeklySummary?: WeeklyTimeSummary | null;
  isAdmin?: boolean;
  activeTab: ReconciliationTab;
  qbTimeConnectionStatus: QuickBooksTimeConnectionStatus;
  qbTimeOAuthState: "success" | "error" | null;
  qbTimeOAuthMessage: string | null;
}) {
  return (
    <div className="space-y-6">
      <TimeSubnav />
      <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">TimeHub</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-text-primary">QuickBooks Time dashboard</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
          Review imported labor, map unmatched QuickBooks employees and jobcodes, and export project time.
          QuickBooks Time sync runs automatically every night.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <TabLink href="/time/reconciliation?tab=overview" active={activeTab === "overview"}>
            TimeHub QB Sync
          </TabLink>
          <TabLink href="/time/reconciliation?tab=employees" active={activeTab === "employees"}>
            Match QB Users
          </TabLink>
          <TabLink href="/time/reconciliation?tab=projects" active={activeTab === "projects"}>
            Match QB Projects
          </TabLink>
        </div>
      </section>

      {activeTab === "overview" ? (
        <TimeReconciliationOverview
          snapshot={moduleSnapshot}
          weeklySummary={weeklySummary ?? null}
          isAdmin={isAdmin ?? false}
          qbTimeConnectionStatus={qbTimeConnectionStatus}
          qbTimeOAuthState={qbTimeOAuthState}
          qbTimeOAuthMessage={qbTimeOAuthMessage}
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
  qbTimeConnectionStatus,
  qbTimeOAuthState,
  qbTimeOAuthMessage,
}: {
  snapshot: TimeModuleSnapshot;
  weeklySummary: WeeklyTimeSummary | null;
  isAdmin: boolean;
  qbTimeConnectionStatus: QuickBooksTimeConnectionStatus;
  qbTimeOAuthState: "success" | "error" | null;
  qbTimeOAuthMessage: string | null;
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
      {qbTimeOAuthState && (
        <section
          className={`rounded-3xl border p-5 ${
            qbTimeOAuthState === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em]">
            {qbTimeOAuthState === "success" ? "Connected" : "Connection failed"}
          </p>
          <p className="mt-2 text-sm leading-6">
            {qbTimeOAuthMessage ??
              (qbTimeOAuthState === "success"
                ? "QuickBooks Time is now connected and token refresh is active."
                : "QuickBooks Time connection was not completed.")}
          </p>
        </section>
      )}

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
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Sync</p>
              <h2 className="mt-2 text-xl font-semibold text-text-primary">QuickBooks Time sync</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                Automatic sync runs nightly at 8:00 AM UTC and pulls the last 30 days of QuickBooks Time data.
              </p>
              <p className="mt-2 text-xs text-text-tertiary">
                Use the manual sync when you need fresh data before the nightly run.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                    qbTimeConnectionStatus.connected
                      ? qbTimeConnectionStatus.refreshTokenExpiringSoon
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {qbTimeConnectionStatus.connected
                    ? qbTimeConnectionStatus.refreshTokenExpiringSoon
                      ? "Reconnect Soon"
                      : "Connected"
                    : "Not Connected"}
                </span>
                <span className="text-xs text-text-tertiary">
                  {qbTimeConnectionStatus.connected
                    ? qbTimeConnectionStatus.refreshTokenExpiringSoon
                      ? "The refresh token is nearing expiry."
                      : "OAuth refresh is active."
                    : "Connect QuickBooks Time to enable automatic refresh."}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <a
                href="/api/qb-time/connect"
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse transition hover:bg-brand-primary-hover"
              >
                {qbTimeConnectionStatus.connected ? "Reconnect QB Time" : "Connect QB Time"}
              </a>
              <button
                type="button"
                onClick={() => void handleSync()}
                disabled={syncing}
                className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-raised disabled:opacity-50"
              >
                {syncing ? "Syncing..." : "Sync Now"}
              </button>
            </div>
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

      {(snapshot.users.some((user) => !user.matchedEmployee) || snapshot.projects.some((project) => !project.mappedProject)) && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Needs Matching</p>
              <h2 className="mt-2 text-xl font-semibold">QuickBooks Time records need ProjectHub links</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6">
                New QuickBooks users and jobcodes show here after sync. Match users first so employee hours can roll up cleanly.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {snapshot.users
                  .filter((user) => !user.matchedEmployee)
                  .slice(0, 4)
                  .map((user) => (
                    <span key={user.qbUserId} className="rounded-full bg-white px-3 py-1 font-medium text-amber-900">
                      {user.displayName}
                    </span>
                  ))}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link href="/time/reconciliation?tab=employees" className="rounded-xl bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">
                Match QB Users
              </Link>
              <Link href="/time/reconciliation?tab=projects" className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100">
                Match QB Projects
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Common work</p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <ActionCard href="/time/employees" title="Employee Hours" description="See each worker's hours by project and day." />
            <ActionCard href="/time/projects" title="Project Hours" description="See each project's labor by worker and day." />
            <ActionCard href="/time/reconciliation?tab=employees" title="Match QB Users" description="Create or link ProjectHub users from unmatched QuickBooks employees." />
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

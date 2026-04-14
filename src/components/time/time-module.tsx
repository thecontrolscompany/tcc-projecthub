"use client";

import Link from "next/link";
import { EmployeeHoursSection } from "@/components/time/employee-hours-section";
import { ProjectHoursSection } from "@/components/time/project-hours-section";
import { TimeSubnav } from "@/components/time/time-subnav";
import type { TimeModuleProject, TimeModuleSnapshot, TimeModuleUser } from "@/lib/time/data";

export function TimeClockPage({
  latestRun,
}: {
  latestRun: TimeModuleSnapshot["latestRun"];
}) {
  return (
    <div className="space-y-6">
      <TimeSubnav />
      <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Clock</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-text-primary">Clock in / clock out is coming soon</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
          This page is being reserved for the real clock workflow. Imported QuickBooks Time review
          and sync now live under Reconciliation, while labor analysis stays on the Employees and
          Projects pages.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Clock status" value="Coming soon" />
        <MetricCard label="Next milestone" value="Clock in / out" />
        <MetricCard label="Latest import" value={latestRun ? latestRun.status : "None"} />
      </div>

      <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Planned workflow</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border-default bg-surface-overlay p-4">
            <p className="text-sm font-semibold text-text-primary">Choose project</p>
            <p className="mt-2 text-sm text-text-secondary">Start from a mapped project and current assignment.</p>
          </div>
          <div className="rounded-2xl border border-border-default bg-surface-overlay p-4">
            <p className="text-sm font-semibold text-text-primary">Clock in or out</p>
            <p className="mt-2 text-sm text-text-secondary">Capture start, stop, and field notes without leaving ProjectHub.</p>
          </div>
          <div className="rounded-2xl border border-border-default bg-surface-overlay p-4">
            <p className="text-sm font-semibold text-text-primary">Review posted time</p>
            <p className="mt-2 text-sm text-text-secondary">Cross-check imports, employee totals, and project totals from the same module.</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/time/reconciliation?tab=overview" className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover">
            Open reconciliation overview
          </Link>
          <Link href="/time/projects" className="rounded-xl border border-border-default px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-overlay">
            Open project hours
          </Link>
        </div>
      </section>
    </div>
  );
}

export function TimeEmployeesPage({
  users,
  canManage = false
}: {
  users: TimeModuleUser[];
  canManage?: boolean;
}) {
  return (
    <div className="space-y-6">
      <TimeSubnav />
      <HeaderBlock
        eyebrow="Employees"
        title="Employee hours"
        description="Use this page for weekly and pay-period labor views. Imported QuickBooks user reconciliation now lives in the dedicated reconciliation workspace."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="QB users" value={String(users.length)} />
        <MetricCard label="Active users" value={String(users.filter((user) => user.active).length)} />
        <MetricCard label="Mapped to TCC" value={String(users.filter((user) => user.matchedEmployee).length)} />
      </div>

      {canManage && (
        <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-default bg-surface-overlay px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text-primary">Need to match imported employees to portal logins?</p>
              <p className="text-sm text-text-secondary">Open the reconciliation workspace for imported user review, mapping, and cleanup.</p>
            </div>
            <Link href="/time/reconciliation?tab=employees" className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover">
              Open reconciliation
            </Link>
          </div>
        </section>
      )}

      <EmployeeHoursSection />
    </div>
  );
}

export function TimeProjectsPage({
  projects,
  canManage = false
}: {
  projects: TimeModuleProject[];
  canManage?: boolean;
}) {
  const childJobcodes = projects.filter((project) => (project.parentQbJobcodeId ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      <TimeSubnav />
      <HeaderBlock
        eyebrow="Projects"
        title="Project hours"
        description="Use this page for project labor breakdowns. Imported QuickBooks jobcode review and mapping now live in the reconciliation workspace."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="QB jobcodes" value={String(projects.length)} />
        <MetricCard label="Active jobcodes" value={String(projects.filter((project) => project.active).length)} />
        <MetricCard label="Child jobcodes" value={String(childJobcodes)} />
      </div>

      <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
        <div className="rounded-2xl border border-border-default bg-surface-overlay px-4 py-3 text-sm text-text-secondary">
          {childJobcodes} imported jobcode{childJobcodes === 1 ? "" : "s"} have a parent jobcode and likely represent project-level entries.
        </div>

        {canManage && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-default bg-surface-overlay px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text-primary">Need to match imported jobcodes to portal projects?</p>
              <p className="text-sm text-text-secondary">Open the reconciliation workspace for imported jobcode review, mapping, and cleanup.</p>
            </div>
            <Link href="/time/reconciliation?tab=projects" className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover">
              Open reconciliation
            </Link>
          </div>
        )}
      </section>

      <ProjectHoursSection />
    </div>
  );
}

export function TimeEmployeesDirectorySection({
  users,
}: {
  users: TimeModuleUser[];
}) {
  return (
    <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Imported users</p>
      <h2 className="mt-2 text-xl font-semibold text-text-primary">QuickBooks Time user directory</h2>
      <p className="mt-2 text-sm text-text-secondary">Imported employee records and current portal mapping status.</p>
      <div className="mt-5 space-y-3">
        {users.map((user) => (
          <article key={user.qbUserId} className="rounded-2xl border border-border-default bg-surface-overlay p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-text-primary">{user.displayName}</h2>
                  <StateChip label={user.active ? "active" : "inactive"} tone={user.active ? "success" : "warn"} />
                  <StateChip label={user.matchedEmployee ? "mapped" : "unmapped"} tone={user.matchedEmployee ? "info" : "warn"} />
                </div>
                <p className="text-sm text-text-secondary">{user.email || "No email on QuickBooks record"}</p>
                <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
                  <span>QB user ID: {user.qbUserId}</span>
                  <span>Username: {user.username || "Not set"}</span>
                  <span>Payroll ID: {user.payrollId || "Not set"}</span>
                  <span>Group: {user.groupId ?? "None"}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-border-default bg-surface-raised px-4 py-3 lg:min-w-[280px]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">Import status</p>
                <div className="mt-2 space-y-1 text-sm text-text-secondary">
                  <p>
                    {user.matchedEmployee
                      ? `Mapped to ${user.matchedEmployee.fullName}`
                      : "No TCC employee mapping yet"}
                  </p>
                  <p>Last active: {formatDateTime(user.lastActiveAt)}</p>
                  <p>Last synced: {formatDateTime(user.lastSyncedAt)}</p>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function TimeProjectsDirectorySection({
  projects,
}: {
  projects: TimeModuleProject[];
}) {
  return (
    <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Imported jobcodes</p>
      <h2 className="mt-2 text-xl font-semibold text-text-primary">QuickBooks Time jobcode directory</h2>
      <p className="mt-2 text-sm text-text-secondary">Imported jobcodes and current portal project mapping status.</p>
      <div className="mt-5 space-y-3">
        {projects.map((project) => (
          <ProjectRow key={project.qbJobcodeId} project={project} />
        ))}
      </div>
    </section>
  );
}

export function TimeModuleError({ message }: { message: string }) {
  return (
    <div className="space-y-6">
      <HeaderBlock
        eyebrow="Time"
        title="Time module data source needs configuration"
        description="The portal route is ready, but this environment cannot currently read merged time data or the legacy fallback source."
      />
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="text-sm leading-6">{message}</p>
      </section>
    </div>
  );
}

function HeaderBlock({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">{eyebrow}</p>
      <h1 className="mt-2 font-heading text-3xl font-bold text-text-primary">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">{description}</p>
    </section>
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

function ProjectRow({ project }: { project: TimeModuleProject }) {
  return (
    <article className="rounded-2xl border border-border-default bg-surface-overlay p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-text-primary">{project.name}</h2>
            <StateChip label={project.active ? "active" : "inactive"} tone={project.active ? "success" : "warn"} />
            <StateChip label={project.mappedProject ? "mapped" : "unmapped"} tone={project.mappedProject ? "info" : "warn"} />
          </div>
          <p className="text-sm text-text-secondary">QB jobcode ID: {project.qbJobcodeId}</p>
          <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
            <span>Parent: {project.parentQbJobcodeId ?? "None"}</span>
            <span>Type: {project.type ?? "Not set"}</span>
            <span>Billable: {project.billable ? "Yes" : "No"}</span>
            <span>Assigned to all: {project.assignedToAll ? "Yes" : "No"}</span>
          </div>
        </div>

        <div className="grid gap-3 lg:min-w-[320px] lg:grid-cols-2">
          <div className="rounded-2xl border border-border-default bg-surface-raised px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">Mapping</p>
            <p className="mt-2 text-sm text-text-secondary">
              {project.mappedProject
                ? `${project.mappedProject.projectCode} ${project.mappedProject.name}`
                : "No TCC project mapping yet"}
            </p>
          </div>
          <div className="rounded-2xl border border-border-default bg-surface-raised px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">Sync status</p>
            <p className="mt-2 text-sm text-text-secondary">Modified: {formatDateTime(project.lastModifiedAt)}</p>
            <p className="mt-1 text-sm text-text-secondary">Synced: {formatDateTime(project.lastSyncedAt)}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function StateChip({
  label,
  tone
}: {
  label: string;
  tone: "success" | "warn" | "info";
}) {
  const classes =
    tone === "success"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "warn"
        ? "bg-amber-100 text-amber-800"
        : "bg-sky-100 text-sky-800";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${classes}`}>
      {label}
    </span>
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

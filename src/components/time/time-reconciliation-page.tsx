import Link from "next/link";
import type { ReactNode } from "react";
import {
  TimeEmployeesDirectorySection,
  TimeProjectsDirectorySection,
} from "@/components/time/time-module";
import type {
  ProjectReconcileSnapshot,
  TimeModuleSnapshot,
  TimeReconcileSnapshot,
} from "@/lib/time/data";
import { TimeReconcileUsersPanel } from "@/components/time/time-reconcile-page";
import { TimeReconcileProjectsPanel } from "@/components/time/time-reconcile-projects-page";

type ReconciliationTab = "employees" | "projects";

export function TimeReconciliationPage({
  moduleSnapshot,
  employeeSnapshot,
  projectSnapshot,
  activeTab,
}: {
  moduleSnapshot: TimeModuleSnapshot;
  employeeSnapshot: TimeReconcileSnapshot;
  projectSnapshot: ProjectReconcileSnapshot;
  activeTab: ReconciliationTab;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Reconciliation</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-text-primary">Match imported QB Time data to ProjectHub</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
          Review unmatched employees and jobcodes from QuickBooks Time, then map them to existing
          ProjectHub records without leaving the time module.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <TabLink href="/time/reconciliation?tab=employees" active={activeTab === "employees"}>
            Employees
          </TabLink>
          <TabLink href="/time/reconciliation?tab=projects" active={activeTab === "projects"}>
            Projects
          </TabLink>
        </div>
      </section>

      {activeTab === "projects" ? (
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

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, startOfMonth, subMonths, addMonths } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { AdminProjectsTab } from "@/components/admin-projects-tab";
import { FeedbackTab, WeeklyUpdatesTab } from "@/components/admin-weekly-feedback";
import { BillingTable } from "@/components/billing-table";
import { calcToBill, generatePmEmailDrafts, rollForwardRows } from "@/lib/billing/calculations";
import type { BillingRow, BillingPeriod } from "@/types/database";
import { safeJson } from "@/lib/utils/safe-json";

type Tab = "overview" | "billing" | "projects" | "backfill" | "weekly-updates" | "feedback";
type ProjectOption = { id: string; name: string };
type BillingPeriodRow = {
  id: string;
  period_month: string;
  estimated_income_snapshot: number;
  prior_pct: number;
  pct_complete: number;
  prev_billed: number;
  actual_billed: number | null;
  invoice_number: string | null;
  notes: string | null;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [periodMonth, setPeriodMonth] = useState<Date>(startOfMonth(new Date()));
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const supabase = createClient();

  const monthLabel = format(periodMonth, "MMMM yyyy");

  useEffect(() => {
    let active = true;

    async function bootstrapAuth() {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        setAuthError("Your browser session is not ready yet. Please refresh or sign in again.");
        setAuthReady(false);
        setLoading(false);
        return;
      }

      setAuthReady(true);
      setAuthError(null);

    }

    void bootstrapAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        setAuthReady(true);
        setAuthError(null);
      } else {
        setAuthReady(false);
        setAuthError("Your browser session is not ready yet. Please refresh or sign in again.");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authReady || !["overview", "billing"].includes(tab)) return;
    loadBillingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, tab, periodMonth]);

  useEffect(() => {
    if (!authReady) return;
    void loadProjectOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady]);

  async function loadProjectOptions() {
    try {
      const response = await fetch("/api/admin/data?section=projects", {
        credentials: "include",
      });
      const json = await safeJson(response);
      if (!response.ok) {
        setProjectOptions([]);
        return;
      }

      const nextProjects = (((json?.projects as Array<{ id: string; name: string }> | undefined) ?? [])).map((project) => ({
        id: project.id,
        name: project.name,
      }));
      setProjectOptions(nextProjects.sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setProjectOptions([]);
    }
  }

  function mapFallbackBillingRows(
    periods: Array<{
      id: string;
      period_month: string;
      pct_complete: number;
      prior_pct: number;
      prev_billed: number;
      actual_billed: number | null;
      invoice_number?: string | null;
      estimated_income_snapshot: number;
      notes?: string | null;
      synced_from_onedrive?: boolean | null;
      project:
        | {
            id: string;
            name: string;
            job_number?: string | null;
            is_active?: boolean | null;
            customer?: { name: string } | Array<{ name: string }>;
            pm?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }>;
            pm_directory?:
              | { id: string; first_name?: string | null; last_name?: string | null; email?: string | null }
              | Array<{ id: string; first_name?: string | null; last_name?: string | null; email?: string | null }>;
            project_assignments?: Array<{
              role_on_project?: string | null;
              profile?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }> | null;
              pm_directory?:
                | { first_name?: string | null; last_name?: string | null; email?: string | null }
                | Array<{ first_name?: string | null; last_name?: string | null; email?: string | null }>
                | null;
            }>;
          }
        | Array<{
            id: string;
            name: string;
            job_number?: string | null;
            is_active?: boolean | null;
            customer?: { name: string } | Array<{ name: string }>;
            pm?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }>;
            pm_directory?:
              | { id: string; first_name?: string | null; last_name?: string | null; email?: string | null }
              | Array<{ id: string; first_name?: string | null; last_name?: string | null; email?: string | null }>;
            project_assignments?: Array<{
              role_on_project?: string | null;
              profile?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }> | null;
              pm_directory?:
                | { first_name?: string | null; last_name?: string | null; email?: string | null }
                | Array<{ first_name?: string | null; last_name?: string | null; email?: string | null }>
                | null;
            }>;
          }>;
    }>
  ): BillingRow[] {
    return periods.map((period) => {
      const project = Array.isArray(period.project) ? period.project[0] : period.project;
      const customer = Array.isArray(project?.customer) ? project.customer[0] : project?.customer;
      const pm = Array.isArray(project?.pm) ? project.pm[0] : project?.pm;
      const pmDirectory = Array.isArray(project?.pm_directory) ? project.pm_directory[0] : project?.pm_directory;
      const primaryAssignment = (project?.project_assignments ?? []).find((assignment) => assignment?.role_on_project === "pm");
      const assignmentProfile = Array.isArray(primaryAssignment?.profile) ? primaryAssignment?.profile[0] : primaryAssignment?.profile;
      const assignmentPmDirectory = Array.isArray(primaryAssignment?.pm_directory) ? primaryAssignment?.pm_directory[0] : primaryAssignment?.pm_directory;
      const estimatedIncome = period.estimated_income_snapshot ?? 0;
      const prevBilled = period.prev_billed ?? 0;
      const projectLabel =
        project?.job_number && project?.name && !project.name.startsWith(project.job_number)
          ? `${project.job_number} - ${project.name}`
          : project?.name ?? "Unknown Project";
      const pmDirectoryName = [pmDirectory?.first_name, pmDirectory?.last_name].filter(Boolean).join(" ").trim();
      const assignmentPmDirectoryName = [assignmentPmDirectory?.first_name, assignmentPmDirectory?.last_name].filter(Boolean).join(" ").trim();
      const pmEmail = assignmentProfile?.email ?? assignmentPmDirectory?.email ?? pm?.email ?? pmDirectory?.email ?? "";
      const pmName =
        assignmentProfile?.full_name ??
        (assignmentPmDirectoryName || assignmentPmDirectory?.email) ??
        pm?.full_name ??
        (pmDirectoryName || pmDirectory?.email || (pm?.email ? pm.email.split("@")[0] : ""));

      return {
        billing_period_id: period.id,
        period_month: period.period_month,
        project_id: project?.id ?? "",
        customer_name: customer?.name ?? "",
        project_name: projectLabel,
        pm_email: pmEmail,
        pm_name: pmName,
        estimated_income: estimatedIncome,
        backlog: Math.max(estimatedIncome - prevBilled, 0),
        prior_pct: period.prior_pct ?? 0,
        pct_complete: period.pct_complete ?? 0,
        prev_billed: prevBilled,
        prev_billed_pct: estimatedIncome > 0 ? prevBilled / estimatedIncome : 0,
        to_bill: calcToBill(estimatedIncome, period.pct_complete ?? 0, prevBilled),
        actual_billed: period.actual_billed,
        invoice_number: period.invoice_number ?? null,
        notes: period.notes ?? null,
        synced_from_onedrive: period.synced_from_onedrive ?? false,
        poc_driven: false,
        has_recent_update: false,
      };
    });
  }

  async function loadBillingData() {
    setLoading(true);
    const monthStr = format(periodMonth, "yyyy-MM-dd");

    try {
      const res = await fetch(`/api/admin/data?section=billing&month=${encodeURIComponent(monthStr)}`, {
        credentials: "include",
      });
      const json = await safeJson(res);
      const data = json?.periods;
      const error = !res.ok ? { message: json?.error ?? "Failed to load billing data." } : null;

      if (!error && data) {
        const activePeriods = (
          data as Array<{
            id: string;
            period_month: string;
            pct_complete: number;
            prior_pct: number;
            prev_billed: number;
            actual_billed: number | null;
            invoice_number?: string | null;
            estimated_income_snapshot: number;
            notes?: string | null;
            synced_from_onedrive?: boolean | null;
            project:
              | {
                  id: string;
                  name: string;
                  job_number?: string | null;
                  is_active?: boolean | null;
                  customer?: { name: string } | Array<{ name: string }>;
                  pm?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }>;
                  pm_directory?:
                    | { id: string; first_name?: string | null; last_name?: string | null; email?: string | null }
                    | Array<{ id: string; first_name?: string | null; last_name?: string | null; email?: string | null }>;
                  project_assignments?: Array<{
                    role_on_project?: string | null;
                    profile?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }> | null;
                    pm_directory?:
                      | { first_name?: string | null; last_name?: string | null; email?: string | null }
                      | Array<{ first_name?: string | null; last_name?: string | null; email?: string | null }>
                      | null;
                  }>;
                }
              | Array<{
                  id: string;
                  name: string;
                  job_number?: string | null;
                  is_active?: boolean | null;
                  customer?: { name: string } | Array<{ name: string }>;
                  pm?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }>;
                  pm_directory?:
                    | { id: string; first_name?: string | null; last_name?: string | null; email?: string | null }
                    | Array<{ id: string; first_name?: string | null; last_name?: string | null; email?: string | null }>;
                  project_assignments?: Array<{
                    role_on_project?: string | null;
                    profile?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }> | null;
                    pm_directory?:
                      | { first_name?: string | null; last_name?: string | null; email?: string | null }
                      | Array<{ first_name?: string | null; last_name?: string | null; email?: string | null }>
                      | null;
                  }>;
                }>;
          }>
        ).filter((period) => {
          const project = Array.isArray(period.project) ? period.project[0] : period.project;
          return project?.is_active !== false;
        });

        const mapped = mapFallbackBillingRows(activePeriods)
          .filter((row) => row.project_id !== "")
          .sort((a, b) => a.customer_name.localeCompare(b.customer_name));

        const recentUpdateProjectIds = new Set(((json?.recentUpdateProjectIds as string[] | undefined) ?? []));
        const pocDrivenProjectIds = new Set(((json?.pocDrivenProjectIds as string[] | undefined) ?? []));

        setRows(
          mapped.map((row) => ({
            ...row,
            has_recent_update: recentUpdateProjectIds.has(row.project_id),
            poc_driven: pocDrivenProjectIds.has(row.project_id),
          }))
        );
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRollForward() {
    if (!confirm(`Roll forward from ${monthLabel} to ${format(addMonths(periodMonth, 1), "MMMM yyyy")}?\n\nThis will create the next billing period for all active projects.`)) return;

    setActionStatus("Rolling forward...");

    try {
      const monthStr = format(periodMonth, "yyyy-MM-dd");
      const { data: currentPeriods } = await supabase
        .from("billing_periods")
        .select("*, project:projects(is_active)")
        .eq("period_month", monthStr);

      const activePeriods = (currentPeriods ?? []).filter((period) => {
        const project = Array.isArray(period.project) ? period.project[0] : period.project;
        return project?.is_active !== false;
      });

      if (!activePeriods.length) {
        setActionStatus("No billing periods found for this month.");
        return;
      }

      const nextRows = rollForwardRows(activePeriods as BillingPeriod[]);
      const { error } = await supabase.from("billing_periods").upsert(
        nextRows.map((r) => ({
          period_month: r.period_month,
          project_id: r.project_id,
          estimated_income_snapshot: r.estimated_income_snapshot,
          prior_pct: r.prior_pct,
          pct_complete: r.pct_complete,
          prev_billed: r.prev_billed,
          actual_billed: r.actual_billed,
          synced_from_onedrive: false,
        })),
        { onConflict: "project_id,period_month" }
      );

      if (error) {
        setActionStatus(`Error: ${error.message}`);
      } else {
        setActionStatus(`Rolled forward to ${format(addMonths(periodMonth, 1), "MMMM yyyy")}`);
        setPeriodMonth(addMonths(periodMonth, 1));
      }
    } catch {
      setActionStatus("Unable to roll forward with local placeholder data.");
    }
  }

  async function handleSyncPoc() {
    setActionStatus("Syncing POC sheets via OneDrive... (requires Graph API setup)");

    try {
      const res = await fetch("/api/sync-poc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodMonth: format(periodMonth, "yyyy-MM-dd") }),
      });
      const json = await safeJson(res);
      setActionStatus(json.message ?? "Sync complete.");
      await loadBillingData();
    } catch {
      setActionStatus("POC sync is unavailable in the local placeholder preview.");
    }
  }

  async function handleGenerateEmails() {
    const drafts = generatePmEmailDrafts(rows);
    if (!drafts.length) {
      setActionStatus("No PM email addresses found.");
      return;
    }

    setActionStatus(`Creating ${drafts.length} Outlook draft(s)...`);

    try {
      const res = await fetch("/api/generate-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drafts }),
      });
      const json = await safeJson(res);
      setActionStatus(json.message ?? `${drafts.length} drafts created in Outlook.`);
    } catch {
      setActionStatus("Email draft generation is unavailable in the local placeholder preview.");
    }
  }

  async function handleExportExcel() {
    setActionStatus("Generating Excel export...");

    try {
      const res = await fetch(`/api/export-excel?month=${format(periodMonth, "yyyy-MM-dd")}`, {
        method: "GET",
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `TCC_Billing_${format(periodMonth, "yyyy-MM")}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        setActionStatus("Export downloaded.");
      } else {
        setActionStatus("Export failed.");
      }
    } catch {
      setActionStatus("Export is unavailable in the local placeholder preview.");
    }
  }

  return (
    <div className="min-h-screen bg-surface-base text-text-primary">
      <div className="border-b border-border-default">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap gap-2 px-6 py-4">
          {(
            [
              { id: "overview", label: "Overview" },
              { id: "billing", label: "Billing Table" },
              { id: "projects", label: "Projects" },
              { id: "backfill", label: "Billing History" },
              { id: "weekly-updates", label: "Weekly Updates" },
              { id: "feedback", label: "Feedback" },
            ] as { id: Tab; label: string }[]
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={[
                "rounded-lg px-4 py-2.5 text-sm font-medium transition",
                tab === id
                  ? "bg-surface-overlay text-text-primary shadow-sm"
                  : "text-text-secondary hover:bg-surface-overlay/70 hover:text-text-primary",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-screen-2xl px-6 py-6">
        {!authReady && authError ? (
          <div className="rounded-2xl border border-status-warning/30 bg-status-warning/10 px-6 py-5 text-sm text-status-warning">
            {authError}
          </div>
        ) : null}

        {!authReady ? (
          <div className="py-16 text-center text-text-tertiary">Loading admin data...</div>
        ) : (
          <>
        {tab === "overview" && (
          <AdminOverview
            rows={rows}
            loading={loading}
            monthLabel={monthLabel}
            projectCount={projectOptions.length}
            onOpenBilling={() => setTab("billing")}
            onOpenProjects={() => setTab("projects")}
            onOpenBackfill={() => setTab("backfill")}
          />
        )}

        {tab === "billing" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-raised px-3 py-1.5">
                <button
                  onClick={() => setPeriodMonth((d) => startOfMonth(subMonths(d, 1)))}
                  className="text-text-secondary hover:text-text-primary"
                  title="Previous month"
                >
                  &larr;
                </button>
                <span className="min-w-[120px] text-center text-sm font-semibold text-text-primary">
                  {monthLabel}
                </span>
                <button
                  onClick={() => setPeriodMonth((d) => startOfMonth(addMonths(d, 1)))}
                  className="text-text-secondary hover:text-text-primary"
                  title="Next month"
                >
                  &rarr;
                </button>
              </div>

              <button
                onClick={handleRollForward}
                className="rounded-xl border border-brand-primary/40 bg-brand-primary/10 px-4 py-1.5 text-sm font-medium text-brand-primary transition hover:bg-brand-primary/20"
              >
                Roll Forward Month
              </button>
              <button
                onClick={handleSyncPoc}
                className="rounded-xl border border-status-success/40 bg-status-success/10 px-4 py-1.5 text-sm font-medium text-status-success transition hover:bg-status-success/20"
              >
                Sync POC Sheets
              </button>
              <button
                onClick={handleGenerateEmails}
                className="rounded-xl border border-brand-primary/40 bg-brand-primary/10 px-4 py-1.5 text-sm font-medium text-brand-primary transition hover:bg-brand-primary/20"
              >
                Generate PM Emails
              </button>
              <button
                onClick={handleExportExcel}
                className="rounded-xl border border-border-default bg-surface-raised px-4 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-surface-overlay"
              >
                Export Excel
              </button>
              <Link
                href="/admin/billing-import"
                className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-base"
              >
                Import Historical Billing
              </Link>
            </div>

            {actionStatus && (
              <div className="flex items-center justify-between rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-4 py-2.5 text-sm text-brand-primary">
                {actionStatus}
                <button onClick={() => setActionStatus(null)} className="ml-4 text-text-tertiary hover:text-text-primary">
                  x
                </button>
              </div>
            )}

            {loading ? (
              <div className="py-20 text-center text-text-tertiary">Loading {monthLabel}...</div>
            ) : rows.length === 0 ? (
              <EmptyBillingState month={monthLabel} />
            ) : (
              <BillingTable rows={rows} onRowsChange={setRows} />
            )}
          </div>
        )}

        {tab === "projects" && <AdminProjectsTab />}
        {tab === "backfill" && <BillingBackfillTab projects={projectOptions} />}
        {tab === "weekly-updates" && <WeeklyUpdatesTab />}
        {tab === "feedback" && <FeedbackTab />}
          </>
        )}
      </main>
    </div>
  );
}

function AdminOverview({
  rows,
  loading,
  monthLabel,
  projectCount,
  onOpenBilling,
  onOpenProjects,
  onOpenBackfill,
}: {
  rows: BillingRow[];
  loading: boolean;
  monthLabel: string;
  projectCount: number;
  onOpenBilling: () => void;
  onOpenProjects: () => void;
  onOpenBackfill: () => void;
}) {
  const metrics = useMemo(() => {
    const toBill = rows.reduce((sum, row) => sum + (row.to_bill ?? 0), 0);
    const actualBilled = rows.reduce((sum, row) => sum + (row.actual_billed ?? 0), 0);
    const backlog = rows.reduce((sum, row) => sum + (row.backlog ?? 0), 0);
    const staleUpdates = rows.filter((row) => !row.has_recent_update);
    const missingPm = rows.filter((row) => !row.pm_email);
    const needsInvoice = rows.filter((row) => (row.actual_billed ?? 0) > 0 && !row.invoice_number);
    const readyToBill = rows
      .filter((row) => (row.to_bill ?? 0) > 0)
      .sort((a, b) => (b.to_bill ?? 0) - (a.to_bill ?? 0))
      .slice(0, 5);

    return {
      toBill,
      actualBilled,
      backlog,
      staleUpdates,
      missingPm,
      needsInvoice,
      readyToBill,
      pocDrivenCount: rows.filter((row) => row.poc_driven).length,
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-brand-primary">Admin Overview</p>
          <h2 className="mt-1 text-3xl font-bold text-text-primary">{monthLabel}</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Current billing, project upkeep, and admin shortcuts in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenBilling}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
          >
            Open Billing
          </button>
          <button
            type="button"
            onClick={onOpenProjects}
            className="rounded-xl border border-border-default bg-surface-raised px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-overlay"
          >
            Manage Projects
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active Billing Rows" value={loading ? "..." : rows.length.toString()} detail={`${projectCount || rows.length} projects loaded`} />
        <MetricCard label="Projected To Bill" value={loading ? "..." : currencyFormatter.format(metrics.toBill)} detail={`${metrics.pocDrivenCount} POC-driven projects`} />
        <MetricCard label="Actual Billed" value={loading ? "..." : currencyFormatter.format(metrics.actualBilled)} detail={`${metrics.needsInvoice.length} need invoice numbers`} />
        <MetricCard label="Remaining Backlog" value={loading ? "..." : currencyFormatter.format(metrics.backlog)} detail="Based on current billing period" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr),minmax(360px,0.65fr)]">
        <div className="rounded-2xl border border-border-default bg-surface-raised">
          <div className="flex items-center justify-between gap-3 border-b border-border-default px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Ready To Bill</h3>
              <p className="text-sm text-text-secondary">Largest projected billings for the current period.</p>
            </div>
            <button type="button" onClick={onOpenBilling} className="text-sm font-semibold text-brand-primary hover:text-brand-hover">
              View table
            </button>
          </div>
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-text-tertiary">Loading billing signals...</div>
          ) : metrics.readyToBill.length ? (
            <div className="divide-y divide-border-default">
              {metrics.readyToBill.map((row) => (
                <div key={row.billing_period_id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr),140px,110px] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{row.project_name}</p>
                    <p className="mt-1 truncate text-xs text-text-tertiary">{row.customer_name || "No customer"} {row.pm_name ? `- ${row.pm_name}` : ""}</p>
                  </div>
                  <div className="text-sm font-semibold text-text-primary md:text-right">{currencyFormatter.format(row.to_bill ?? 0)}</div>
                  <div className="text-xs text-text-secondary md:text-right">{Math.round((row.pct_complete ?? 0) * 100)}% complete</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-text-tertiary">No projected billings for this period.</div>
          )}
        </div>

        <div className="space-y-4">
          <AttentionCard
            title="Needs Attention"
            items={[
              { label: "No recent weekly update", value: metrics.staleUpdates.length, action: onOpenBilling },
              { label: "Missing PM email", value: metrics.missingPm.length, action: onOpenProjects },
              { label: "Billed without invoice #", value: metrics.needsInvoice.length, action: onOpenBackfill },
            ]}
          />
          <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h3 className="text-lg font-semibold text-text-primary">Admin Shortcuts</h3>
            <div className="mt-4 grid gap-2">
              <ShortcutLink href="/admin/users" label="User Management" />
              <ShortcutLink href="/admin/contacts" label="Contacts" />
              <ShortcutLink href="/admin/ops" label="Ops View" />
              <ShortcutLink href="/admin/analytics" label="Analytics" />
              <ShortcutLink href="/admin/migrate-sharepoint" label="SharePoint Reconcile" />
              <ShortcutLink href="/admin/billing-import" label="Historical Billing Import" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-3 text-2xl font-bold text-text-primary">{value}</p>
      <p className="mt-2 text-sm text-text-secondary">{detail}</p>
    </div>
  );
}

function AttentionCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number; action: () => void }>;
}) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-base px-4 py-3 text-left transition hover:bg-surface-overlay"
          >
            <span className="text-sm text-text-secondary">{item.label}</span>
            <span className={["text-sm font-bold", item.value > 0 ? "text-status-warning" : "text-status-success"].join(" ")}>
              {item.value}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ShortcutLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-border-default bg-surface-base px-4 py-3 text-sm font-medium text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
    >
      <span>{label}</span>
      <span aria-hidden="true">-&gt;</span>
    </Link>
  );
}

function BillingBackfillTab({ projects }: { projects: ProjectOption[] }) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [periods, setPeriods] = useState<BillingPeriodRow[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [newPeriodMonth, setNewPeriodMonth] = useState(format(startOfMonth(new Date()), "yyyy-MM"));

  useEffect(() => {
    if (!selectedProjectId) {
      setPeriods([]);
      setDirty(new Set());
      return;
    }
    void loadPeriods(selectedProjectId);
  }, [selectedProjectId]);

  async function loadPeriods(projectId: string) {
    setLoading(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/admin/billing-backfill?projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      const json = await safeJson(response);
      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to load billing history.");
      }

      setPeriods((json?.periods as BillingPeriodRow[]) ?? []);
      setDirty(new Set());
    } catch (err) {
      setPeriods([]);
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Failed to load billing history." });
    } finally {
      setLoading(false);
    }
  }

  function markDirty(id: string) {
    setDirty((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }

  function updatePeriod<K extends keyof BillingPeriodRow>(id: string, field: K, value: BillingPeriodRow[K]) {
    setPeriods((current) =>
      current.map((period) => (period.id === id ? { ...period, [field]: value } : period))
    );
    markDirty(id);
  }

  async function handleAddPeriod() {
    if (!selectedProjectId) return;

    setAdding(true);
    setStatus(null);
    try {
      const periodMonth = `${newPeriodMonth}-01`;
      const response = await fetch("/api/admin/billing-backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId: selectedProjectId, periodMonth }),
      });
      const json = await safeJson(response);
      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to add billing period.");
      }

      const nextPeriod = json?.period as BillingPeriodRow | undefined;
      if (nextPeriod) {
        setPeriods((current) =>
          [...current, nextPeriod].sort((a, b) => a.period_month.localeCompare(b.period_month))
        );
      }
      setStatus({ type: "success", message: "Billing period added." });
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Failed to add billing period." });
    } finally {
      setAdding(false);
    }
  }

  async function handleSaveChanges() {
    const updates = periods
      .filter((period) => dirty.has(period.id))
      .map((period) => ({
        id: period.id,
        estimated_income_snapshot: period.estimated_income_snapshot,
        prior_pct: period.prior_pct,
        pct_complete: period.pct_complete,
        prev_billed: period.prev_billed,
        actual_billed: period.actual_billed,
        invoice_number: period.invoice_number,
        notes: period.notes,
      }));

    if (updates.length === 0) return;

    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/billing-backfill", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ updates }),
      });
      const json = await safeJson(response);

      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to save billing history.");
      }

      setDirty(new Set());
      setStatus({ type: "success", message: "Billing history saved." });
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Failed to save billing history." });
    } finally {
      setSaving(false);
    }
  }

  const selectedProjectName = useMemo(
    () => projects.find((project) => project.id === selectedProjectId)?.name ?? "",
    [projects, selectedProjectId]
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-text-primary">Billing History</h2>
        <p className="text-sm text-text-secondary">
          Backfill historical billing periods so analytics and backlog trend data stay complete.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),180px,140px]">
        <select
          value={selectedProjectId}
          onChange={(event) => setSelectedProjectId(event.target.value)}
          className="rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
        >
          <option value="">Select project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <input
          type="month"
          value={newPeriodMonth}
          onChange={(event) => setNewPeriodMonth(event.target.value)}
          className="rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
        />

        <button
          type="button"
          onClick={() => void handleAddPeriod()}
          disabled={!selectedProjectId || adding}
          className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add Period"}
        </button>
      </div>

      {status && (
        <div
          className={[
            "rounded-xl border px-4 py-2.5 text-sm",
            status.type === "success"
              ? "border-status-success/30 bg-status-success/10 text-status-success"
              : "border-status-danger/30 bg-status-danger/10 text-status-danger",
          ].join(" ")}
        >
          {status.message}
        </div>
      )}

      {!selectedProjectId ? (
        <div className="rounded-2xl border border-dashed border-border-default px-6 py-10 text-center text-sm text-text-secondary">
          Select a project to load billing history.
        </div>
      ) : loading ? (
        <div className="py-10 text-center text-text-tertiary">Loading billing history...</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">{selectedProjectName}</p>
              <p className="text-xs text-text-tertiary">{periods.length} billing period{periods.length === 1 ? "" : "s"}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleSaveChanges()}
              disabled={dirty.size === 0 || saving}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
            >
              {saving ? "Saving..." : `Save Changes${dirty.size > 0 ? ` (${dirty.size})` : ""}`}
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border-default">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-raised/80">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Period Month</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Est. Income</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Prior %</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">% Complete</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Prev Billed</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Actual Billed</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Invoice #</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Notes</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id} className="border-b border-border-default hover:bg-surface-raised">
                    <td className="px-4 py-2.5 text-text-primary">{format(new Date(period.period_month), "MMM yyyy")}</td>
                    <td className="px-4 py-2.5">
                      <NumericCell value={period.estimated_income_snapshot} onChange={(value) => updatePeriod(period.id, "estimated_income_snapshot", value ?? 0)} />
                    </td>
                    <td className="px-4 py-2.5">
                      <NumericCell value={period.prior_pct} onChange={(value) => updatePeriod(period.id, "prior_pct", value ?? 0)} step={0.0001} />
                    </td>
                    <td className="px-4 py-2.5">
                      <NumericCell value={period.pct_complete} onChange={(value) => updatePeriod(period.id, "pct_complete", value ?? 0)} step={0.0001} />
                    </td>
                    <td className="px-4 py-2.5">
                      <NumericCell value={period.prev_billed} onChange={(value) => updatePeriod(period.id, "prev_billed", value ?? 0)} />
                    </td>
                    <td className="px-4 py-2.5">
                      <NumericCell value={period.actual_billed ?? null} onChange={(value) => updatePeriod(period.id, "actual_billed", value)} allowBlank />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        value={period.invoice_number ?? ""}
                        onChange={(event) => updatePeriod(period.id, "invoice_number", event.target.value || null)}
                        className="w-full min-w-[140px] rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        value={period.notes ?? ""}
                        onChange={(event) => updatePeriod(period.id, "notes", event.target.value || null)}
                        className="w-full min-w-[220px] rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function NumericCell({
  value,
  onChange,
  step = 0.01,
  allowBlank = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  allowBlank?: boolean;
}) {
  return (
    <input
      type="number"
      step={step}
      value={value ?? ""}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === "" && allowBlank) {
          onChange(null);
          return;
        }
        onChange(Number(raw || 0));
      }}
      className="w-28 rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-right text-sm text-text-primary focus:border-brand-primary focus:outline-none"
    />
  );
}

function EmptyBillingState({ month }: { month: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-default p-12 text-center">
      <p className="text-lg font-semibold text-text-primary">No billing data for {month}</p>
      <p className="mt-2 text-sm text-text-secondary">
        Use <strong>Roll Forward Month</strong> from the previous period to create this period,
        or add projects first.
      </p>
    </div>
  );
}

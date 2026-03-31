"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, startOfMonth, subMonths, addMonths } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { AdminProjectsTab } from "@/components/admin-projects-tab";
import { BillingTable } from "@/components/billing-table";
import { calcToBill, generatePmEmailDrafts, rollForwardRows } from "@/lib/billing/calculations";
import type { BillingRow, BillingPeriod } from "@/types/database";

type Tab = "billing" | "projects" | "pm-directory" | "users";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("billing");
  const [periodMonth, setPeriodMonth] = useState<Date>(startOfMonth(new Date()));
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const supabase = createClient();

  const monthLabel = format(periodMonth, "MMMM yyyy");

  useEffect(() => {
    if (tab !== "billing") return;
    loadBillingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, periodMonth]);

  function mapFallbackBillingRows(
    periods: Array<{
      id: string;
      period_month: string;
      pct_complete: number;
      prior_pct: number;
      prev_billed: number;
      actual_billed: number | null;
      estimated_income_snapshot: number;
      synced_from_onedrive?: boolean | null;
      project:
        | {
            id: string;
            name: string;
            job_number?: string | null;
            customer?: { name: string } | Array<{ name: string }>;
            pm?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }>;
          }
        | Array<{
            id: string;
            name: string;
            job_number?: string | null;
            customer?: { name: string } | Array<{ name: string }>;
            pm?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }>;
          }>;
    }>
  ): BillingRow[] {
    return periods.map((period) => {
      const project = Array.isArray(period.project) ? period.project[0] : period.project;
      const customer = Array.isArray(project?.customer) ? project.customer[0] : project?.customer;
      const pm = Array.isArray(project?.pm) ? project.pm[0] : project?.pm;
      const estimatedIncome = period.estimated_income_snapshot ?? 0;
      const prevBilled = period.prev_billed ?? 0;
      const projectLabel =
        project?.job_number && project?.name && !project.name.startsWith(project.job_number)
          ? `${project.job_number} - ${project.name}`
          : project?.name ?? "Unknown Project";

      return {
        billing_period_id: period.id,
        period_month: period.period_month,
        project_id: project?.id ?? "",
        customer_name: customer?.name ?? "",
        project_name: projectLabel,
        pm_email: pm?.email ?? "",
        pm_name: pm?.full_name ?? (pm?.email ? pm.email.split("@")[0] : ""),
        estimated_income: estimatedIncome,
        backlog: Math.max(estimatedIncome - prevBilled, 0),
        prior_pct: period.prior_pct ?? 0,
        pct_complete: period.pct_complete ?? 0,
        prev_billed: prevBilled,
        prev_billed_pct: estimatedIncome > 0 ? prevBilled / estimatedIncome : 0,
        to_bill: calcToBill(estimatedIncome, period.pct_complete ?? 0, prevBilled),
        actual_billed: period.actual_billed,
        synced_from_onedrive: period.synced_from_onedrive ?? false,
      };
    });
  }

  async function loadBillingData() {
    setLoading(true);
    const monthStr = format(periodMonth, "yyyy-MM-dd");

    try {
      const { data, error } = await supabase
        .from("billing_rows")
        .select("*")
        .eq("period_month", monthStr)
        .order("customer_name");

      if (!error && data) {
        setRows(data as BillingRow[]);
      } else {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("billing_periods")
          .select(`
            id,
            period_month,
            pct_complete,
            prior_pct,
            prev_billed,
            actual_billed,
            estimated_income_snapshot,
            synced_from_onedrive,
            project:projects (
              id,
              name,
              job_number,
              customer:customers ( name ),
              pm:profiles ( email, full_name )
            )
          `)
          .eq("period_month", monthStr)
          .order("period_month");

        if (!fallbackError && fallbackData) {
          const mapped = mapFallbackBillingRows(
            fallbackData as Array<{
              id: string;
              period_month: string;
              pct_complete: number;
              prior_pct: number;
              prev_billed: number;
              actual_billed: number | null;
              estimated_income_snapshot: number;
              synced_from_onedrive?: boolean | null;
              project:
                | {
                    id: string;
                    name: string;
                    job_number?: string | null;
                    customer?: { name: string } | Array<{ name: string }>;
                    pm?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }>;
                  }
                | Array<{
                    id: string;
                    name: string;
                    job_number?: string | null;
                    customer?: { name: string } | Array<{ name: string }>;
                    pm?: { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }>;
                  }>;
            }>
          ).sort((a, b) => a.customer_name.localeCompare(b.customer_name));

          setRows(mapped);
        } else {
          setRows([]);
        }
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
        .select("*")
        .eq("period_month", monthStr);

      if (!currentPeriods?.length) {
        setActionStatus("No billing periods found for this month.");
        return;
      }

      const nextRows = rollForwardRows(currentPeriods as BillingPeriod[]);
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
      const json = await res.json();
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
      const json = await res.json();
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
      <header className="border-b border-border-default">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
              The Controls Company
            </p>
            <h1 className="text-lg font-bold text-text-primary">TCC ProjectHub - Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/analytics"
              className="rounded-full border border-border-default px-4 py-1.5 text-sm text-text-secondary hover:border-brand-primary/40 hover:text-text-primary"
            >
              Analytics
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="border-b border-border-default">
        <div className="mx-auto flex max-w-screen-2xl gap-1 px-6">
          {(
            [
              { id: "billing", label: "Billing Table" },
              { id: "projects", label: "Projects" },
              { id: "pm-directory", label: "PM Directory" },
              { id: "users", label: "User Management" },
            ] as { id: Tab; label: string }[]
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={[
                "border-b-2 px-4 py-3 text-sm font-medium transition",
                tab === id
                  ? "border-brand-primary text-text-primary"
                  : "border-transparent text-text-secondary hover:text-text-primary",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-screen-2xl px-6 py-6">
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
        {tab === "pm-directory" && <PmDirectoryTab />}

        {tab === "users" && (
          <div className="py-8 text-center">
            <p className="text-text-secondary">
              User management is at{" "}
              <Link href="/admin/users" className="text-brand-primary hover:text-brand-primary">
                /admin/users
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
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

function ProjectsTab() {
  const supabase = createClient();
  const [projects, setProjects] = useState<
    Array<{
      id: string;
      name: string;
      estimated_income: number;
      migration_status?: "legacy" | "migrated" | "clean" | null;
      is_active: boolean;
      customer?: { name: string };
      pm?: { full_name: string; email: string };
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        const { data } = await supabase
          .from("projects")
          .select("*, customer:customers(name), pm:profiles(full_name, email)")
          .order("name");

        setProjects((data as typeof projects) ?? []);
      } catch {
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, [supabase]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Projects</h2>
        <Link
          href="/admin/projects/new"
          className="rounded-xl bg-brand-primary px-4 py-1.5 text-sm font-semibold text-text-inverse hover:bg-brand-hover"
        >
          + Add Project
        </Link>
      </div>

      {loading ? (
        <div className="py-10 text-center text-text-tertiary">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-raised/80">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Project</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Customer</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">PM</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Est. Income</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-border-default hover:bg-surface-raised">
                  <td className="px-4 py-2.5 font-medium text-text-primary">
                    {p.name}
                    {p.migration_status === "legacy" && (
                      <span className="ml-2 inline-flex items-center rounded border border-status-warning/20 bg-status-warning/10 px-2 py-0.5 text-xs font-medium text-status-warning">
                        ⚠ Legacy
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{p.customer?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{p.pm?.full_name ?? p.pm?.email ?? "-"}</td>
                  <td className="px-4 py-2.5 text-right text-text-secondary">{fmt(p.estimated_income)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={[
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      p.is_active ? "bg-status-success/10 text-status-success" : "bg-surface-overlay text-text-secondary",
                    ].join(" ")}>
                      {p.is_active ? "Active" : "Archived"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PmDirectoryTab() {
  const supabase = createClient();
  const [pms, setPms] = useState<
    Array<{ id: string; first_name: string | null; last_name: string | null; email: string; profile?: { full_name: string | null } }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string; consentUrl?: string } | null>(null);

  async function loadPms() {
    setLoading(true);

    try {
      const { data } = await supabase
        .from("pm_directory")
        .select("*, profile:profiles(full_name)")
        .order("email");

      setPms((data as typeof pms) ?? []);
    } catch {
      setPms([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleImport() {
    setImporting(true);
    setStatus(null);

    try {
      const res = await fetch("/api/admin/import-pm-directory", {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok) {
        setStatus({
          type: "error",
          message: typeof json?.error === "string" ? json.error : "PM import failed.",
          consentUrl: typeof json?.consentUrl === "string" ? json.consentUrl : undefined,
        });
        return;
      }

      setStatus({
        type: "success",
        message: `Import complete: ${json.inserted ?? 0} inserted, ${json.updated ?? 0} updated, ${json.skipped ?? 0} skipped.`,
      });
      await loadPms();
    } catch {
      setStatus({
        type: "error",
        message: "PM import failed. Please try again.",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-text-primary">PM Directory</h2>
          <p className="text-sm text-text-secondary">
            First names are used for personalized billing email greetings. Mirrors the legacy &quot;PM Directory&quot; sheet.
          </p>
        </div>

        <button
          onClick={handleImport}
          disabled={importing}
          className="rounded-xl border border-brand-primary/40 bg-brand-primary/10 px-4 py-1.5 text-sm font-medium text-brand-primary transition hover:bg-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {importing ? "Importing from Microsoft..." : "Import from Microsoft"}
        </button>
      </div>

      {status && (
        <div
          className={[
            "rounded-xl border px-4 py-2.5 text-sm",
            status.type === "success"
              ? "border-status-success/30 bg-status-success/10 text-status-success"
              : "border-status-warning/30 bg-status-warning/10 text-status-warning",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span>{status.message}</span>
            {status.consentUrl && (
              <a
                href={status.consentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-status-warning/50 bg-status-warning/10 px-3 py-1 text-xs font-medium text-status-warning transition hover:bg-status-warning/20"
              >
                Grant Admin Consent in Azure &rarr;
              </a>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-text-tertiary">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-raised/80">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Email</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">First Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Last Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Profile</th>
              </tr>
            </thead>
            <tbody>
              {pms.map((pm) => (
                <tr key={pm.id} className="border-b border-border-default hover:bg-surface-raised">
                  <td className="px-4 py-2.5 text-text-primary">{pm.email}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{pm.first_name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{pm.last_name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{pm.profile?.full_name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SignOutButton() {
  const supabase = createClient();
  const router = typeof window !== "undefined" ? { push: (url: string) => { window.location.href = url; } } : null;

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router?.push("/login");
      }}
      className="rounded-full border border-border-default px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary"
    >
      Sign out
    </button>
  );
}

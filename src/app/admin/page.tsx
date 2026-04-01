"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, startOfMonth, subMonths, addMonths, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { AdminProjectsTab } from "@/components/admin-projects-tab";
import { BillingTable } from "@/components/billing-table";
import { calcToBill, generatePmEmailDrafts, rollForwardRows } from "@/lib/billing/calculations";
import type { BillingRow, BillingPeriod, CustomerFeedback, InternalContactRole, Profile, UserRole } from "@/types/database";

type Tab = "billing" | "projects" | "contacts" | "feedback" | "users";
const INTERNAL_CONTACT_ROLES: InternalContactRole[] = ["pm", "lead", "installer", "ops_manager"];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("billing");
  const [periodMonth, setPeriodMonth] = useState<Date>(startOfMonth(new Date()));
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>("admin");
  const supabase = createClient();

  const monthLabel = format(periodMonth, "MMMM yyyy");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("role").eq("id", user.id).single().then(({ data }) => {
        if (data?.role) setUserRole(data.role as UserRole);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const { data, error } = await supabase
        .from("billing_periods")
        .select(`
          id,
          period_month,
          pct_complete,
          prior_pct,
          prev_billed,
          actual_billed,
          estimated_income_snapshot,
          notes,
          synced_from_onedrive,
          project:projects (
            id,
            name,
            job_number,
            is_active,
            customer:customers ( name ),
            pm:profiles ( email, full_name ),
            pm_directory:pm_directory ( id, first_name, last_name, email ),
            project_assignments (
              role_on_project,
              profile:profiles ( email, full_name ),
              pm_directory:pm_directory ( first_name, last_name, email )
            )
          )
        `)
        .eq("period_month", monthStr)
        .order("period_month");

      if (!error && data) {
        const activePeriods = (
          data as Array<{
            id: string;
            period_month: string;
            pct_complete: number;
            prior_pct: number;
            prev_billed: number;
            actual_billed: number | null;
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

        const projectIds = mapped.map((row) => row.project_id);
        const [recentUpdatesResult, pocItemsResult] = await Promise.all([
          projectIds.length
            ? supabase
                .from("weekly_updates")
                .select("project_id, week_of")
                .in("project_id", projectIds)
                .gte("week_of", format(subDays(new Date(), 14), "yyyy-MM-dd"))
            : Promise.resolve({ data: [] as Array<{ project_id: string; week_of: string }> }),
          projectIds.length
            ? supabase.from("poc_line_items").select("project_id").in("project_id", projectIds)
            : Promise.resolve({ data: [] as Array<{ project_id: string }> }),
        ]);

        const recentUpdateProjectIds = new Set((recentUpdatesResult.data ?? []).map((update) => update.project_id));
        const pocDrivenProjectIds = new Set((pocItemsResult.data ?? []).map((item) => item.project_id));

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
      <div className="border-b border-border-default">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap gap-2 px-6 py-4">
          {(
            [
              { id: "billing", label: "Billing Table" },
              { id: "projects", label: "Projects" },
              { id: "contacts", label: "Contacts" },
              { id: "feedback", label: "Feedback" },
              ...(userRole === "admin" ? [{ id: "users" as Tab, label: "User Management" }] : []),
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

        {tab === "feedback" && <FeedbackTab />}
        {tab === "contacts" && <PmDirectoryTab />}

        {tab === "users" && <UsersTab />}
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
        <h2 className="text-2xl font-bold text-text-primary">Projects</h2>
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
  type PmDirectoryRow = {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    profile_id: string | null;
    intended_role: InternalContactRole | null;
    profile?: { full_name: string | null } | null;
    matchedProfileRole?: UserRole | null;
  };

  const [pms, setPms] = useState<PmDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string; consentUrl?: string } | null>(null);
  const [editingPm, setEditingPm] = useState<PmDirectoryRow | null>(null);
  const [isAddingPm, setIsAddingPm] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formRole, setFormRole] = useState<InternalContactRole>("pm");
  const [savingPm, setSavingPm] = useState(false);
  const [deletingPmId, setDeletingPmId] = useState<string | null>(null);

  async function loadPms() {
    setLoading(true);

    try {
      const [{ data: contactData }, { data: profileData }] = await Promise.all([
        supabase
          .from("pm_directory")
          .select("id, email, first_name, last_name, profile_id, intended_role, profile:profiles(full_name)")
          .order("email"),
        supabase
          .from("profiles")
          .select("email, role"),
      ]);

      const profileRoleByEmail = new Map(
        ((profileData as Array<{ email: string; role: UserRole }> | null) ?? []).map((profile) => [
          profile.email.toLowerCase(),
          profile.role,
        ])
      );

      const normalized = (
        (contactData as Array<PmDirectoryRow & { profile?: { full_name: string | null } | Array<{ full_name: string | null }> }> | null) ?? []
      ).map((item) => ({
        ...item,
        profile: Array.isArray(item.profile) ? item.profile[0] ?? null : item.profile ?? null,
        matchedProfileRole: profileRoleByEmail.get(item.email.toLowerCase()) ?? null,
      }));

      setPms(normalized);
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

  function resetPmForm() {
    setEditingPm(null);
    setIsAddingPm(false);
    setFormEmail("");
    setFormFirstName("");
    setFormLastName("");
    setFormRole("pm");
  }

  function openAddPmModal() {
    resetPmForm();
    setIsAddingPm(true);
    setStatus(null);
  }

  function openEditPmModal(pm: PmDirectoryRow) {
    setEditingPm(pm);
    setIsAddingPm(false);
    setFormEmail(pm.email);
    setFormFirstName(pm.first_name ?? "");
    setFormLastName(pm.last_name ?? "");
    setFormRole(
      pm.matchedProfileRole && INTERNAL_CONTACT_ROLES.includes(pm.matchedProfileRole as InternalContactRole)
        ? (pm.matchedProfileRole as InternalContactRole)
        : pm.intended_role ?? "pm"
    );
    setStatus(null);
  }

  async function handleSavePm() {
    const normalizedEmail = formEmail.trim().toLowerCase();
    const isInternalContact = normalizedEmail.endsWith("@controlsco.net");

    if (!normalizedEmail) {
      setStatus({ type: "error", message: "Email is required." });
      return;
    }

    setSavingPm(true);
    setStatus(null);

    try {
      let intendedRole: InternalContactRole | null = null;

      if (isInternalContact) {
        const { data: matchingProfile } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (matchingProfile?.id) {
          const { error: profileError } = await supabase
            .from("profiles")
            .update({ role: formRole })
            .eq("id", matchingProfile.id);

          if (profileError) throw profileError;
        } else {
          intendedRole = formRole;
        }
      }

      if (editingPm) {
        const { error } = await supabase
          .from("pm_directory")
          .update({
            email: normalizedEmail,
            first_name: formFirstName.trim() || null,
            last_name: formLastName.trim() || null,
            intended_role: isInternalContact ? intendedRole : null,
          })
          .eq("id", editingPm.id);

        if (error) throw error;

        setStatus({ type: "success", message: "Contact entry updated." });
      } else {
        const { error } = await supabase
          .from("pm_directory")
          .insert({
            email: normalizedEmail,
            first_name: formFirstName.trim() || null,
            last_name: formLastName.trim() || null,
            intended_role: isInternalContact ? intendedRole : null,
          });

        if (error) throw error;

        setStatus({ type: "success", message: "Contact entry added." });
      }

      resetPmForm();
      await loadPms();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to save contact entry.",
      });
    } finally {
      setSavingPm(false);
    }
  }

  async function handleDeletePm(pm: PmDirectoryRow) {
    if (!confirm(`Delete contact entry for ${pm.email}?`)) return;

    setDeletingPmId(pm.id);
    setStatus(null);

    try {
      const { error } = await supabase
        .from("pm_directory")
        .delete()
        .eq("id", pm.id);

      if (error) throw error;

      if (editingPm?.id === pm.id) {
        resetPmForm();
      }

      setStatus({ type: "success", message: "Contact entry deleted." });
      await loadPms();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete contact entry.",
      });
    } finally {
      setDeletingPmId(null);
    }
  }

  async function handleImport() {
    setImporting(true);
    setStatus(null);

    try {
      const res = await fetch("/api/admin/import-pm-directory", {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok) {
        const rawCount = typeof json?.rawCount === "number" ? json.rawCount : null;
        setStatus({
          type: "error",
          message:
            `${typeof json?.error === "string" ? json.error : "PM import failed."}${
              rawCount !== null ? ` Graph returned ${rawCount} ${rawCount === 1 ? "user" : "users"} before filtering.` : ""
            }`,
          consentUrl: typeof json?.consentUrl === "string" ? json.consentUrl : undefined,
        });
        return;
      }

      const rawCount = typeof json?.rawCount === "number" ? json.rawCount : 0;
      const inserted = typeof json?.inserted === "number" ? json.inserted : 0;
      const updated = typeof json?.updated === "number" ? json.updated : 0;
      const skipped = typeof json?.skipped === "number" ? json.skipped : 0;

      setStatus({
        type: "success",
        message: `Graph returned ${rawCount} ${rawCount === 1 ? "user" : "users"}, imported ${inserted + updated}, skipped ${skipped}.`,
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
          <h2 className="text-2xl font-bold text-text-primary">Contacts</h2>
          <p className="text-sm text-text-secondary">
            Stores both internal TCC staff and external customer-side contacts. Linked portal accounts are shown when `profile_id` is present.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openAddPmModal}
            className="rounded-xl border border-border-default bg-surface-raised px-4 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
          >
            Add Contact
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            className="rounded-xl border border-brand-primary/40 bg-brand-primary/10 px-4 py-1.5 text-sm font-medium text-brand-primary transition hover:bg-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? "Importing from Microsoft..." : "Import from Microsoft"}
          </button>
        </div>
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
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Portal Link</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pms.map((pm) => (
                <tr key={pm.id} className="border-b border-border-default hover:bg-surface-raised">
                  <td className="px-4 py-2.5 text-text-primary">{pm.email}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{pm.first_name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{pm.last_name ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    {pm.profile_id ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex w-fit rounded-full bg-status-success/10 px-2.5 py-0.5 text-xs font-medium text-status-success">
                          Linked Portal Account
                        </span>
                        <span className="text-xs text-text-secondary">{pm.profile?.full_name ?? pm.profile_id}</span>
                      </div>
                    ) : pm.email.toLowerCase().endsWith("@controlsco.net") ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex w-fit rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-medium text-brand-primary">
                          Internal - Not Yet Signed In
                        </span>
                        {(pm.intended_role ?? pm.matchedProfileRole) && (
                          <span className="text-xs text-text-secondary">
                            Intended role: {pm.intended_role ?? pm.matchedProfileRole}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex rounded-full bg-surface-overlay px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                        External
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditPmModal(pm)}
                        className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-raised hover:text-text-primary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePm(pm)}
                        disabled={deletingPmId === pm.id}
                        className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-1.5 text-xs font-medium text-status-danger transition hover:bg-status-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingPmId === pm.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(isAddingPm || editingPm) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-default bg-surface-raised p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {editingPm ? "Edit Contact Entry" : "Add Contact Entry"}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {editingPm?.profile_id
                    ? "This entry is linked to a portal account. Editing email may affect future auto-linking."
                    : "Use this for external contacts or internal staff not yet linked to a portal account."}
                </p>
              </div>
              <button
                onClick={() => {
                  resetPmForm();
                  setStatus(null);
                }}
                className="rounded-lg px-2 py-1 text-text-tertiary transition hover:bg-surface-overlay hover:text-text-primary"
              >
                x
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">First Name</label>
                  <input
                    type="text"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Last Name</label>
                  <input
                    type="text"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                  />
                </div>
              </div>

              {formEmail.trim().toLowerCase().endsWith("@controlsco.net") && !editingPm?.profile_id && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as InternalContactRole)}
                    className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                  >
                    {INTERNAL_CONTACT_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-text-tertiary">
                    If this user has not signed in yet, the selected role will be applied automatically after their first login.
                  </p>
                </div>
              )}

              {editingPm?.profile_id && (
                <div className="rounded-xl border border-status-success/20 bg-status-success/10 px-3 py-2 text-sm text-status-success">
                  Linked portal account: {editingPm.profile?.full_name ?? editingPm.profile_id}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  resetPmForm();
                  setStatus(null);
                }}
                className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePm}
                disabled={savingPm}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPm ? "Saving..." : editingPm ? "Save Changes" : "Add Contact"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackTab() {
  const supabase = createClient();
  const [feedback, setFeedback] = useState<
    Array<
      CustomerFeedback & {
        project?: { name: string } | { name: string }[] | null;
        profile?: { email: string } | { email: string }[] | null;
      }
    >
  >([]);
  const [loading, setLoading] = useState(true);
  const [showUnreviewedOnly, setShowUnreviewedOnly] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    void loadFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUnreviewedOnly]);

  async function loadFeedback() {
    setLoading(true);

    const query = supabase
      .from("customer_feedback")
      .select("id, project_id, profile_id, message, submitted_at, reviewed, project:projects(name), profile:profiles(email)")
      .order("submitted_at", { ascending: false });

    if (showUnreviewedOnly) {
      query.eq("reviewed", false);
    }

    const { data, error } = await query;
    if (error) {
      setFeedback([]);
    } else {
      setFeedback((data as typeof feedback) ?? []);
    }
    setLoading(false);
  }

  async function markReviewed(id: string) {
    setSavingId(id);
    const { error } = await supabase.from("customer_feedback").update({ reviewed: true }).eq("id", id);
    setSavingId(null);
    if (!error) {
      await loadFeedback();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-text-primary">Customer Feedback</h2>
          <p className="text-sm text-text-secondary">
            Review customer questions and comments submitted from the project portal.
          </p>
        </div>
        <label className="inline-flex items-center gap-3 rounded-xl border border-border-default bg-surface-raised px-4 py-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={showUnreviewedOnly}
            onChange={(event) => setShowUnreviewedOnly(event.target.checked)}
            className="h-4 w-4 accent-[var(--color-brand-primary)]"
          />
          Unreviewed only
        </label>
      </div>

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
    </div>
  );
}

function UsersTab() {

  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("customer");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfiles() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .order("role")
        .order("email");

      if (error) {
        throw error;
      }

      setProfiles((data as Profile[]) ?? []);
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }

  function openEditUser(user: Profile) {
    setEditingUser(user);
    setEditName(user.full_name ?? "");
    setEditRole(user.role);
    setStatus(null);
  }

  async function handleSaveUser() {
    if (!editingUser) return;

    setSaving(true);
    setStatus(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editName.trim() || null,
          role: editRole,
        })
        .eq("id", editingUser.id);

      if (error) {
        throw error;
      }

      setStatus({ type: "success", message: "User updated." });
      setEditingUser(null);
      await loadProfiles();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to update user.",
      });
    } finally {
      setSaving(false);
    }
  }

  const roleBadge = (role: UserRole) => {
    const styles: Record<UserRole, string> = {
      admin: "bg-brand-primary/10 text-brand-primary",
      pm: "bg-status-info/10 text-status-info",
      lead: "bg-status-warning/10 text-status-warning",
      installer: "bg-status-info/10 text-brand-primary",
      ops_manager: "bg-brand-primary/10 text-text-primary",
      customer: "bg-status-success/10 text-status-success",
    };

    return styles[role];
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-text-primary">User Management</h2>
          <p className="text-sm text-text-secondary">
            Manage internal and customer portal users. Name and role come directly from the `profiles` table.
          </p>
        </div>
        <Link
          href="/admin/users"
          className="rounded-xl border border-border-default bg-surface-raised px-4 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
        >
          Open Full User Page
        </Link>
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

      {loading ? (
        <div className="py-10 text-center text-text-tertiary">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-raised/80">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Full Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Email</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Role</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id} className="border-b border-border-default hover:bg-surface-raised">
                  <td className="px-4 py-2.5 font-medium text-text-primary">{profile.full_name?.trim() || "-"}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{profile.email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadge(profile.role)}`}>
                      {profile.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => openEditUser(profile)}
                      className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-raised hover:text-text-primary"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-default bg-surface-raised p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Edit User</h3>
                <p className="mt-1 text-sm text-text-secondary">{editingUser.email}</p>
              </div>
              <button
                onClick={() => {
                  setEditingUser(null);
                  setStatus(null);
                }}
                className="rounded-lg px-2 py-1 text-text-tertiary transition hover:bg-surface-overlay hover:text-text-primary"
              >
                x
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Full name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                >
                  <option value="admin">admin</option>
                  <option value="pm">pm</option>
                  <option value="lead">lead</option>
                  <option value="installer">installer</option>
                  <option value="ops_manager">ops_manager</option>
                  <option value="customer">customer</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setStatus(null);
                }}
                className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUser}
                disabled={saving}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
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

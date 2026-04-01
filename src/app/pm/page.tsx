"use client";

import { useEffect, useState } from "react";
import { format, startOfWeek, addDays } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { ErrorBoundary } from "@/components/error-boundary";
import { ViewReportLink } from "@/components/view-report-link";
import type { BillingPeriod, CrewLogEntry, PocLineItem, ProjectAssignmentRole, WeeklyUpdate } from "@/types/database";

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

type LastUpdatePlaceholders = {
  notes: string;
  materialDelivered: string;
  equipmentSet: string;
  safetyIncidents: string;
  inspectionsTests: string;
  delaysImpacts: string;
  otherRemarks: string;
};

const EMPTY_PLACEHOLDERS: LastUpdatePlaceholders = {
  notes: "",
  materialDelivered: "",
  equipmentSet: "",
  safetyIncidents: "",
  inspectionsTests: "",
  delaysImpacts: "",
  otherRemarks: "",
};

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
    try {
      const res = await fetch("/api/pm/projects", {
        credentials: "include",
      });
      const json = await res.json();

      if (!res.ok) {
        setProjects([]);
        return;
      }

      setProjects(((json?.projects as ProjectWithBilling[]) ?? []).sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base text-text-primary">
        <main className="mx-auto max-w-4xl px-6 py-6">
          <PmProjectListSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-base text-text-primary">
      <main className="mx-auto max-w-4xl px-6 py-6">
        <ErrorBoundary theme="dark">
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
        </ErrorBoundary>
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
                  {project.sharepoint_folder && (
                    <a
                      href={`https://controlsco.sharepoint.com/sites/TCCProjects/Shared%20Documents/${project.sharepoint_folder.split("/").filter(Boolean).map(encodeURIComponent).join("/")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded border border-brand-primary/20 bg-brand-primary/10 px-2 py-0.5 text-xs font-medium text-brand-primary hover:bg-brand-primary/20"
                    >
                      SharePoint
                    </a>
                  )}
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

const DAYS: CrewLogEntry["day"][] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function emptyCrewLog(): CrewLogEntry[] {
  return DAYS.map((day) => ({ day, men: 0, hours: 0, activities: "" }));
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
  const thisSaturday = format(addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 6), "yyyy-MM-dd");

  const [weekOf, setWeekOf] = useState(thisSaturday);
  const [notes, setNotes] = useState("");
  const [blockers, setBlockers] = useState("");
  const [crewLog, setCrewLog] = useState<CrewLogEntry[]>(emptyCrewLog());
  const [materialDelivered, setMaterialDelivered] = useState("");
  const [equipmentSet, setEquipmentSet] = useState("");
  const [safetyIncidents, setSafetyIncidents] = useState("");
  const [inspectionsTests, setInspectionsTests] = useState("");
  const [delaysImpacts, setDelaysImpacts] = useState("");
  const [otherRemarks, setOtherRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [recentUpdates, setRecentUpdates] = useState<WeeklyUpdate[]>([]);
  const [pocItems, setPocItems] = useState<PocLineItem[]>([]);
  const [pocPcts, setPocPcts] = useState<Record<string, number>>({}); // id -> pct 0-100
  const [placeholders, setPlaceholders] = useState<LastUpdatePlaceholders>(EMPTY_PLACEHOLDERS);
  const [manualOverride, setManualOverride] = useState<string>(() =>
    project.current_period ? (project.current_period.pct_complete * 100).toFixed(1) : ""
  );

  // Derived overall % from POC line items (weighted)
  const totalWeight = pocItems.reduce((sum, item) => sum + item.weight, 0);
  const pocPctDecimal = totalWeight > 0
    ? pocItems.reduce((sum, item) => sum + item.weight * ((pocPcts[item.id] ?? item.pct_complete * 100) / 100), 0) / totalWeight
    : null;
  // Manual override takes precedence if set; otherwise use weighted POC; fallback to period value
  const pctComplete = manualOverride !== ""
    ? Number(manualOverride)
    : pocPctDecimal !== null
      ? pocPctDecimal * 100
      : (project.current_period ? project.current_period.pct_complete * 100 : 0);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`/api/pm/projects?section=project-data&projectId=${encodeURIComponent(project.id)}`, {
          credentials: "include",
        });
        const json = await response.json();
        const updatesData = (response.ok ? json?.updates : []) as WeeklyUpdate[];
        const pocData = (response.ok ? json?.pocItems : []) as PocLineItem[];

        setRecentUpdates(updatesData ?? []);
        const latestUpdate = (updatesData ?? [])[0] ?? null;
        const latestCrewLog = latestUpdate?.crew_log ?? [];
        const previousCrewByDay = new Map(latestCrewLog.map((row) => [row.day, row]));

        setPlaceholders({
          notes: latestUpdate?.notes ?? "",
          materialDelivered: latestUpdate?.material_delivered ?? "",
          equipmentSet: latestUpdate?.equipment_set ?? "",
          safetyIncidents: latestUpdate?.safety_incidents ?? "",
          inspectionsTests: latestUpdate?.inspections_tests ?? "",
          delaysImpacts: latestUpdate?.delays_impacts ?? "",
          otherRemarks: latestUpdate?.other_remarks ?? "",
        });
        setCrewLog(
          emptyCrewLog().map((row) => ({
            ...row,
            men: previousCrewByDay.get(row.day)?.men ?? 0,
            hours: 0,
            activities: "",
          }))
        );

        const items = pocData ?? [];
        setPocItems(items);
        // Initialize editable values from current DB values
        const initPcts: Record<string, number> = {};
        items.forEach((item) => { initPcts[item.id] = item.pct_complete * 100; });
        setPocPcts(initPcts);
      } catch {
        setRecentUpdates([]);
      }
    }

    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateCrewRow(index: number, field: keyof CrewLogEntry, value: string | number) {
    setCrewLog((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      const pctDecimal = Math.min(Math.max(pctComplete / 100, 0), 1);

      // Build POC snapshot for the weekly update record
      const pocSnapshot = pocItems.length > 0
        ? pocItems.map((item) => ({
            id: item.id,
            category: item.category,
            weight: item.weight,
            pct_complete: (pocPcts[item.id] ?? item.pct_complete * 100) / 100,
          }))
        : null;

      const { error: updateError } = await supabase.from("weekly_updates").insert({
        project_id: project.id,
        pm_id: pmId,
        week_of: weekOf,
        pct_complete: pctDecimal,
        poc_snapshot: pocSnapshot,
        notes: notes || null,
        blockers: blockers || null,
        crew_log: crewLog,
        material_delivered: materialDelivered || null,
        equipment_set: equipmentSet || null,
        safety_incidents: safetyIncidents || null,
        inspections_tests: inspectionsTests || null,
        delays_impacts: delaysImpacts || null,
        other_remarks: otherRemarks || null,
      });

      if (updateError) throw new Error(updateError.message);

      // Write updated POC % values back to poc_line_items (live values)
      if (pocItems.length > 0) {
        for (const item of pocItems) {
          const newPct = Math.min(Math.max((pocPcts[item.id] ?? item.pct_complete * 100) / 100, 0), 1);
          await supabase
            .from("poc_line_items")
            .update({ pct_complete: newPct })
            .eq("id", item.id);
        }
      }

      if (project.current_period) {
        await supabase.from("billing_periods").update({ pct_complete: pctDecimal }).eq("id", project.current_period.id);
      }

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onBack();
      }, 1500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-status-success/50 focus:outline-none";
  const labelCls = "mb-1.5 block text-sm font-medium text-text-secondary";

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-status-success hover:text-status-success">
        &larr; Back to projects
      </button>

      <div className="rounded-2xl border border-status-success/20 bg-status-success/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-status-success">Daily Construction Report</p>
        <h2 className="mt-1 text-xl font-bold text-text-primary">{project.name}</h2>
        <p className="text-sm text-text-secondary">{project.customer?.name}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <label className={labelCls}>Week of (ending Saturday)</label>
            <input
              type="date"
              value={weekOf}
              onChange={(e) => setWeekOf(e.target.value)}
              className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm text-text-primary focus:border-status-success/50 focus:outline-none"
            />
          </div>
          <div className="rounded-xl border border-status-success/20 bg-status-success/5 px-5 py-3">
            <p className="text-xs text-text-tertiary mb-1">Overall % Complete</p>
            <p className="text-2xl font-bold text-status-success mb-1">{pctComplete.toFixed(1)}%</p>
            {pocItems.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-text-tertiary">Calculated from POC</p>
                  <p className="text-lg font-semibold text-text-primary">
                    {pocPctDecimal !== null ? `${(pocPctDecimal * 100).toFixed(1)}%` : "Not configured"}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Override calculated value</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={manualOverride}
                      onChange={(e) => setManualOverride(e.target.value)}
                      placeholder={project.current_period ? (project.current_period.pct_complete * 100).toFixed(1) : "0.0"}
                      className="w-28 rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-center text-sm text-text-primary focus:border-status-success/50 focus:outline-none"
                    />
                    <span className="text-xs text-text-tertiary">Clear to use the calculated value above.</span>
                    {manualOverride !== "" && (
                      <button
                        type="button"
                        onClick={() => setManualOverride("")}
                        className="text-xs font-medium text-status-danger hover:underline"
                      >
                        Clear override
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-status-success/30 bg-white/50 p-4">
                <label className="mb-1 block text-sm font-medium text-text-primary">Enter % Complete</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={manualOverride}
                    onChange={(e) => setManualOverride(e.target.value)}
                    placeholder={project.current_period ? (project.current_period.pct_complete * 100).toFixed(1) : "0.0"}
                    className="w-32 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-center text-sm font-semibold text-text-primary focus:border-status-success/50 focus:outline-none"
                  />
                  <span className="text-sm text-text-secondary">Manual override is used when no POC categories are configured.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* POC Line Items */}
        {pocItems.length > 0 ? (
          <div>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <h3 className="text-sm font-semibold text-text-primary">
                % Complete by Category
                <span className="ml-2 text-xs font-normal text-text-tertiary">(weights sum to {totalWeight})</span>
              </h3>
              <div className="rounded-xl border border-status-success/20 bg-status-success/5 px-3 py-2 text-sm">
                <p className="text-xs uppercase tracking-wide text-text-tertiary">Live Weighted Total</p>
                <p className="font-semibold text-status-success">
                  {pocPctDecimal !== null ? `${(pocPctDecimal * 100).toFixed(1)}%` : "0.0%"}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {pocItems.map((item) => {
                const val = pocPcts[item.id] ?? item.pct_complete * 100;
                const contribution = totalWeight > 0 ? (item.weight * (val / 100) / totalWeight) * 100 : 0;
                return (
                  <div key={item.id} className="rounded-xl border border-border-default bg-surface-raised p-4">
                    <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="text-sm font-medium text-text-primary">{item.category}</span>
                        <p className="mt-1 text-xs text-text-tertiary">
                          Weight {item.weight} • contributes {contribution.toFixed(1)} points
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={val.toFixed(1)}
                            onChange={(e) => setPocPcts((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                            className="w-16 rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-center text-sm font-semibold text-status-success focus:border-status-success/50 focus:outline-none"
                          />
                          <span className="text-sm text-text-tertiary">%</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-overlay">
                        <div className="h-full rounded-full bg-status-success/40 transition-all" style={{ width: `${Math.min(val, 100)}%` }} />
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-overlay">
                        <div className="h-full rounded-full bg-brand-primary/60 transition-all" style={{ width: `${Math.min(contribution, 100)}%` }} />
                      </div>
                      <p className="text-[11px] text-text-tertiary">
                        Top bar = category progress. Bottom bar = weighted contribution to the overall total.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border-default p-4 text-center text-sm text-text-tertiary">
            No POC line items configured for this project yet.{" "}
            <span className="text-text-secondary">Use the manual % complete input above, or ask admin to set up POC categories later.</span>
          </div>
        )}

        {/* Daily crew log */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-text-primary">Daily Crew Log</h3>
          <div className="overflow-x-auto rounded-xl border border-border-default">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-overlay text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                  <th className="px-3 py-2 w-28">Day</th>
                  <th className="px-3 py-2 w-20 text-center"># of Men</th>
                  <th className="px-3 py-2 w-20 text-center">Hours</th>
                  <th className="px-3 py-2">Activities</th>
                </tr>
              </thead>
              <tbody>
                {crewLog.map((row, i) => (
                  <tr key={row.day} className="border-b border-border-default last:border-0">
                    <td className="px-3 py-2 font-medium text-text-secondary">{row.day}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={row.men === 0 ? "" : row.men}
                        onChange={(e) => updateCrewRow(i, "men", Number(e.target.value))}
                        className="w-16 rounded-lg border border-border-default bg-surface-base px-2 py-1 text-center text-sm text-text-primary focus:border-status-success/50 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={row.hours === 0 ? "" : row.hours}
                        onChange={(e) => updateCrewRow(i, "hours", Number(e.target.value))}
                        className="w-16 rounded-lg border border-border-default bg-surface-base px-2 py-1 text-center text-sm text-text-primary focus:border-status-success/50 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.activities}
                        onChange={(e) => updateCrewRow(i, "activities", e.target.value)}
                        placeholder="Work performed..."
                        className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-1 text-sm text-text-primary placeholder-text-tertiary focus:border-status-success/50 focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes section */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-text-primary">Notes</h3>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Material Delivered</label>
              <input type="text" value={materialDelivered} onChange={(e) => setMaterialDelivered(e.target.value)}
                placeholder={placeholders.materialDelivered || "e.g. Actuators and VFDs"} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Equipment Set</label>
              <input type="text" value={equipmentSet} onChange={(e) => setEquipmentSet(e.target.value)}
                placeholder={placeholders.equipmentSet} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Safety Incidents</label>
              <input type="text" value={safetyIncidents} onChange={(e) => setSafetyIncidents(e.target.value)}
                placeholder={placeholders.safetyIncidents || "None"} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Inspections &amp; Tests</label>
              <input type="text" value={inspectionsTests} onChange={(e) => setInspectionsTests(e.target.value)}
                placeholder={placeholders.inspectionsTests} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Delays / Impacts</label>
              <input type="text" value={delaysImpacts} onChange={(e) => setDelaysImpacts(e.target.value)}
                placeholder={placeholders.delaysImpacts} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Other Remarks</label>
              <textarea value={otherRemarks} onChange={(e) => setOtherRemarks(e.target.value)}
                rows={2} placeholder={placeholders.otherRemarks} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Blockers (internal — not on printed report) */}
        <div>
          <label className={labelCls}>
            Blockers <span className="text-text-tertiary">(internal — not on report)</span>
          </label>
          <textarea
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            rows={2}
            placeholder="Issues or items needing admin attention?"
            className={inputCls}
          />
        </div>

        {/* General notes */}
        <div>
          <label className={labelCls}>Additional Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={placeholders.notes || "Any other context..."}
            className={inputCls}
          />
        </div>

        {saveError && (
          <div className="rounded-xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
            {saveError}
          </div>
        )}

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
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Update History</h3>
          {recentUpdates.map((update) => (
            <div key={update.id} className="rounded-xl border border-border-default bg-surface-raised p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-tertiary">Week of {update.week_of}</span>
                  <ViewReportLink updateId={update.id} />
                </div>
                {update.pct_complete !== null && (
                  <span className="text-sm font-semibold text-status-success">
                    {(update.pct_complete * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              {update.notes && <p className="mt-1.5 text-sm text-text-secondary">{update.notes}</p>}
              {update.blockers && <p className="mt-1 text-sm text-status-danger">Blocker: {update.blockers}</p>}
              {update.crew_log && update.crew_log.length > 0 && update.crew_log.some((r) => r.men > 0 || r.hours > 0) && (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-text-tertiary">
                        <th className="pr-3 text-left font-medium">Day</th>
                        <th className="pr-3 text-center font-medium">Men</th>
                        <th className="pr-3 text-center font-medium">Hrs</th>
                        <th className="text-left font-medium">Activities</th>
                      </tr>
                    </thead>
                    <tbody>
                      {update.crew_log.filter((r) => r.men > 0 || r.hours > 0 || r.activities).map((row) => (
                        <tr key={row.day} className="text-text-secondary">
                          <td className="pr-3">{row.day}</td>
                          <td className="pr-3 text-center">{row.men}</td>
                          <td className="pr-3 text-center">{row.hours}</td>
                          <td>{row.activities}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {update.material_delivered && <p className="mt-1 text-xs text-text-secondary"><span className="font-medium">Material:</span> {update.material_delivered}</p>}
              {update.safety_incidents && <p className="mt-1 text-xs text-status-danger"><span className="font-medium">Safety:</span> {update.safety_incidents}</p>}
              {update.delays_impacts && <p className="mt-1 text-xs text-status-warning"><span className="font-medium">Delays:</span> {update.delays_impacts}</p>}
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

function PmProjectListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded bg-surface-raised" />
        <div className="h-4 w-64 animate-pulse rounded bg-surface-raised" />
      </div>

      {[0, 1, 2].map((index) => (
        <div key={index} className="rounded-2xl border border-border-default bg-surface-raised p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="h-5 w-52 animate-pulse rounded bg-surface-overlay" />
              <div className="h-4 w-36 animate-pulse rounded bg-surface-overlay" />
            </div>
            <div className="h-6 w-20 animate-pulse rounded-full bg-surface-overlay" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-surface-overlay" />
                <div className="h-4 w-20 animate-pulse rounded bg-surface-overlay" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { ErrorBoundary } from "@/components/error-boundary";
import { ViewReportLink } from "@/components/view-report-link";
import { WipTab } from "@/components/wip-tab";
import { BomTab } from "@/components/bom-tab";
import type { ChangeOrder } from "@/types/database";
import type {
  BillingPeriod,
  CrewLogEntry,
  PocLineItem,
  ProjectAssignmentRole,
  WeeklyUpdate,
  WeeklyUpdateEdit,
} from "@/types/database";

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

const DAYS: CrewLogEntry["day"][] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function emptyCrewLog(): CrewLogEntry[] {
  return DAYS.map((day) => ({ day, men: 0, hours: 0, activities: "" }));
}

function hasCrewLogEntry(row: CrewLogEntry) {
  return row.men > 0 || row.hours > 0 || Boolean(row.activities?.trim());
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
        const {
          data: { user },
        } = await supabase.auth.getUser();
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
                      href={`https://controlsco.sharepoint.com/sites/TCCProjects/Shared%20Documents/${project.sharepoint_folder
                        .split("/")
                        .filter(Boolean)
                        .map(encodeURIComponent)
                        .join("/")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded border border-brand-primary/20 bg-brand-primary/10 px-2 py-0.5 text-xs font-medium text-brand-primary hover:bg-brand-primary/20"
                    >
                      SharePoint
                    </a>
                  )}
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${roleBadgeStyles[project.assignmentRole]}`}>
                    {roleLabels[project.assignmentRole]}
                  </span>
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
          </button>
        );
      })}
    </div>
  );
}

function UpdateForm({
  project,
  onBack,
}: {
  project: ProjectWithBilling;
  onBack: () => void;
}) {
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
  const [saving, setSaving] = useState<"draft" | "submit" | false>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [recentUpdates, setRecentUpdates] = useState<WeeklyUpdate[]>([]);
  const [pocItems, setPocItems] = useState<PocLineItem[]>([]);
  const [pocPcts, setPocPcts] = useState<Record<string, number>>({});
  const [placeholders, setPlaceholders] = useState<LastUpdatePlaceholders>(EMPTY_PLACEHOLDERS);
  const [draftUpdateId, setDraftUpdateId] = useState<string | null>(null);
  const [submittedUpdateId, setSubmittedUpdateId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editHistory, setEditHistory] = useState<WeeklyUpdateEdit[]>([]);
  const [editNote, setEditNote] = useState("");
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [coError, setCoError] = useState<string | null>(null);
  const [manualOverride, setManualOverride] = useState<string>(() =>
    project.current_period ? (project.current_period.pct_complete * 100).toFixed(1) : ""
  );

  const totalWeight = pocItems.reduce((sum, item) => sum + item.weight, 0);
  const pocPctDecimal =
    totalWeight > 0
      ? pocItems.reduce((sum, item) => sum + item.weight * ((pocPcts[item.id] ?? item.pct_complete * 100) / 100), 0) / totalWeight
      : null;
  const pctComplete =
    manualOverride !== ""
      ? Number(manualOverride)
      : pocPctDecimal !== null
        ? pocPctDecimal * 100
        : project.current_period
          ? project.current_period.pct_complete * 100
          : 0;

  function seedFromLatest(latestUpdate: WeeklyUpdate | null) {
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
  }

  function populateFromUpdate(update: WeeklyUpdate) {
    setWeekOf(update.week_of);
    setNotes(update.notes ?? "");
    setBlockers(update.blockers ?? "");
    setCrewLog(update.crew_log && update.crew_log.length > 0 ? update.crew_log : emptyCrewLog());
    setMaterialDelivered(update.material_delivered ?? "");
    setEquipmentSet(update.equipment_set ?? "");
    setSafetyIncidents(update.safety_incidents ?? "");
    setInspectionsTests(update.inspections_tests ?? "");
    setDelaysImpacts(update.delays_impacts ?? "");
    setOtherRemarks(update.other_remarks ?? "");
    setManualOverride(update.pct_complete !== null ? (update.pct_complete * 100).toFixed(1) : "");
  }

  function resetForNewWeek(latestUpdate: WeeklyUpdate | null) {
    setWeekOf(thisSaturday);
    setNotes("");
    setBlockers("");
    setMaterialDelivered("");
    setEquipmentSet("");
    setSafetyIncidents("");
    setInspectionsTests("");
    setDelaysImpacts("");
    setOtherRemarks("");
    setManualOverride(project.current_period ? (project.current_period.pct_complete * 100).toFixed(1) : "");
    setDraftUpdateId(null);
    setSubmittedUpdateId(null);
    setIsEditing(false);
    setEditHistory([]);
    setEditNote("");
    seedFromLatest(latestUpdate);
  }

  async function loadData() {
    try {
      const [response, coResponse] = await Promise.all([
        fetch(`/api/pm/projects?section=project-data&projectId=${encodeURIComponent(project.id)}`, { credentials: "include" }),
        fetch(`/api/admin/change-orders?projectId=${encodeURIComponent(project.id)}`, { credentials: "include" }),
      ]);
      const json = await response.json();
      if (coResponse.ok) {
        const coJson = await coResponse.json();
        setChangeOrders((coJson?.changeOrders as ChangeOrder[]) ?? []);
        setCoError(null);
      } else {
        const coJson = await coResponse.json().catch(() => null);
        setCoError(coJson?.error ?? "Failed to load change orders.");
        setChangeOrders([]);
      }
      const updatesData = (response.ok ? json?.updates : []) as WeeklyUpdate[];
      const pocData = (response.ok ? json?.pocItems : []) as PocLineItem[];
      const editHistoryData = (response.ok ? json?.editHistory : []) as WeeklyUpdateEdit[];

      setRecentUpdates(updatesData ?? []);

      const items = pocData ?? [];
      setPocItems(items);
      const initPcts: Record<string, number> = {};
      items.forEach((item) => {
        initPcts[item.id] = item.pct_complete * 100;
      });
      setPocPcts(initPcts);

      const latestUpdate = updatesData[0] ?? null;
      const currentWeekUpdate = updatesData.find((update) => update.week_of === thisSaturday) ?? null;

      if (currentWeekUpdate) {
        seedFromLatest(latestUpdate);
        populateFromUpdate(currentWeekUpdate);
        if (currentWeekUpdate.status === "draft") {
          setDraftUpdateId(currentWeekUpdate.id);
          setSubmittedUpdateId(null);
        } else {
          setDraftUpdateId(null);
          setSubmittedUpdateId(currentWeekUpdate.id);
        }
        setIsEditing(false);
        setEditHistory(currentWeekUpdate.id === latestUpdate?.id ? editHistoryData : []);
      } else {
        resetForNewWeek(latestUpdate);
      }
    } catch {
      setRecentUpdates([]);
      setChangeOrders([]);
      setCoError("Failed to load change orders.");
      resetForNewWeek(null);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  function updateCrewRow(index: number, field: keyof CrewLogEntry, value: string | number) {
    setCrewLog((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function saveWeeklyUpdate(nextStatus: "draft" | "submitted", options?: { stayOnForm?: boolean }) {
    const activeUpdateId = draftUpdateId ?? submittedUpdateId;
    const isSubmittedEdit = Boolean(submittedUpdateId && isEditing);

    setSaving(nextStatus === "draft" ? "draft" : "submit");
    setSaveError(null);
    setStatusMessage(null);

    try {
      const pctDecimal = Math.min(Math.max(pctComplete / 100, 0), 1);
      const pocSnapshot = pocItems.length > 0
        ? pocItems.map((item) => ({
            id: item.id,
            category: item.category,
            weight: item.weight,
            pct_complete: (pocPcts[item.id] ?? item.pct_complete * 100) / 100,
          }))
        : null;

      const response = await fetch("/api/pm/weekly-update", {
        method: activeUpdateId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          updateId: activeUpdateId,
          projectId: project.id,
          weekOf,
          status: nextStatus,
          pctComplete: pctDecimal,
          pocSnapshot,
          crewLog,
          notes: notes || null,
          blockers: blockers || null,
          materialDelivered: materialDelivered || null,
          equipmentSet: equipmentSet || null,
          safetyIncidents: safetyIncidents || null,
          inspectionsTests: inspectionsTests || null,
          delaysImpacts: delaysImpacts || null,
          otherRemarks: otherRemarks || null,
          pocUpdates: pocItems.map((item) => ({
            id: item.id,
            pct_complete: Math.min(Math.max((pocPcts[item.id] ?? item.pct_complete * 100) / 100, 0), 1),
          })),
          billingPeriodId: nextStatus === "submitted" ? project.current_period?.id ?? null : null,
          editNote: isSubmittedEdit ? editNote || null : null,
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error ?? "Save failed. Please try again.");
      }

      await loadData();

      if (nextStatus === "draft") {
        setStatusMessage("Draft saved.");
        return;
      }

      if (isSubmittedEdit || options?.stayOnForm) {
        setEditNote("");
        setIsEditing(false);
        setStatusMessage(json?.editLogged ? "Edit saved and logged." : "Weekly update submitted.");
        return;
      }

      setStatusMessage("Weekly update submitted.");
      setTimeout(() => {
        onBack();
      }, 1200);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    await saveWeeklyUpdate("draft", { stayOnForm: true });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await saveWeeklyUpdate("submitted");
  }

  function handleSelectExistingUpdate(update: WeeklyUpdate) {
    populateFromUpdate(update);
    setSaveError(null);
    setStatusMessage(null);
    setEditNote("");
    if (update.status === "draft") {
      setDraftUpdateId(update.id);
      setSubmittedUpdateId(null);
      setIsEditing(false);
    } else {
      setDraftUpdateId(null);
      setSubmittedUpdateId(update.id);
      setIsEditing(false);
    }
    setEditHistory([]);
  }

  const inputCls =
    "w-full rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-status-success/50 focus:outline-none";
  const labelCls = "mb-1.5 block text-sm font-medium text-text-secondary";
  const isReadOnlySubmitted = Boolean(submittedUpdateId && !isEditing);

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

      {draftUpdateId && weekOf === thisSaturday && (
        <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
          You have a saved draft for this week. Pick up where you left off.
        </div>
      )}

      {saveError && (
        <div className="rounded-xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {saveError}
        </div>
      )}

      {statusMessage && (
        <div className="rounded-xl bg-status-success/10 px-4 py-3 text-sm font-medium text-status-success">
          {statusMessage}
        </div>
      )}

      {isReadOnlySubmitted ? (
        <div className="space-y-4 rounded-2xl border border-border-default bg-surface-raised p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Submitted Report</p>
              <p className="mt-1 text-sm text-text-secondary">Week of {format(new Date(weekOf), "MMMM d, yyyy")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {submittedUpdateId && <ViewReportLink updateId={submittedUpdateId} />}
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-base"
              >
                Edit
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <SummaryField label="Overall % Complete" value={`${pctComplete.toFixed(1)}%`} />
            <SummaryField label="Blockers" value={blockers} />
            <SummaryField label="Material Delivered" value={materialDelivered} />
            <SummaryField label="Equipment Set" value={equipmentSet} />
            <SummaryField label="Safety Incidents" value={safetyIncidents} />
            <SummaryField label="Inspections & Tests" value={inspectionsTests} />
            <SummaryField label="Delays / Impacts" value={delaysImpacts} />
            <SummaryField label="Other Remarks" value={otherRemarks} />
          </div>

          <SummaryField label="Additional Notes" value={notes} />

          <div className="space-y-2 md:hidden">
            {crewLog.filter(hasCrewLogEntry).map((row) => (
              <div key={row.day} className="rounded-xl border border-border-default bg-surface-base px-4 py-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">{row.day}</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  {row.men > 0 && (
                    <span>
                      <span className="text-text-tertiary">Men: </span>
                      <span className="font-medium text-text-primary">{row.men}</span>
                    </span>
                  )}
                  {row.hours > 0 && (
                    <span>
                      <span className="text-text-tertiary">Hours: </span>
                      <span className="font-medium text-text-primary">{row.hours}</span>
                    </span>
                  )}
                </div>
                {row.activities?.trim() && <p className="mt-1.5 text-sm text-text-primary">{row.activities}</p>}
              </div>
            ))}
            {crewLog.every((row) => !hasCrewLogEntry(row)) && <p className="text-sm text-text-tertiary">No crew log entries.</p>}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-border-default md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-overlay text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                  <th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2 text-center"># of Men</th>
                  <th className="px-3 py-2 text-center">Hours</th>
                  <th className="px-3 py-2">Activities</th>
                </tr>
              </thead>
              <tbody>
                {crewLog.map((row) => (
                  <tr key={row.day} className="border-b border-border-default last:border-0">
                    <td className="px-3 py-2 text-text-secondary">{row.day}</td>
                    <td className="px-3 py-2 text-center text-text-primary">{row.men || "-"}</td>
                    <td className="px-3 py-2 text-center text-text-primary">{row.hours || "-"}</td>
                    <td className="px-3 py-2 text-text-primary">{row.activities || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
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
              <p className="mb-1 text-xs text-text-tertiary">Overall % Complete</p>
              <p className="mb-1 text-2xl font-bold text-status-success">{pctComplete.toFixed(1)}%</p>
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

          <div>
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Daily Crew Log</h3>
            <div className="space-y-3 md:hidden">
              {crewLog.map((row, i) => (
                <div key={row.day} className="space-y-2 rounded-xl border border-border-default bg-surface-base px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{row.day}</p>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-text-tertiary"># of Men</label>
                      <input
                        type="number"
                        min={0}
                        value={row.men === 0 ? "" : row.men}
                        onChange={(e) => updateCrewRow(i, "men", Number(e.target.value))}
                        className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-center text-sm text-text-primary focus:border-status-success/50 focus:outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-text-tertiary">Hours</label>
                      <input
                        type="number"
                        min={0}
                        value={row.hours === 0 ? "" : row.hours}
                        onChange={(e) => updateCrewRow(i, "hours", Number(e.target.value))}
                        className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-center text-sm text-text-primary focus:border-status-success/50 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-text-tertiary">Activities</label>
                    <input
                      type="text"
                      value={row.activities}
                      onChange={(e) => updateCrewRow(i, "activities", e.target.value)}
                      placeholder="Work performed..."
                      className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-status-success/50 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-border-default md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-surface-overlay text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                    <th className="w-28 px-3 py-2">Day</th>
                    <th className="w-20 px-3 py-2 text-center"># of Men</th>
                    <th className="w-20 px-3 py-2 text-center">Hours</th>
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

          <div>
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Notes</h3>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Material Delivered</label>
                <input
                  type="text"
                  value={materialDelivered}
                  onChange={(e) => setMaterialDelivered(e.target.value)}
                  placeholder={placeholders.materialDelivered || "e.g. Actuators and VFDs"}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Equipment Set</label>
                <input type="text" value={equipmentSet} onChange={(e) => setEquipmentSet(e.target.value)} placeholder={placeholders.equipmentSet} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Safety Incidents</label>
                <input type="text" value={safetyIncidents} onChange={(e) => setSafetyIncidents(e.target.value)} placeholder={placeholders.safetyIncidents || "None"} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Inspections &amp; Tests</label>
                <input type="text" value={inspectionsTests} onChange={(e) => setInspectionsTests(e.target.value)} placeholder={placeholders.inspectionsTests} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Delays / Impacts</label>
                <input type="text" value={delaysImpacts} onChange={(e) => setDelaysImpacts(e.target.value)} placeholder={placeholders.delaysImpacts} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Other Remarks</label>
                <textarea value={otherRemarks} onChange={(e) => setOtherRemarks(e.target.value)} rows={2} placeholder={placeholders.otherRemarks} className={inputCls} />
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Blockers <span className="text-text-tertiary">(internal - not on report)</span>
            </label>
            <textarea
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              rows={2}
              placeholder="Issues or items needing admin attention?"
              className={inputCls}
            />
          </div>

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

          {submittedUpdateId && isEditing && (
            <div>
              <label className={labelCls}>Reason for edit (optional)</label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="What changed?"
                className={inputCls}
              />
            </div>
          )}

          {pocItems.length > 0 ? (
            <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    % Complete by Category
                    <span className="ml-2 text-xs font-normal text-text-tertiary">(weights sum to {totalWeight})</span>
                  </h3>
                  <p className="mt-1 text-xs text-text-tertiary">
                    Update these near the end after crew log and written notes are complete.
                  </p>
                </div>
                <div className="rounded-lg border border-status-success/20 bg-status-success/5 px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-wide text-text-tertiary">Live Weighted Total</p>
                  <p className="text-base font-semibold text-status-success">
                    {pocPctDecimal !== null ? `${(pocPctDecimal * 100).toFixed(1)}%` : "0.0%"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {pocItems.map((item) => {
                  const val = pocPcts[item.id] ?? item.pct_complete * 100;
                  const contribution = totalWeight > 0 ? (item.weight * (val / 100) / totalWeight) * 100 : 0;

                  return (
                    <div key={item.id} className="rounded-xl border border-border-default bg-surface-base px-3 py-2.5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">{item.category}</p>
                          <p className="text-[11px] text-text-tertiary">
                            Weight {item.weight} • {contribution.toFixed(1)} pts
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={val.toFixed(1)}
                            onChange={(e) => setPocPcts((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                            className="w-20 rounded-lg border border-border-default bg-surface-overlay px-2 py-1.5 text-center text-sm font-semibold text-status-success focus:border-status-success/50 focus:outline-none"
                          />
                          <span className="text-xs text-text-tertiary">%</span>
                        </div>
                      </div>

                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-overlay">
                        <div
                          className="h-full rounded-full bg-status-success/50 transition-all"
                          style={{ width: `${Math.min(val, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border-default p-4 text-sm text-text-tertiary">
              No POC line items configured for this project yet.{" "}
              <span className="text-text-secondary">Use the manual % complete input above, or ask admin to set up POC categories later.</span>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            {submittedUpdateId && isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => void saveWeeklyUpdate("submitted", { stayOnForm: true })}
                  disabled={!!saving}
                  className="flex-1 rounded-xl bg-status-success px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:opacity-90 disabled:opacity-50"
                >
                  {saving === "submit" ? "Saving..." : "Save Edit"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditNote("");
                    setSaveError(null);
                  }}
                  className="flex-1 rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-surface-raised"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handleSaveDraft()}
                  disabled={!!saving}
                  className="flex-1 rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:bg-surface-raised disabled:opacity-50"
                >
                  {saving === "draft" ? "Saving..." : "Save Draft"}
                </button>
                <button
                  type="submit"
                  disabled={!!saving}
                  className="flex-1 rounded-xl bg-status-success px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:opacity-90 disabled:opacity-50"
                >
                  {saving === "submit" ? "Submitting..." : "Submit Weekly Update"}
                </button>
              </>
            )}
          </div>
        </form>
      )}

      {editHistory.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Edit History</h3>
          {editHistory.map((edit) => (
            <div key={edit.id} className="rounded-xl border border-border-default bg-surface-raised px-4 py-2 text-xs text-text-secondary">
              <span className="font-medium text-text-primary">{edit.editor_name ?? "Unknown"}</span>
              {" - "}
              {format(new Date(edit.edited_at), "MMM d, yyyy h:mm a")}
              {edit.note && <p className="mt-0.5 text-text-tertiary">{edit.note}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Change Orders</h3>
        {coError ? (
          <p className="text-sm text-status-danger">{coError}</p>
        ) : changeOrders.filter((co) => co.status !== "void").length === 0 ? (
          <p className="text-sm text-text-tertiary">No change orders on file.</p>
        ) : (
          changeOrders.filter((co) => co.status !== "void").map((co) => (
            <div key={co.id} className="flex items-center justify-between rounded-xl border border-border-default bg-surface-raised px-4 py-2.5 text-sm">
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-text-primary">{co.co_number}</span>
                  <span className="text-text-secondary">-</span>
                  <span className="text-text-primary">{co.title}</span>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      co.status === "approved"
                        ? "bg-status-success/10 text-status-success"
                        : co.status === "rejected"
                          ? "bg-status-danger/10 text-status-danger"
                          : "bg-status-warning/10 text-status-warning",
                    ].join(" ")}
                  >
                    {co.status}
                  </span>
                </div>
                {co.reference_doc && <p className="text-xs text-text-tertiary">Ref: {co.reference_doc}</p>}
              </div>
              <span className={["shrink-0 font-semibold", co.amount >= 0 ? "text-status-success" : "text-status-danger"].join(" ")}>
                {co.amount >= 0 ? "+" : ""}
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(co.amount)}
              </span>
            </div>
          ))
        )}
      </div>

      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-text-secondary">
          WIP / Open Items
          <span className="ml-2 text-text-tertiary group-open:hidden">▼</span>
        </summary>
        <div className="mt-3">
          <WipTab projectId={project.id} readOnly />
        </div>
      </details>

      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Materials / BOM
          <span className="ml-2 text-text-tertiary group-open:hidden">▼</span>
        </summary>
        <div className="mt-3">
          <BomTab projectId={project.id} readOnly />
        </div>
      </details>

      {recentUpdates.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Update History</h3>
          {recentUpdates.map((update) => (
            <div key={update.id} className="rounded-xl border border-border-default bg-surface-raised p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">Week of {format(new Date(update.week_of), "MMM d, yyyy")}</span>
                  <span
                    className={[
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      update.status === "draft" ? "bg-status-warning/10 text-status-warning" : "bg-status-success/10 text-status-success",
                    ].join(" ")}
                  >
                    {update.status === "draft" ? "Draft" : "Submitted"}
                  </span>
                  {update.status === "submitted" && <ViewReportLink updateId={update.id} />}
                </div>
                <div className="flex items-center gap-3">
                  {update.pct_complete !== null && (
                    <span className="text-sm font-semibold text-status-success">
                      {(update.pct_complete * 100).toFixed(1)}%
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSelectExistingUpdate(update)}
                    className="min-h-10 rounded-lg border border-border-default bg-surface-overlay px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
                  >
                    {update.status === "draft" ? "Open Draft" : "Edit"}
                  </button>
                </div>
              </div>
              {update.notes && <p className="mt-1.5 text-sm text-text-secondary">{update.notes}</p>}
              {update.blockers && <p className="mt-1 text-sm text-status-danger">Blocker: {update.blockers}</p>}
              {update.crew_log && update.crew_log.some(hasCrewLogEntry) && (
                <div className="mt-2 space-y-1">
                  {update.crew_log.filter(hasCrewLogEntry).map((row) => (
                    <div key={row.day} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-text-secondary">
                      <span className="w-20 font-medium text-text-primary">{row.day}</span>
                      {row.men > 0 && <span>{row.men} men</span>}
                      {row.hours > 0 && <span>{row.hours} hrs</span>}
                      {row.activities?.trim() && <span className="text-text-secondary">{row.activities}</span>}
                    </div>
                  ))}
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

function SummaryField({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null;

  return (
    <div className="rounded-xl border border-border-default bg-surface-base p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-text-primary">{value}</p>
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

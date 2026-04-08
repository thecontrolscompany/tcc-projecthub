"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addDays, format, startOfWeek } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { ErrorBoundary } from "@/components/error-boundary";
import { ViewReportLink } from "@/components/view-report-link";
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
import { fmtCurrency } from "@/lib/utils/format";
import { ROLE_LABELS, ROLE_BADGE_STYLES_WITH_BORDER } from "@/lib/project/roles";

type ViewState = "list" | "update";
type ProjectTab = "overview" | "contacts" | "update" | "poc" | "change-orders" | "rfis" | "photos" | "bom";

interface ProjectContact {
  id?: string;
  role: string;
  company: string;
  contact_name: string;
  phone: string;
  email: string;
  notes: string;
  sort_order?: number;
}

interface ProjectRfi {
  id: string;
  project_id: string;
  rfi_number: number;
  subject: string;
  question: string | null;
  directed_to: string | null;
  date_submitted: string;
  date_responded: string | null;
  response: string | null;
  status: "open" | "pending_response" | "closed";
  created_at: string;
}

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
  start_date: string | null;
  scheduled_completion: string | null;
  scope_description: string | null;
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<ProjectWithBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const selectedProjectId = searchParams.get("project");
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  function selectProject(project: ProjectWithBilling) {
    window.scrollTo({ top: 0, behavior: "instant" });
    router.push(`/pm?project=${project.id}`);
  }

  function goBack() {
    if (userId) void loadProjects(userId);
    router.push("/pm");
  }

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
          {selectedProject ? (
            <UpdateForm
              project={selectedProject}
              onBack={goBack}
            />
          ) : (
            <ProjectList
              projects={projects}
              onSelectProject={selectProject}
            />
          )}
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
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_STYLES_WITH_BORDER[project.assignmentRole]}`}>
                    {ROLE_LABELS[project.assignmentRole]}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-text-secondary">{project.customer?.name}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                {statusLabel}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Est. Income" value={fmtCurrency(project.estimated_income)} />
              <Stat label="% Complete" value={pct !== null ? `${pct.toFixed(1)}%` : "-"} />
              <Stat label="Prev. Billed" value={period ? fmtCurrency(period.prev_billed) : "-"} />
              <Stat label="To Bill" value={toBill !== null ? fmtCurrency(toBill) : "-"} highlight />
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
  const [includeBomReport, setIncludeBomReport] = useState(false);
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
  const [contacts, setContacts] = useState<ProjectContact[]>([]);
  const [rfis, setRfis] = useState<ProjectRfi[]>([]);
  const [rfisLoading, setRfisLoading] = useState(false);
  const [coError, setCoError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");
  const [manualOverride, setManualOverride] = useState<string>(() =>
    project.current_period ? (project.current_period.pct_complete * 100).toFixed(1) : ""
  );
  const [savingPoc, setSavingPoc] = useState(false);
  const [pocSaveMessage, setPocSaveMessage] = useState<string | null>(null);
  const [pocSaveError, setPocSaveError] = useState<string | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState<BillingPeriod | null | undefined>(project.current_period);

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
        : currentPeriod
          ? currentPeriod.pct_complete * 100
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
    setIncludeBomReport(update.include_bom_report ?? false);
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
    setIncludeBomReport(false);
    setManualOverride(currentPeriod ? (currentPeriod.pct_complete * 100).toFixed(1) : "");
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
      if (response.ok && json?.currentPeriod !== undefined) {
        setCurrentPeriod(json.currentPeriod);
      }
      setContacts((json?.contacts ?? []).map((c: ProjectContact) => ({
        ...c,
        company: c.company ?? "",
        contact_name: c.contact_name ?? "",
        phone: c.phone ?? "",
        email: c.email ?? "",
        notes: c.notes ?? "",
      })));

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
      setContacts([]);
      setRfis([]);
      setCoError("Failed to load change orders.");
      resetForNewWeek(null);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function loadRfis(projectId: string) {
    if (rfisLoading) return;
    setRfisLoading(true);
    try {
      const res = await fetch(`/api/pm/rfis?projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok) setRfis(json.rfis ?? []);
    } catch {
      // silently ignore
    } finally {
      setRfisLoading(false);
    }
  }

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
          billingPeriodId: nextStatus === "submitted" ? currentPeriod?.id ?? null : null,
          editNote: isSubmittedEdit ? editNote || null : null,
          includeBomReport,
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

  async function handleSavePocChanges() {
    setSavingPoc(true);
    setPocSaveError(null);
    setPocSaveMessage(null);

    try {
      const activeUpdateId = draftUpdateId ?? submittedUpdateId;
      const pctDecimal = Math.min(Math.max(pctComplete / 100, 0), 1);
      const response = await fetch("/api/pm/weekly-update", {
        method: activeUpdateId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          updateId: activeUpdateId,
          projectId: project.id,
          weekOf,
          status: "draft",
          pctComplete: pctDecimal,
          pocUpdates: pocItems.map((item) => ({
            id: item.id,
            pct_complete: Math.min(Math.max((pocPcts[item.id] ?? item.pct_complete * 100) / 100, 0), 1),
          })),
        }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.error ?? "Unable to save POC changes.");
      }

      await loadData();
      setPocSaveMessage("POC changes saved.");
    } catch (err) {
      setPocSaveError(err instanceof Error ? err.message : "Unable to save POC changes.");
    } finally {
      setSavingPoc(false);
    }
  }

  function handleSelectExistingUpdate(update: WeeklyUpdate) {
    setActiveTab("update");
    populateFromUpdate(update);
    setSaveError(null);
    setStatusMessage(null);
    setPocSaveError(null);
    setPocSaveMessage(null);
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
  const currentWeekUpdate = recentUpdates.find((update) => update.week_of === thisSaturday) ?? null;
  const latestSubmittedUpdate = recentUpdates.find((update) => update.status === "submitted") ?? null;
  const latestStatusUpdate = latestSubmittedUpdate ?? recentUpdates[0] ?? null;
  const recentOverviewUpdates = recentUpdates.slice(0, 5);
  const statusPct =
    latestStatusUpdate?.pct_complete !== null && latestStatusUpdate?.pct_complete !== undefined
      ? latestStatusUpdate.pct_complete * 100
      : currentPeriod
        ? currentPeriod.pct_complete * 100
        : 0;
  const projectStatus = getPmProjectStatus(currentPeriod ?? undefined, latestStatusUpdate);
  const currentPeriodToBill = currentPeriod
    ? Math.max(currentPeriod.estimated_income_snapshot * currentPeriod.pct_complete - currentPeriod.prev_billed, 0)
    : null;
  const isViewingCurrentReport = currentWeekUpdate
    ? draftUpdateId === currentWeekUpdate.id || submittedUpdateId === currentWeekUpdate.id
    : !draftUpdateId && !submittedUpdateId && weekOf === thisSaturday;
  const activeChangeOrders = changeOrders.filter((co) => co.status !== "void");

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-status-success hover:text-status-success">
        &larr; Back to projects
      </button>

      <div className="rounded-2xl border border-status-success/20 bg-status-success/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-status-success">Daily Construction Report</p>
            <h2 className="mt-1 text-xl font-bold text-text-primary">{project.name}</h2>
            <p className="text-sm text-text-secondary">{project.customer?.name}</p>
          </div>
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${projectStatus.className}`}>
            {projectStatus.label}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border-default bg-surface-raised p-2">
        <PmTabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
          Overview
        </PmTabButton>
        <PmTabButton active={activeTab === "contacts"} onClick={() => setActiveTab("contacts")}>
          Contacts
        </PmTabButton>
        <PmTabButton active={activeTab === "update"} onClick={() => setActiveTab("update")}>
          Weekly Update
          {draftUpdateId && <span className="ml-1.5 inline-flex h-2 w-2 rounded-full bg-status-warning" />}
        </PmTabButton>
        <PmTabButton active={activeTab === "poc"} onClick={() => setActiveTab("poc")}>
          POC &amp; Progress
        </PmTabButton>
        <PmTabButton active={activeTab === "change-orders"} onClick={() => setActiveTab("change-orders")}>
          Change Orders
          {activeChangeOrders.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-surface-overlay px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
              {activeChangeOrders.length}
            </span>
          )}
        </PmTabButton>
        <PmTabButton
          active={activeTab === "rfis"}
          onClick={() => {
            setActiveTab("rfis");
            if (rfis.length === 0 && !rfisLoading) {
              void loadRfis(project.id);
            }
          }}
        >
          RFIs
        </PmTabButton>
        <PmTabButton active={activeTab === "photos"} onClick={() => setActiveTab("photos")}>
          Photos
        </PmTabButton>
        <PmTabButton active={activeTab === "bom"} onClick={() => setActiveTab("bom")}>
          BOM
        </PmTabButton>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-5">
          {!project.scheduled_completion && (
            <div className="flex items-center gap-3 rounded-xl border border-status-danger/30 bg-status-danger/5 px-4 py-3">
              <svg className="h-4 w-4 shrink-0 text-status-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <p className="text-sm font-medium text-status-danger">
                Schedule not received - no completion date on file for this project.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-text-primary">Project Overview</h3>
                <p className="mt-1 text-sm text-text-secondary">Project health snapshot and quick actions for this week.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[32rem]">
                <Stat label="% Complete" value={`${statusPct.toFixed(1)}%`} highlight />
                <Stat label="Contract" value={fmtCurrency(project.estimated_income)} />
                <Stat label="Prev. Billed" value={currentPeriod ? fmtCurrency(currentPeriod.prev_billed) : "-"} />
                <Stat label="To Bill" value={currentPeriodToBill !== null ? fmtCurrency(currentPeriodToBill) : "-"} />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("update")}
                className="rounded-xl bg-status-success px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:opacity-90"
              >
                {currentWeekUpdate?.status === "submitted" ? "Edit This Week's Report -\u003e" : "Submit This Week's Report -\u003e"}
              </button>
              {draftUpdateId && (
                <span className="inline-flex rounded-full border border-status-warning/30 bg-status-warning/10 px-2.5 py-1 text-xs font-medium text-status-warning">
                  Draft in progress
                </span>
              )}
            </div>
            {(project.start_date || project.scheduled_completion) && (
              <div className="mt-5 rounded-2xl border border-border-default bg-surface-raised px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                  Project Dates
                </p>
                <div className="flex flex-wrap gap-6 text-sm">
                  {project.start_date && (
                    <div>
                      <p className="text-xs text-text-tertiary">Start Date</p>
                      <p className="font-medium text-text-primary">
                        {format(new Date(project.start_date), "MMM d, yyyy")}
                      </p>
                    </div>
                  )}
                  {project.scheduled_completion && (
                    <div>
                      <p className="text-xs text-text-tertiary">Scheduled Completion</p>
                      <p className={[
                        "font-medium",
                        new Date(project.scheduled_completion) < new Date()
                          ? "text-status-danger"
                          : "text-text-primary",
                      ].join(" ")}>
                        {format(new Date(project.scheduled_completion), "MMM d, yyyy")}
                        {new Date(project.scheduled_completion) < new Date() && (
                          <span className="ml-1.5 text-xs font-semibold text-status-danger">(Overdue)</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {latestSubmittedUpdate ? (
            <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    Latest Submitted Report - Week of {format(new Date(latestSubmittedUpdate.week_of), "MMM d, yyyy")}
                  </h3>
                  <p className="mt-1 text-xs text-text-tertiary">Most recent submitted field summary.</p>
                </div>
                <ViewReportLink updateId={latestSubmittedUpdate.id} />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <SummaryField label="Material Delivered" value={latestSubmittedUpdate.material_delivered ?? null} />
                <SummaryField label="Equipment Set" value={latestSubmittedUpdate.equipment_set ?? null} />
                <SummaryField label="Safety Incidents" value={latestSubmittedUpdate.safety_incidents ?? null} />
                <SummaryField label="Inspections & Tests" value={latestSubmittedUpdate.inspections_tests ?? null} />
                <SummaryField label="Delays / Impacts" value={latestSubmittedUpdate.delays_impacts ?? null} />
                <SummaryField label="Other Remarks" value={latestSubmittedUpdate.other_remarks ?? null} />
                <SummaryField label="Additional Notes" value={latestSubmittedUpdate.notes ?? null} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border-default bg-surface-raised p-5">
              <h3 className="text-sm font-semibold text-text-primary">Latest Submitted Report</h3>
              <p className="mt-1 text-sm text-text-tertiary">No submitted weekly report yet.</p>
              <button
                type="button"
                onClick={() => setActiveTab("update")}
                className="mt-4 rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-base"
              >
                Submit This Week's Report -&gt;
              </button>
            </div>
          )}

          {project.scope_description && (
            <div className="rounded-2xl border border-border-default bg-surface-raised px-4 py-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                Project Scope
              </p>
              <p className="text-sm leading-relaxed text-text-secondary">
                {project.scope_description}
              </p>
            </div>
          )}

          {(activeChangeOrders.length > 0 || coError) && (
            <div className="flex items-center justify-between rounded-xl border border-border-default bg-surface-raised px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Change Orders</p>
                {coError ? (
                  <p className="mt-0.5 text-sm text-status-danger">Failed to load</p>
                ) : (
                  <p className="mt-0.5 text-sm font-medium text-text-primary">
                    {activeChangeOrders.length} active change order{activeChangeOrders.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("change-orders")}
                className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
              >
                View all -&gt;
              </button>
            </div>
          )}

          {recentOverviewUpdates.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Recent Update History</h3>
              {recentOverviewUpdates.map((update) => (
                <div key={update.id} className="flex flex-col gap-2 rounded-xl border border-border-default bg-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between">
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
                    <span className="text-sm font-semibold text-status-success">
                      {update.pct_complete !== null ? `${(update.pct_complete * 100).toFixed(1)}%` : "-"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectExistingUpdate(update)}
                    className="min-h-10 rounded-lg border border-border-default bg-surface-overlay px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "contacts" && (
        <ContactsTab
          projectId={project.id}
          contacts={contacts}
          onSaved={(updated) => setContacts(updated)}
        />
      )}

      {activeTab === "update" && (
        <>
          {!project.scheduled_completion && (
            <div className="flex items-center gap-3 rounded-xl border border-status-danger/30 bg-status-danger/5 px-4 py-3">
              <svg className="h-4 w-4 shrink-0 text-status-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <p className="text-sm font-medium text-status-danger">
                Schedule not received - no completion date on file for this project.
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-default bg-surface-raised p-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">Weekly Update</p>
              <p className="mt-1 text-xs text-text-tertiary">
                Defaulted to the current week. Open the current report or start a new one from here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveTab("update");
                resetForNewWeek(recentUpdates[0] ?? null);
              }}
              disabled={isViewingCurrentReport}
              className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-50"
            >
              {currentWeekUpdate ? "Open Current Report" : "Create New Report"}
            </button>
          </div>

          {draftUpdateId && weekOf === thisSaturday && (
            <div className="rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
              You have a saved draft for this week. Pick up where you left off.
            </div>
          )}

          {saveError && <div className="rounded-xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">{saveError}</div>}

          {statusMessage && (
            <div className="rounded-xl bg-status-success/10 px-4 py-3 text-sm font-medium text-status-success">{statusMessage}</div>
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
                    <div className="space-y-2">
                      <p className="text-xs text-text-tertiary">Calculated from POC</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-lg font-semibold text-text-primary">
                          {pocPctDecimal !== null ? `${(pocPctDecimal * 100).toFixed(1)}%` : "Not configured"}
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab("poc")}
                          className="text-sm font-medium text-status-success hover:underline"
                        >
                          Update POC -&gt;
                        </button>
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
                          placeholder={currentPeriod ? (currentPeriod.pct_complete * 100).toFixed(1) : "0.0"}
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

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border-default bg-surface-overlay px-4 py-3">
                <input
                  type="checkbox"
                  checked={includeBomReport}
                  onChange={(e) => setIncludeBomReport(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-brand-primary)]"
                />
                <span className="text-sm text-text-primary">
                  Include BOM report in this week&apos;s report
                </span>
              </label>

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
        </>
      )}

      {activeTab === "poc" && (
        <div className="space-y-5 rounded-2xl border border-border-default bg-surface-raised p-5">
          <div>
            <h3 className="text-lg font-bold text-text-primary">POC &amp; Progress</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Update category completion percentages. Changes here drive the overall % complete reported on your weekly update.
            </p>
          </div>

          {pocSaveError && <div className="rounded-xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">{pocSaveError}</div>}
          {pocSaveMessage && (
            <div className="rounded-xl bg-status-success/10 px-4 py-3 text-sm font-medium text-status-success">{pocSaveMessage}</div>
          )}

          {pocItems.length > 0 ? (
            <>
              <div className="rounded-2xl border border-border-default bg-surface-base p-4">
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
                      <div key={item.id} className="rounded-xl border border-border-default bg-surface-raised px-3 py-2.5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text-primary">{item.category}</p>
                            <p className="text-[11px] text-text-tertiary">
                              Weight {item.weight} - {contribution.toFixed(1)} pts
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

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleSavePocChanges()}
                  disabled={savingPoc}
                  className="rounded-xl bg-status-success px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:opacity-90 disabled:opacity-50"
                >
                  {savingPoc ? "Saving..." : "Save POC Changes"}
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border-default p-4">
              <label className="mb-1 block text-sm font-medium text-text-primary">Enter % Complete</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={manualOverride}
                  onChange={(e) => setManualOverride(e.target.value)}
                  placeholder={currentPeriod ? (currentPeriod.pct_complete * 100).toFixed(1) : "0.0"}
                  className="w-32 rounded-lg border border-border-default bg-surface-base px-3 py-2 text-center text-sm font-semibold text-text-primary focus:border-status-success/50 focus:outline-none"
                />
                <span className="text-sm text-text-secondary">
                  No POC categories are configured for this project. Enter % complete manually on the Weekly Update tab, or ask admin to set up POC categories.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "change-orders" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Change Orders</h3>
            <p className="mt-1 text-sm text-text-tertiary">
              Change orders on this project. Contact admin to add or update change orders.
            </p>
          </div>

          {coError ? (
            <p className="text-sm text-status-danger">{coError}</p>
          ) : changeOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-default px-6 py-10 text-center">
              <p className="text-sm font-medium text-text-secondary">No change orders on file.</p>
              <p className="mt-1 text-xs text-text-tertiary">Change orders will appear here once added by admin.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {changeOrders.map((co) => (
                <div
                  key={co.id}
                  className={[
                    "flex items-center justify-between rounded-xl border px-4 py-3 text-sm",
                    co.status === "void"
                      ? "border-border-default bg-surface-base opacity-50"
                      : "border-border-default bg-surface-raised",
                  ].join(" ")}
                >
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
                              : co.status === "void"
                                ? "bg-surface-overlay text-text-tertiary"
                                : "bg-status-warning/10 text-status-warning",
                        ].join(" ")}
                      >
                        {co.status}
                      </span>
                    </div>
                    {co.reference_doc && (
                      <p className="text-xs text-text-tertiary">Ref: {co.reference_doc}</p>
                    )}
                  </div>
                  <span
                    className={[
                      "shrink-0 font-semibold",
                      co.status === "void"
                        ? "text-text-tertiary"
                        : co.amount >= 0
                          ? "text-status-success"
                          : "text-status-danger",
                    ].join(" ")}
                  >
                    {co.amount >= 0 ? "+" : ""}
                    {fmtCurrency(co.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {changeOrders.filter((co) => co.status === "approved").length > 0 && (
            <div className="rounded-xl border border-status-success/20 bg-status-success/5 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Total Approved CO Value</p>
              <p className="mt-1 text-base font-bold text-status-success">
                {fmtCurrency(changeOrders.filter((co) => co.status === "approved").reduce((sum, co) => sum + co.amount, 0))}
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === "rfis" && (
        <RfiTab
          projectId={project.id}
          rfis={rfis}
          loading={rfisLoading}
          onCreated={(rfi) => setRfis((prev) => [rfi, ...prev])}
          onUpdated={(rfi) => setRfis((prev) => prev.map((r) => (r.id === rfi.id ? rfi : r)))}
        />
      )}

      {activeTab === "photos" && (
        <PhotosTab projectId={project.id} />
      )}

      {activeTab === "bom" && (
        <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
          <BomTab projectId={project.id} readOnly />
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

const CONTACT_ROLES = [
  { key: "gc", label: "General Contractor" },
  { key: "mechanical", label: "Mechanical Contractor" },
  { key: "electrical", label: "Electrical Contractor" },
  { key: "owner", label: "Owner / Owner's Rep" },
  { key: "architect", label: "Architect" },
  { key: "engineer", label: "Engineer" },
  { key: "other", label: "Other" },
];

const RFI_DIRECTED_TO_OPTIONS = [
  "General Contractor",
  "Architect",
  "Engineer",
  "Owner / Owner's Rep",
  "Other",
];

function ContactsTab({
  projectId,
  contacts,
  onSaved,
}: {
  projectId: string;
  contacts: ProjectContact[];
  onSaved: (updated: ProjectContact[]) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<ProjectContact[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function enterEdit() {
    const rows: ProjectContact[] = CONTACT_ROLES.map((r, i) => {
      const existing = contacts.find((c) => c.role === r.key);
      return existing
        ? {
            ...existing,
            company: existing.company ?? "",
            contact_name: existing.contact_name ?? "",
            phone: existing.phone ?? "",
            email: existing.email ?? "",
            notes: existing.notes ?? "",
          }
        : { role: r.key, company: "", contact_name: "", phone: "", email: "", notes: "", sort_order: i };
    });
    setDraft(rows);
    setSaveError(null);
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setSaveError(null);
  }

  function updateDraft(index: number, field: keyof ProjectContact, value: string) {
    setDraft((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function saveContacts() {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/pm/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ project_id: projectId, contacts: draft }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error ?? "Failed to save.");
      const saved = draft.filter(
        (c) => c.company || c.contact_name || c.phone || c.email || c.notes
      );
      onSaved(saved);
      setEditMode(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save contacts.");
    } finally {
      setSaving(false);
    }
  }

  if (!editMode) {
    const populated = contacts.filter(
      (c) => c.company || c.contact_name || c.phone || c.email
    );
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Project Contacts</h3>
            <p className="mt-0.5 text-sm text-text-tertiary">
              Key contacts for this project.
            </p>
          </div>
          <button
            type="button"
            onClick={enterEdit}
            className="rounded-lg border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
          >
            Edit Contacts
          </button>
        </div>

        {populated.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-default px-6 py-10 text-center">
            <p className="text-sm font-medium text-text-secondary">No contacts on file.</p>
            <p className="mt-1 text-xs text-text-tertiary">
              Click Edit Contacts to add GC, mechanical, electrical, and other key contacts.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {populated.map((contact, i) => {
              const roleLabel =
                CONTACT_ROLES.find((r) => r.key === contact.role)?.label ?? contact.role;
              return (
                <div
                  key={contact.id ?? i}
                  className="rounded-2xl border border-border-default bg-surface-raised p-4 space-y-2"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                    {roleLabel}
                  </p>
                  {contact.company && (
                    <p className="font-semibold text-text-primary">{contact.company}</p>
                  )}
                  {contact.contact_name && (
                    <p className="text-sm text-text-secondary">{contact.contact_name}</p>
                  )}
                  <div className="space-y-1">
                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="block text-sm text-brand-primary hover:underline"
                      >
                        {contact.phone}
                      </a>
                    )}
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="block text-sm text-brand-primary hover:underline"
                      >
                        {contact.email}
                      </a>
                    )}
                  </div>
                  {contact.notes && (
                    <p className="text-xs text-text-tertiary">{contact.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Edit Contacts</h3>
          <p className="mt-0.5 text-sm text-text-tertiary">
            All fields are optional. Leave blank to omit a contact.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            className="rounded-lg border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-base"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void saveContacts()}
            disabled={saving}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {saveError && (
        <p className="rounded-xl border border-status-danger/20 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
          {saveError}
        </p>
      )}

      <div className="space-y-6">
        {draft.map((row, index) => {
          const roleLabel =
            CONTACT_ROLES.find((r) => r.key === row.role)?.label ?? row.role;
          return (
            <div
              key={row.role}
              className="rounded-2xl border border-border-default bg-surface-raised p-4 space-y-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                {roleLabel}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Company
                  </label>
                  <input
                    type="text"
                    value={row.company}
                    onChange={(e) => updateDraft(index, "company", e.target.value)}
                    className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
                    placeholder="Company name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={row.contact_name}
                    onChange={(e) => updateDraft(index, "contact_name", e.target.value)}
                    className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
                    placeholder="First Last"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={row.phone}
                    onChange={(e) => updateDraft(index, "phone", e.target.value)}
                    className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
                    placeholder="(555) 555-5555"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    Email
                  </label>
                  <input
                    type="email"
                    value={row.email}
                    onChange={(e) => updateDraft(index, "email", e.target.value)}
                    className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
                    placeholder="email@company.com"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  Notes
                </label>
                <input
                  type="text"
                  value={row.notes}
                  onChange={(e) => updateDraft(index, "notes", e.target.value)}
                  className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
                  placeholder="Optional notes"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RfiTab({
  projectId,
  rfis,
  loading,
  onCreated,
  onUpdated,
}: {
  projectId: string;
  rfis: ProjectRfi[];
  loading: boolean;
  onCreated: (rfi: ProjectRfi) => void;
  onUpdated: (rfi: ProjectRfi) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [directedTo, setDirectedTo] = useState("");
  const [dateSubmitted, setDateSubmitted] = useState(() => new Date().toISOString().slice(0, 10));
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeResponse, setCloseResponse] = useState("");
  const [closeDate, setCloseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [closeStatus, setCloseStatus] = useState<"pending_response" | "closed">("closed");

  function resetForm() {
    setSubject("");
    setQuestion("");
    setDirectedTo("");
    setDateSubmitted(new Date().toISOString().slice(0, 10));
    setFormError(null);
  }

  async function submitRfi() {
    if (!subject.trim()) {
      setFormError("Subject is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/pm/rfis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId, subject, question, directedTo, dateSubmitted }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save.");
      onCreated(json.rfi as ProjectRfi);
      resetForm();
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function updateRfi(id: string, updates: Partial<{ status: string; response: string; dateResponded: string }>) {
    setSaving(true);
    try {
      const res = await fetch("/api/pm/rfis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, ...updates }),
      });
      const json = await res.json();
      if (res.ok) {
        onUpdated(json.rfi as ProjectRfi);
        setClosingId(null);
        setCloseResponse("");
      }
    } finally {
      setSaving(false);
    }
  }

  const statusConfig = {
    open: { label: "Open", className: "bg-status-danger/10 text-status-danger" },
    pending_response: { label: "Pending Response", className: "bg-status-warning/10 text-status-warning" },
    closed: { label: "Closed", className: "bg-status-success/10 text-status-success" },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">RFI Log</h3>
          <p className="mt-0.5 text-sm text-text-tertiary">Request for Information tracking.</p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            + New RFI
          </button>
        )}
      </div>

      {showForm && (
        <div className="space-y-3 rounded-2xl border border-border-default bg-surface-raised p-4">
          <p className="text-sm font-semibold text-text-primary">New RFI</p>
          {formError && <p className="text-sm text-status-danger">{formError}</p>}
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Subject *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
              placeholder="Brief subject line"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Question</label>
            <textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
              placeholder="Full RFI question text"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Directed To</label>
              <select
                value={directedTo}
                onChange={(e) => setDirectedTo(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:outline-none"
              >
                <option value="">- Select -</option>
                {RFI_DIRECTED_TO_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Date Submitted</label>
              <input
                type="date"
                value={dateSubmitted}
                onChange={(e) => setDateSubmitted(e.target.value)}
                className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => void submitRfi()}
              disabled={saving}
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Log RFI"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="rounded-lg border border-border-default px-4 py-2 text-sm font-semibold text-text-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-tertiary">Loading RFIs...</p>
      ) : rfis.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-default px-6 py-10 text-center">
          <p className="text-sm font-medium text-text-secondary">No RFIs logged yet.</p>
          <p className="mt-1 text-xs text-text-tertiary">Use the New RFI button to log a field question.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rfis.map((rfi) => {
            const cfg = statusConfig[rfi.status];
            const isExpanded = expandedId === rfi.id;
            const isClosing = closingId === rfi.id;
            return (
              <div key={rfi.id} className="overflow-hidden rounded-xl border border-border-default bg-surface-raised">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : rfi.id)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-text-tertiary">
                        RFI-{String(rfi.rfi_number).padStart(3, "0")}
                      </span>
                      <span className="text-sm font-medium text-text-primary">{rfi.subject}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
                      {rfi.directed_to && <span>-&gt; {rfi.directed_to}</span>}
                      <span>
                        {new Date(rfi.date_submitted).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </span>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}>
                    {cfg.label}
                  </span>
                </button>

                {isExpanded && (
                  <div className="space-y-3 border-t border-border-default px-4 py-3">
                    {rfi.question && (
                      <div>
                        <p className="mb-0.5 text-xs font-semibold text-text-tertiary">Question</p>
                        <p className="whitespace-pre-wrap text-sm text-text-secondary">{rfi.question}</p>
                      </div>
                    )}
                    {rfi.response && (
                      <div>
                        <p className="mb-0.5 text-xs font-semibold text-text-tertiary">Response</p>
                        <p className="whitespace-pre-wrap text-sm text-text-secondary">{rfi.response}</p>
                        {rfi.date_responded && (
                          <p className="mt-0.5 text-xs text-text-tertiary">
                            Received{" "}
                            {new Date(rfi.date_responded).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              timeZone: "UTC",
                            })}
                          </p>
                        )}
                      </div>
                    )}

                    {rfi.status !== "closed" && !isClosing && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setClosingId(rfi.id);
                            setCloseResponse(rfi.response ?? "");
                            setCloseDate(new Date().toISOString().slice(0, 10));
                            setCloseStatus("closed");
                          }}
                          className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-base"
                        >
                          Log Response / Close
                        </button>
                        {rfi.status === "open" && (
                          <button
                            type="button"
                            onClick={() => void updateRfi(rfi.id, { status: "pending_response" })}
                            disabled={saving}
                            className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-base disabled:opacity-50"
                          >
                            Mark Pending Response
                          </button>
                        )}
                      </div>
                    )}

                    {isClosing && (
                      <div className="space-y-3 rounded-xl border border-border-default bg-surface-base p-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-text-secondary">Response Text</label>
                          <textarea
                            rows={2}
                            value={closeResponse}
                            onChange={(e) => setCloseResponse(e.target.value)}
                            className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-text-secondary">Date Responded</label>
                            <input
                              type="date"
                              value={closeDate}
                              onChange={(e) => setCloseDate(e.target.value)}
                              className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-text-secondary">Mark As</label>
                            <select
                              value={closeStatus}
                              onChange={(e) => setCloseStatus(e.target.value as "pending_response" | "closed")}
                              className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:outline-none"
                            >
                              <option value="closed">Closed</option>
                              <option value="pending_response">Pending Response</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void updateRfi(rfi.id, {
                                status: closeStatus,
                                response: closeResponse,
                                dateResponded: closeDate,
                              })
                            }
                            disabled={saving}
                            className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setClosingId(null)}
                            className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PhotosTab({ projectId }: { projectId: string }) {
  const [photos, setPhotos] = useState<Array<{
    id: string;
    caption: string | null;
    filename: string;
    content_type: string;
    sharepoint_web_url: string | null;
    taken_date: string | null;
    created_at: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingCaption, setPendingCaption] = useState("");
  const [pendingDate, setPendingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function loadPhotos() {
    setLoading(true);
    try {
      const res = await fetch(`/api/pm/photos?projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (res.ok) setPhotos(json.photos ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("projectId", projectId);
      if (pendingCaption.trim()) fd.append("caption", pendingCaption.trim());
      if (pendingDate) fd.append("takenDate", pendingDate);

      const res = await fetch("/api/pm/photos", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Upload failed.");
      setPhotos((prev) => [json.photo, ...prev]);
      setPendingCaption("");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      await uploadFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Site Photos</h3>
          <p className="mt-0.5 text-sm text-text-tertiary">Photos are stored in the project&apos;s SharePoint folder.</p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-border-default bg-surface-raised p-4">
        <p className="text-sm font-semibold text-text-primary">Upload Photos</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Caption (applies to all selected)</label>
            <input
              type="text"
              value={pendingCaption}
              onChange={(e) => setPendingCaption(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
              placeholder="Optional caption"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Date Taken</label>
            <input
              type="date"
              value={pendingDate}
              onChange={(e) => setPendingDate(e.target.value)}
              className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:outline-none"
            />
          </div>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void handleFileChange(e)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-base disabled:opacity-60"
          >
            {uploading ? "Uploading..." : "Choose Photos"}
          </button>
          <span className="ml-3 text-xs text-text-tertiary">Images only, max 20 MB each</span>
        </div>
        {uploadError && <p className="text-sm text-status-danger">{uploadError}</p>}
      </div>

      {loading ? (
        <p className="text-sm text-text-tertiary">Loading photos...</p>
      ) : photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-default px-6 py-10 text-center">
          <p className="text-sm font-medium text-text-secondary">No photos uploaded yet.</p>
          <p className="mt-1 text-xs text-text-tertiary">Use the upload area above to add site photos.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
              <img
                src={`/api/pm/photos/${photo.id}/content`}
                alt={photo.caption ?? photo.filename}
                className="h-44 w-full object-cover"
                loading="lazy"
              />
              <div className="space-y-0.5 px-3 py-2">
                {photo.caption && <p className="text-sm font-medium text-text-primary">{photo.caption}</p>}
                <p className="text-xs text-text-tertiary">
                  {photo.taken_date
                    ? new Date(photo.taken_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })
                    : new Date(photo.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                </p>
                {photo.sharepoint_web_url && (
                  <a
                    href={photo.sharepoint_web_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-primary hover:underline"
                  >
                    View in SharePoint -&gt;
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PmTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-brand-primary text-text-inverse shadow-sm"
          : "text-text-secondary hover:bg-surface-overlay hover:text-text-primary",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function getPmProjectStatus(period: BillingPeriod | undefined, latestUpdate: WeeklyUpdate | null) {
  if (period?.pct_complete !== undefined && period.pct_complete >= 1) {
    return {
      label: "Complete",
      className: "border-border-default bg-surface-overlay/50 text-text-secondary",
    };
  }

  if (latestUpdate?.blockers?.trim()) {
    return {
      label: "Needs Attention",
      className: "border-status-danger/20 bg-status-danger/10 text-status-danger",
    };
  }

  if (period && period.pct_complete < period.prior_pct) {
    return {
      label: "Behind",
      className: "border-status-warning/20 bg-status-warning/10 text-status-warning",
    };
  }

  return {
    label: "On Track",
    className: "border-status-success/20 bg-status-success/10 text-status-success",
  };
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

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { calcEstimate, calcItem, COMPS_MAP, TYPE_META } from "@/modules/hvac-estimator/components/estimate/estimateCalc";
import { AddEquipButtons } from "@/modules/hvac-estimator/components/estimate/AddEquipButtons";
import { AiTakeoffModal } from "@/modules/hvac-estimator/components/estimate/AiTakeoffModal";
import { EstimateEditorWorkspace } from "@/modules/hvac-estimator/components/estimate/EstimateEditorWorkspace";
import ConduitFillPage from "@/modules/hvac-estimator/components/conduitFill/ConduitFillPage";
import { ProjectSettingsPanel } from "@/modules/hvac-estimator/components/estimate/ProjectSettingsPanel";
import { ProposalDetailsModal } from "@/modules/hvac-estimator/components/estimate/ProposalDetailsModal";
import { BidAlternateEditor } from "@/modules/hvac-estimator/components/estimate/BidAlternateEditor";
import { computeCosts, DEFAULT_SETTINGS, getEstimateScopeModeLabel, normalizeEstimateScopeMode } from "@/modules/hvac-estimator/components/estimate/projectSettings";
import { applyAhuDefaultSelections, getVisibleAhuComponents, normalizeAhuCfg } from "@/modules/hvac-estimator/components/ahu/ahuData";
import { applyDxDefaultSelections, getVisibleDxComponents, normalizeDxCfg } from "@/modules/hvac-estimator/components/dx/dxData";
import { applyFcuDefaultSelections, getVisibleFcuComponents, normalizeFcuCfg } from "@/modules/hvac-estimator/components/fcu/fcuData";
import { applyRtuDefaultSelections, getVisibleRtuComponents, normalizeRtuCfg } from "@/modules/hvac-estimator/components/rtu/rtuData";
import { applyUhDefaultSelections, getVisibleUhComponents, normalizeUhCfg } from "@/modules/hvac-estimator/components/uh/uhData";
import { applyVavDefaultSelections, getVisibleVavComponents, normalizeVavCfg } from "@/modules/hvac-estimator/components/vav/vavData";
import { buildDefaultVrfSelected, getVisibleVrfComponents, normalizeVrfCfg } from "@/modules/hvac-estimator/components/vrf/vrfData";
import { summarizeHvacEstimate, type HvacEstimateBody } from "@/modules/hvac-estimator/platform-adapter";
import { ProjectHubEstimateProvider, useEstimate } from "@/modules/hvac-estimator/shared/EstimateContext";
import { CONDUIT_FILL_RESTORE_KEY } from "@/modules/hvac-estimator/shared/conduitFill";
import { getCustomComponentOptions } from "@/modules/hvac-estimator/shared/componentCatalog";
import { UnitaryFlowDiagram } from "@/modules/hvac-estimator/shared/UnitaryFlowDiagram";
import { applyImportedScopeImportToEstimate } from "@/modules/hvac-estimator/ai/scopeImportToEstimate";
import { ProjectHubOntologyGraphicPanel } from "@/modules/hvac-estimator/shared/ProjectHubOntologyGraphicPanel";
import { resolveProjectHubGraphicsSource } from "@/modules/hvac-estimator/shared/projecthubGraphics";
import type { EstimateRecord, EstimateStatus } from "@/types/database";

type Props = {
  estimate: EstimateRecord;
};

type EstimateItem = {
  id: string;
  type: string;
  tag: string;
  location: string;
  qty: number;
  installType: "EMT" | "Plenum";
  selected: Array<{ id: string; qty: number }>;
  custom: Array<Record<string, unknown>>;
  priceSnap: Record<string, unknown>;
  cfg: Record<string, unknown>;
};

type EstimateBody = Omit<HvacEstimateBody, "items"> & {
  items: EstimateItem[];
  alternates?: Array<Record<string, unknown>>;
  platformContext?: Record<string, unknown> | null;
  sharepointFolder?: string | null;
  sharepointItemId?: string | null;
};

type AddItemForm = {
  type: string;
  tag: string;
  location: string;
  qty: string;
  installType: "EMT" | "Plenum";
  cfg: Record<string, unknown>;
  selected: Array<{ id: string; qty: number }>;
};

type LocalDraft = {
  body: EstimateBody;
  status: EstimateStatus;
  savedAt: string;
};

type HvacComponent = {
  id: string;
  label?: string;
  name?: string;
  groupId?: string;
  sourceType?: string;
  sourceLabel?: string;
};

const statusOptions: EstimateStatus[] = [
  "draft",
  "in_progress",
  "ready",
  "proposal_exported",
  "awarded",
  "archived",
];

const equipmentButtons = [
  { type: "ahu", label: "AHU", bg: "#0D9488" },
  { type: "vav", label: "VAV", bg: "#2563EB" },
  { type: "rtu", label: "RTU", bg: "#7C3AED" },
  { type: "dx", label: "DX/HP", bg: "#4338CA" },
  { type: "vrf", label: "VRF", bg: "#047857" },
  { type: "fcu", label: "FCU", bg: "#EA580C" },
  { type: "uh", label: "UH", bg: "#DC2626" },
  { type: "plant", label: "Plant", bg: "#0369A1" },
  { type: "network", label: "Network", bg: "#059669" },
  { type: "exhaust-fan", label: "Exhaust Fan", bg: "#B45309" },
  { type: "custom", label: "Custom", bg: "#6B7280" },
];

const supportedEquipmentTypes = equipmentButtons.map((button) => button.type);
const diagramSupportedEquipmentTypes = new Set(["rtu", "dx", "vrf", "uh"]);
const customComponentOptions = getCustomComponentOptions();
const LOCAL_DRAFT_PREFIX = "hvac-estimate-draft";

const inputClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const labelClassName = "mb-1 block text-xs font-medium uppercase tracking-wide text-text-tertiary";

const legacyDiagramTheme = {
  "--t-bg": "#F8FAFC",
  "--t-surface": "#FFFFFF",
  "--t-panel": "#F1F5F9",
  "--t-border": "#CBD5E1",
  "--t-border2": "#94A3B8",
  "--t-text": "#0F172A",
  "--t-muted": "#64748B",
  "--t-dim": "#94A3B8",
  "--t-faint": "#E2E8F0",
  "--t-blue": "#2563EB",
  "--t-blue-l": "#60A5FA",
  "--t-blue-faint": "#EFF6FF",
  "--t-blue-mid": "#93C5FD",
  "--t-blue-mid-a60": "rgba(147, 197, 253, 0.6)",
  "--t-blue-a18": "rgba(37, 99, 235, 0.18)",
  "--t-steel": "#475569",
  "--t-green": "#16A34A",
  "--t-amber": "#D97706",
  "--t-purple": "#7C3AED",
  "--t-teal": "#0D9488",
  "--t-rose": "#E11D48",
  "--t-cyan": "#0891B2",
} as CSSProperties;

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown, fallback = 1) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getDraftKey(estimateId: string) {
  return `${LOCAL_DRAFT_PREFIX}:${estimateId}`;
}

function readLocalDraft(estimateId: string): LocalDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getDraftKey(estimateId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalDraft>;
    if (!parsed || typeof parsed !== "object" || !parsed.body || typeof parsed.body !== "object") return null;
    if (typeof parsed.status !== "string") return null;
    if (parsed.body.id && parsed.body.id !== estimateId) return null;
    return {
      body: parsed.body as EstimateBody,
      status: parsed.status as EstimateStatus,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    };
  } catch {
    return null;
  }
}

function mergeRecoveredBodies(serverBody: EstimateBody, draftBody: EstimateBody): EstimateBody {
  return {
    ...serverBody,
    ...draftBody,
    settings: {
      ...serverBody.settings,
      ...(draftBody.settings ?? {}),
    },
    sharepointFolder:
      typeof draftBody.sharepointFolder === "string" && draftBody.sharepointFolder
        ? draftBody.sharepointFolder
        : serverBody.sharepointFolder,
    sharepointItemId:
      typeof draftBody.sharepointItemId === "string" && draftBody.sharepointItemId
        ? draftBody.sharepointItemId
        : serverBody.sharepointItemId,
  };
}

function writeLocalDraft(estimateId: string, body: EstimateBody, status: EstimateStatus) {
  if (typeof window === "undefined") return;
  try {
    const draft: LocalDraft = { body, status, savedAt: new Date().toISOString() };
    window.localStorage.setItem(getDraftKey(estimateId), JSON.stringify(draft));
  } catch {
    // Ignore localStorage failures.
  }
}

function clearLocalDraft(estimateId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getDraftKey(estimateId));
  } catch {
    // Ignore localStorage failures.
  }
}

function getInitialEstimateState(estimate: EstimateRecord): { body: EstimateBody; status: EstimateStatus; recovered: boolean } {
  const serverBody = normalizeBody(estimate);
  const serverStatus = estimate.status;
  const draft = readLocalDraft(estimate.id);
  if (!draft) return { body: serverBody, status: serverStatus, recovered: false };

  const draftTime = new Date(draft.body.updatedAt || draft.savedAt || "").getTime();
  const serverTime = new Date(estimate.updated_at).getTime();
  if (!Number.isFinite(draftTime) || !Number.isFinite(serverTime) || draftTime <= serverTime) {
    return { body: serverBody, status: serverStatus, recovered: false };
  }

  return { body: mergeRecoveredBodies(serverBody, draft.body), status: draft.status, recovered: true };
}

function getTypeMeta(type: string) {
  return (TYPE_META as Record<string, { label: string; color: string; bg: string }>)[type] ?? {
    label: type.toUpperCase(),
    color: "currentColor",
    bg: "transparent",
  };
}

function getComponents(type: string) {
  const value = (COMPS_MAP as Record<string, HvacComponent[] | undefined>)[type];
  return Array.isArray(value) ? value : [];
}

function getComponentLabel(component: HvacComponent) {
  return component.label ?? component.name ?? component.id;
}

function getCustomComponentId(cfg: Record<string, unknown>) {
  const value = asString(cfg.componentId);
  if (value) return value;
  return customComponentOptions[0]?.id ?? "";
}

function getDefaultCfg(type: string) {
  switch (type) {
    case "ahu":
      return normalizeAhuCfg({});
    case "vav":
      return normalizeVavCfg({});
    case "rtu":
      return normalizeRtuCfg({});
    case "dx":
      return normalizeDxCfg({});
    case "vrf":
      return normalizeVrfCfg({});
    case "fcu":
      return normalizeFcuCfg({});
    case "uh":
      return normalizeUhCfg({});
    case "custom":
      return { componentId: customComponentOptions[0]?.id ?? "" };
    default:
      return {};
  }
}

function getVisibleComponentsForType(type: string, cfg: Record<string, unknown>) {
  switch (type) {
    case "ahu":
      return getVisibleAhuComponents(cfg);
    case "vav":
      return getVisibleVavComponents(cfg);
    case "rtu":
      return getVisibleRtuComponents(cfg);
    case "dx":
      return getVisibleDxComponents(cfg);
    case "vrf":
      return getVisibleVrfComponents(cfg);
    case "fcu":
      return getVisibleFcuComponents(cfg);
    case "uh":
      return getVisibleUhComponents(cfg);
    case "custom": {
      return customComponentOptions.map((component) => ({
        ...component.component,
        sourceType: component.type,
        sourceLabel: component.typeLabel,
      }));
    }
    default:
      return getComponents(type);
  }
}

function getDefaultSelectedForType(type: string, cfg: Record<string, unknown>) {
  switch (type) {
    case "ahu":
      return applyAhuDefaultSelections([], cfg);
    case "vav":
      return applyVavDefaultSelections([], cfg);
    case "rtu":
      return applyRtuDefaultSelections([], cfg);
    case "dx":
      return applyDxDefaultSelections([], cfg);
    case "vrf":
      return buildDefaultVrfSelected(cfg);
    case "fcu":
      return applyFcuDefaultSelections([], cfg);
    case "uh":
      return applyUhDefaultSelections([], cfg);
    case "custom": {
      const componentId = getCustomComponentId(cfg);
      return componentId ? [{ id: componentId, qty: 1 }] : [];
    }
    default:
      return getComponents(type)
        .filter((component) => Boolean((component as HvacComponent & { def?: boolean }).def))
        .map((component) => ({ id: component.id, qty: 1 }));
  }
}

function normalizeBody(record: EstimateRecord): EstimateBody {
  const body = record.body as Partial<EstimateBody>;
  return {
    id: asString(body.id) || record.id,
    organizationId: asString(body.organizationId) || record.organization_id,
    linkedOpportunityId: asString(body.linkedOpportunityId) || record.linked_opportunity_id,
    linkedProjectId: asString(body.linkedProjectId) || record.linked_project_id,
    platformContext: body.platformContext ?? null,
    name: asString(body.name) || record.name || "Untitled Estimate",
    number: asString(body.number) || record.number || "",
    sharepointFolder: asString(body.sharepointFolder) || null,
    sharepointItemId: asString(body.sharepointItemId) || null,
    customerAccountId: asString(body.customerAccountId) || null,
    customer: asString(body.customer),
    bidder: asString(body.bidder) || null,
    version: asString(body.version) || "1.0",
    notes: asString(body.notes),
    settings: { ...DEFAULT_SETTINGS, ...(body.settings ?? {}) },
    alternates: Array.isArray(body.alternates) ? body.alternates : [],
    createdAt: asString(body.createdAt) || record.created_at,
    updatedAt: asString(body.updatedAt) || record.updated_at,
    createdBy: body.createdBy ?? null,
    updatedBy: body.updatedBy ?? null,
    items: Array.isArray(body.items) ? (body.items as EstimateItem[]) : [],
  };
}

function buildAddForm(type = "ahu"): AddItemForm {
  const meta = getTypeMeta(type);
  const cfg = getDefaultCfg(type);
  return {
    type,
    tag: `${meta.label}-1`,
    location: "",
    qty: "1",
    installType: "EMT",
    cfg,
    selected: getDefaultSelectedForType(type, cfg),
  };
}

function renumberDefaultTag(type: string, items: EstimateItem[]) {
  const meta = getTypeMeta(type);
  const count = items.filter((item) => item.type === type).length + 1;
  return `${meta.label}-${count}`;
}

function buildItemFromForm(form: AddItemForm): EstimateItem {
  return {
    id: crypto.randomUUID(),
    type: form.type,
    tag: form.tag.trim() || `${getTypeMeta(form.type).label}-1`,
    location: form.location.trim(),
    qty: Math.max(1, Number.parseInt(form.qty, 10) || 1),
    installType: form.installType,
    selected: form.selected,
    custom: [],
    priceSnap: {},
    cfg: form.cfg,
  };
}

export function EstimateDetailClient({ estimate }: Props) {
  const router = useRouter();
  const initialEstimateState = getInitialEstimateState(estimate);
  const [body, setBody] = useState<EstimateBody>(() => initialEstimateState.body);
  const [status, setStatus] = useState<EstimateStatus>(() => initialEstimateState.status);
  const [addForm, setAddForm] = useState<AddItemForm>(() => buildAddForm());
  const [showAddEditor, setShowAddEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProposalDetails, setShowProposalDetails] = useState(false);
  const [showAiParser, setShowAiParser] = useState(false);
  const [editingComponentsFor, setEditingComponentsFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(() => initialEstimateState.recovered);
  const [message, setMessage] = useState<string | null>(() => (initialEstimateState.recovered ? "Recovered unsaved local draft." : null));
  const [error, setError] = useState<string | null>(null);

  const opportunityNumber = asString(body.platformContext?.opportunityNumber);
  const organizationId =
    asString(body.organizationId) ||
    asString((estimate as unknown as Record<string, unknown>).organizationId) ||
    asString((estimate as unknown as Record<string, unknown>).organization_id) ||
    asString(body.platformContext?.organizationId) ||
    asString(body.platformContext?.organization_id);
  const rawTotals = useMemo(() => calcEstimate(body) as { mtl: number; lbrHrs: number }, [body]);
  const installationCosts = useMemo(
    () =>
      computeCosts(rawTotals.mtl, rawTotals.lbrHrs, body.settings, body.items) as {
        labor: number;
        material: number;
        overhead: number;
        profit: number;
        bond: number;
        total: number;
      },
    [body, rawTotals.lbrHrs, rawTotals.mtl],
  );
  const estimateScopeMode = normalizeEstimateScopeMode(body.settings.estimateScopeMode);
  const costs = {
    ...installationCosts,
    total: installationCosts.total,
    bond: installationCosts.bond,
  };

  const addFormComponents = getVisibleComponentsForType(addForm.type, addForm.cfg);
  const addFormGraphicsSource = useMemo(
    () => resolveProjectHubGraphicsSource(addForm.type, addForm.cfg, addForm.selected),
    [addForm.cfg, addForm.selected, addForm.type]
  );

  function updateBody(patch: Partial<EstimateBody>) {
    setBody((current) => ({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
    setDirty(true);
    setMessage(null);
    setError(null);
  }

  function setAddType(type: string) {
    setAddForm(() => ({
      ...buildAddForm(type),
      tag: renumberDefaultTag(type, body.items),
    }));
  }

  function toggleSelectedComponent(componentId: string) {
    setAddForm((current) => {
      const selected = new Map(current.selected.map((component) => [component.id, component.qty]));
      if (selected.has(componentId)) selected.delete(componentId);
      else selected.set(componentId, 1);
      return {
        ...current,
        selected: Array.from(selected.entries()).map(([id, qty]) => ({ id, qty })),
      };
    });
  }

  function setCustomComponent(componentId: string) {
    const selectedId = componentId || customComponentOptions[0]?.id || "";
    setAddForm((current) => ({
      ...current,
      cfg: { ...current.cfg, componentId: selectedId },
      selected: selectedId ? [{ id: selectedId, qty: 1 }] : [],
    }));
  }

  function updateSelectedComponentQty(componentId: string, qty: number) {
    setAddForm((current) => ({
      ...current,
      selected: current.selected.map((component) =>
        component.id === componentId ? { ...component, qty: Math.max(1, qty) } : component,
      ),
    }));
  }

  function handleAddItem() {
    const item = buildItemFromForm(addForm);
    updateBody({ items: [...body.items, item] });
    setAddForm({
      ...buildAddForm(addForm.type),
      tag: renumberDefaultTag(addForm.type, [...body.items, item]),
      installType: addForm.installType,
    });
  }

  function updateItem(itemId: string, patch: Partial<EstimateItem>) {
    updateBody({
      items: body.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    });
  }

  function setItemCustomComponent(itemId: string, componentId: string) {
    const selectedId = componentId || customComponentOptions[0]?.id || "";
    const currentItem = body.items.find((item) => item.id === itemId);
    updateItem(itemId, {
      cfg: { ...(currentItem?.cfg ?? {}), componentId: selectedId },
      selected: selectedId ? [{ id: selectedId, qty: 1 }] : [],
    });
  }

  function updateSettings(patch: Record<string, unknown>) {
    updateBody({
      settings: {
        ...body.settings,
        ...patch,
      },
    });
  }

  function toggleItemComponent(itemId: string, componentId: string) {
    updateBody({
      items: body.items.map((item) => {
        if (item.id !== itemId) return item;
        const exists = item.selected.some((component) => component.id === componentId);
        return {
          ...item,
          selected: exists
            ? item.selected.filter((component) => component.id !== componentId)
            : [...item.selected, { id: componentId, qty: 1 }],
        };
      }),
    });
  }

  function updateItemComponentQty(itemId: string, componentId: string, qty: number) {
    updateBody({
      items: body.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              selected: item.selected.map((component) =>
                component.id === componentId ? { ...component, qty: Math.max(1, qty) } : component,
              ),
            }
          : item,
      ),
    });
  }

  function applyDefaultInstallTypeToItems() {
    const installType = body.settings.defaultInstallType === "Plenum" ? "Plenum" : "EMT";
    updateBody({
      items: body.items.map((item) => ({ ...item, installType })),
    });
  }

  function removeItem(itemId: string) {
    updateBody({ items: body.items.filter((item) => item.id !== itemId) });
  }

  async function applyImportedScopeImport(scopeImport: Record<string, unknown>) {
    const { nextEstimate, importedCount } = applyImportedScopeImportToEstimate(body, scopeImport) as {
      nextEstimate: EstimateBody;
      importedCount: number;
    };

    await persistEstimate(nextEstimate, { showSuccessMessage: false });
    setMessage(`Imported ${importedCount} system${importedCount === 1 ? "" : "s"} into the estimate.`);
  }

  useEffect(() => {
    if (!dirty) return;
    writeLocalDraft(estimate.id, body, status);
  }, [dirty, body, status, estimate.id]);

  async function persistEstimate(nextBody: EstimateBody, options: { showSuccessMessage?: boolean } = {}) {
    const { showSuccessMessage = true } = options;

    const summary = summarizeHvacEstimate(nextBody);

    const res = await fetch(`/api/estimates/${estimate.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        archived: status === "archived",
        body: nextBody,
        total_amount: summary.totalAmount,
        gross_margin_amount: summary.grossMarginAmount,
        gross_margin_pct: summary.grossMarginPct,
      }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(typeof json?.error === "string" ? json.error : "Unable to save estimate.");
    }

    setBody(nextBody);
    setDirty(false);
    clearLocalDraft(estimate.id);
    if (showSuccessMessage) {
      setMessage("Estimate saved.");
    } else {
      setMessage(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);

    const nextBody = {
      ...body,
      updatedAt: new Date().toISOString(),
    };

    try {
      await persistEstimate(nextBody, { showSuccessMessage: true });
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save estimate.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAutosave(nextBody: EstimateBody) {
    try {
      await persistEstimate(nextBody, { showSuccessMessage: false });
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save estimate.");
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete ${body.name || "this estimate"}?\n\nThis archives the estimate and returns you to the estimating list.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setMessage(null);
    setError(null);

    try {
      clearLocalDraft(estimate.id);
      const res = await fetch(`/api/estimates/${estimate.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : "Unable to delete estimate.");
        return;
      }

      router.push("/estimating");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const useLegacyUi = true;
  if (useLegacyUi) {
    return (
      <ProjectHubEstimateProvider estimate={body} onChange={updateBody} onAutosave={handleAutosave}>
        <div
          className="min-h-[calc(100vh-7.5rem)] overflow-hidden rounded-xl border border-border-default bg-surface-raised"
          style={legacyDiagramTheme}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default bg-surface-overlay px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/estimating" className="text-sm font-semibold text-text-secondary hover:text-text-primary">
                Back to Estimating
              </Link>
              <span className="text-xs text-text-tertiary">
                {body.number || estimate.id}
                {body.customer ? ` · ${body.customer}` : ""}
                {body.bidder ? ` · ${body.bidder}` : ""}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(message || error) && (
                <span className={`text-sm ${error ? "text-status-danger" : "text-status-success"}`}>
                  {error ?? message}
                </span>
              )}
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as EstimateStatus);
                  setDirty(true);
                }}
                className="rounded-lg border border-border-default bg-surface-raised px-2 py-1 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => router.push(`/estimating/settings?organizationId=${encodeURIComponent(organizationId)}`)}
                disabled={!organizationId}
                className="rounded-lg border border-border-default px-3 py-1.5 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay disabled:cursor-not-allowed disabled:opacity-50"
              >
                AI Settings
              </button>
              <button
                type="button"
                onClick={() => setShowAiParser(true)}
                disabled={!organizationId}
                className="rounded-lg border border-brand-primary/40 px-3 py-1.5 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                AI Parser
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || deleting}
                className="rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : dirty ? "Save Changes" : "Save"}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving || deleting}
                className="rounded-lg border border-status-danger/40 px-3 py-1.5 text-sm font-semibold text-status-danger transition hover:bg-status-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
          <LegacyEstimatorWorkspace
            estimate={body}
            onUpdate={updateBody}
            onBack={() => {
              window.location.href = "/estimating";
            }}
            platformEstimateId={estimate.id}
          />
          <AiTakeoffModal
            open={showAiParser}
            onClose={() => setShowAiParser(false)}
            estimate={body}
            organizationId={organizationId}
            onManageConnections={() => {
              setShowAiParser(false);
              router.push(`/estimating/settings?organizationId=${encodeURIComponent(organizationId)}`);
            }}
            onImport={(payload: unknown) => applyImportedScopeImport(payload as Record<string, unknown>)}
          />
        </div>
      </ProjectHubEstimateProvider>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/estimating" className="text-sm text-text-tertiary hover:text-text-primary">
            Back to Estimating
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">{body.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {body.number || estimate.id}
            {body.customer ? ` · ${body.customer}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : dirty ? "Save Changes" : "Save"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving || deleting}
            className="rounded-xl border border-status-danger/40 px-4 py-2 text-sm font-semibold text-status-danger transition hover:bg-status-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
          <a
            href="https://estimates.thecontrolscompany.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-border-default px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
          >
            Standalone Tool
          </a>
        </div>
      </div>

      {(message || error) && (
        <div
          className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
            error
              ? "border-status-danger/30 bg-status-danger/10 text-status-danger"
              : "border-status-success/30 bg-status-success/10 text-status-success"
          }`}
        >
          {error ?? message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Estimate Summary</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Platform-native pricing using the migrated HVAC Estimator cost model.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-brand-primary/20 bg-brand-subtle px-3 py-1 text-xs font-semibold text-brand-primary">
                  {getEstimateScopeModeLabel(estimateScopeMode)}
                </span>
                <span className="rounded-full bg-surface-overlay px-3 py-1 text-xs font-medium text-text-secondary">
                  {status.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-5">
              <SummaryMetric label="Material" value={formatCurrency(costs.material)} />
              <SummaryMetric label="Labor" value={formatCurrency(costs.labor)} />
              <SummaryMetric label="Overhead" value={formatCurrency(costs.overhead)} />
              <SummaryMetric label="Profit" value={formatCurrency(costs.profit)} />
              <SummaryMetric label={`${getEstimateScopeModeLabel(estimateScopeMode)} Price`} value={formatCurrency(costs.total)} emphasized />
            </div>

            <div className="mt-4 rounded-2xl border border-brand-primary/15 bg-brand-subtle/40 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-text-primary">One equipment selection, two outputs</div>
                  <div className="mt-1 text-sm text-text-secondary">
                    The installation estimate is priced from the current equipment selection. The controls estimate is a separate draft until its parts and pieces are defined.
                  </div>
                </div>
                <span className="rounded-full border border-brand-primary/20 bg-surface-raised px-3 py-1 text-xs font-semibold text-brand-primary">
                  Shared equipment selection
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border-default bg-surface-raised p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Installation Estimate</div>
                  <div className="mt-2 text-2xl font-semibold text-text-primary">{formatCurrency(costs.total)}</div>
                  <div className="mt-1 text-sm text-text-secondary">
                    Priced from the selected equipment and the current installation cost model.
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-border-default bg-surface-overlay p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Controls Estimate</div>
                  <div className="mt-2 text-2xl font-semibold text-text-primary">Draft</div>
                  <div className="mt-1 text-sm text-text-secondary">
                    Seeded from the same equipment selection, then filled in with controls-specific parts and services later.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Project Settings</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Old estimator settings panel, now backed by ProjectHub estimate persistence.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowProposalDetails((current) => !current)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    showProposalDetails
                      ? "border-brand-primary bg-brand-subtle text-brand-primary"
                      : "border-border-default text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                  }`}
                >
                  {showProposalDetails ? "Hide Proposal Details" : "Proposal Details"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettings((current) => !current)}
                  className="rounded-xl border border-border-default px-3 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
                >
                  {showSettings ? "Hide Settings" : "Show Settings"}
                </button>
              </div>
            </div>
            {showSettings && (
              <ProjectSettingsPanel
                settings={body.settings}
                onChange={updateSettings}
                costs={costs}
                rawLbrHrs={rawTotals.lbrHrs}
                itemCount={body.items.length}
                estimateId={estimate.id}
                onApplyDefaultInstallType={applyDefaultInstallTypeToItems}
              />
            )}
            <ProposalDetailsModal
              open={showProposalDetails}
              settings={body.settings}
              onChange={updateSettings}
              onClose={() => setShowProposalDetails(false)}
              estimateId={estimate.id}
              sharepointFolder={body.sharepointFolder}
              drawingBasis={asString(body.settings.drawingBasis)}
              onChangeDrawingBasis={(value: string) => updateSettings({ drawingBasis: value })}
              onFolderProvisioned={(folder: string) => updateBody({ sharepointFolder: folder })}
            />
          </section>

          <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Add Equipment</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Old estimator equipment buttons with a platform-native item editor.
                </p>
              </div>
              <div className="text-sm text-text-tertiary">{body.items.length} line items</div>
            </div>

            <AddEquipButtons
              buttons={equipmentButtons}
              onAdd={(type: string) => {
                setAddType(type);
                setShowAddEditor(true);
              }}
            />

            {showAddEditor && (
              <div className="mt-4 border-t border-border-default pt-4">

            <div className="grid gap-3 md:grid-cols-5">
              <label>
                <span className={labelClassName}>Type</span>
                <select value={addForm.type} onChange={(event) => setAddType(event.target.value)} className={inputClassName}>
                  {supportedEquipmentTypes.map((type) => (
                    <option key={type} value={type}>
                      {getTypeMeta(type).label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClassName}>{addForm.type === "custom" ? "Component" : "Tag"}</span>
                {addForm.type === "custom" ? (
                  <select
                    value={asString(addForm.cfg.componentId) || customComponentOptions[0]?.id || ""}
                    onChange={(event) => setCustomComponent(event.target.value)}
                    className={inputClassName}
                  >
                    {customComponentOptions.map((component) => (
                      <option key={component.id} value={component.id}>
                        {component.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={addForm.tag}
                    onChange={(event) => setAddForm((current) => ({ ...current, tag: event.target.value }))}
                    className={inputClassName}
                  />
                )}
              </label>
              <label>
                <span className={labelClassName}>Location</span>
                <input
                  value={addForm.location}
                  onChange={(event) => setAddForm((current) => ({ ...current, location: event.target.value }))}
                  className={inputClassName}
                />
              </label>
              <label>
                <span className={labelClassName}>Qty</span>
                <input
                  type="number"
                  min="1"
                  value={addForm.qty}
                  onChange={(event) => setAddForm((current) => ({ ...current, qty: event.target.value }))}
                  className={inputClassName}
                />
              </label>
              <label>
                <span className={labelClassName}>Install</span>
                <select
                  value={addForm.installType}
                  onChange={(event) =>
                    setAddForm((current) => ({ ...current, installType: event.target.value as "EMT" | "Plenum" }))
                  }
                  className={inputClassName}
                >
                  <option value="EMT">EMT</option>
                  <option value="Plenum">Plenum</option>
                </select>
              </label>
            </div>

            {addFormGraphicsSource ? (
              <LegacyDiagramPanel className="mt-4">
                <ProjectHubOntologyGraphicPanel
                  type={addForm.type}
                  cfg={addForm.cfg}
                  selected={addForm.selected}
                />
              </LegacyDiagramPanel>
            ) : diagramSupportedEquipmentTypes.has(addForm.type) ? (
              <LegacyDiagramPanel className="mt-4">
                <UnitaryFlowDiagram
                  kind={addForm.type}
                  selected={addForm.selected}
                  onToggle={toggleSelectedComponent}
                />
              </LegacyDiagramPanel>
            ) : null}

            {addForm.type === "custom" ? (
              <div className="mt-4 rounded-xl border border-border-default bg-surface-overlay p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-text-primary">Custom Component</div>
                  <div className="text-xs text-text-tertiary">Choose any equipment component</div>
                </div>
                <div className="text-sm text-text-secondary">
                  This line item uses the selected component from the full equipment catalog.
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-border-default bg-surface-overlay p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-text-primary">Components</div>
                  <div className="text-xs text-text-tertiary">{addForm.selected.length} selected by default</div>
                </div>
                <div className="grid max-h-64 gap-2 overflow-auto pr-1 md:grid-cols-2">
                  {addFormComponents.map((component) => {
                    const selectedQty = addForm.selected.find((entry) => entry.id === component.id)?.qty;
                    return (
                      <div
                        key={component.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-secondary"
                      >
                        <label className="flex min-w-0 flex-1 items-start gap-2">
                          <input
                            type="checkbox"
                            checked={selectedQty !== undefined}
                            onChange={() => toggleSelectedComponent(component.id)}
                            className="mt-1"
                          />
                          <span className="min-w-0">
                            <span className="block text-text-primary">{getComponentLabel(component)}</span>
                            {component.sourceLabel && (
                              <span className="text-xs text-text-tertiary">{component.sourceLabel}</span>
                            )}
                            {!component.sourceLabel && component.groupId && (
                              <span className="text-xs text-text-tertiary">{component.groupId}</span>
                            )}
                          </span>
                        </label>
                        {selectedQty !== undefined && (
                          <input
                            type="number"
                            min="1"
                            value={selectedQty}
                            onChange={(event) => updateSelectedComponentQty(component.id, asNumber(event.target.value))}
                            className="w-16 rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                            aria-label={`${getComponentLabel(component)} quantity`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleAddItem}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
              >
                Add Equipment
              </button>
            </div>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
            <div className="border-b border-border-default px-5 py-4">
              <h2 className="text-lg font-semibold text-text-primary">Line Items</h2>
            </div>
            {body.items.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-secondary">
                No equipment yet. Add a line item above, then save the estimate.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-default bg-surface-overlay text-xs uppercase tracking-wide text-text-tertiary">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Equipment</th>
                    <th className="px-4 py-3 font-semibold">Qty</th>
                    <th className="px-4 py-3 font-semibold">Install</th>
                    <th className="px-4 py-3 text-right font-semibold">Material</th>
                    <th className="px-4 py-3 text-right font-semibold">Labor Hrs</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {body.items.map((item) => {
                    const meta = getTypeMeta(item.type);
                    const itemCost = calcItem(item) as { totalMtl: number; totalLbr: number };
                    const itemComponents = getVisibleComponentsForType(item.type, item.cfg ?? {});
                    const selectedById = new Map(item.selected.map((component) => [component.id, component.qty]));
                    const editingThisItem = editingComponentsFor === item.id;
                    const itemGraphicsSource = resolveProjectHubGraphicsSource(item.type, item.cfg ?? {}, item.selected);
                    return (
                      <Fragment key={item.id}>
                        <tr className="hover:bg-surface-overlay/60">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="rounded-full px-2 py-1 text-xs font-semibold"
                                style={{ backgroundColor: meta.bg, color: meta.color }}
                              >
                                {meta.label}
                              </span>
                              <div>
                                <div className="font-medium text-text-primary">{item.tag}</div>
                                <div className="text-xs text-text-tertiary">
                                  {item.location || "-"} · {item.selected.length} components
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(event) => updateItem(item.id, { qty: Math.max(1, asNumber(event.target.value)) })}
                              className="w-20 rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <select
                              value={item.installType}
                              onChange={(event) => updateItem(item.id, { installType: event.target.value as "EMT" | "Plenum" })}
                              className="rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                            >
                              <option value="EMT">EMT</option>
                              <option value="Plenum">Plenum</option>
                            </select>
                          </td>
                          <td className="px-4 py-4 text-right font-medium text-text-primary">
                            {formatCurrency(itemCost.totalMtl)}
                          </td>
                          <td className="px-4 py-4 text-right text-text-secondary">{formatNumber(itemCost.totalLbr)}</td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingComponentsFor(editingThisItem ? null : item.id)}
                                className="text-sm font-medium text-brand-primary hover:underline"
                              >
                                {editingThisItem ? "Hide" : "Components"}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="text-sm font-medium text-status-danger hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                        {editingThisItem && (
                          <tr>
                            <td colSpan={6} className="border-t border-border-default bg-surface-overlay/50 px-4 py-4">
                              {itemGraphicsSource ? (
                                <LegacyDiagramPanel className="mb-4">
                                  <ProjectHubOntologyGraphicPanel
                                    type={item.type}
                                    cfg={item.cfg ?? {}}
                                    selected={item.selected}
                                  />
                                </LegacyDiagramPanel>
                              ) : diagramSupportedEquipmentTypes.has(item.type) ? (
                                <LegacyDiagramPanel className="mb-4">
                                  <UnitaryFlowDiagram
                                    kind={item.type}
                                    selected={item.selected}
                                    onToggle={(componentId: string) => toggleItemComponent(item.id, componentId)}
                                  />
                                </LegacyDiagramPanel>
                              ) : null}
                              {item.type === "custom" ? (
                                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                                  <label>
                                    <span className={labelClassName}>Component</span>
                                    <select
                                      value={asString(item.cfg?.componentId) || item.selected[0]?.id || customComponentOptions[0]?.id || ""}
                                      onChange={(event) => setItemCustomComponent(item.id, event.target.value)}
                                      className={inputClassName}
                                    >
                                      {customComponentOptions.map((component) => (
                                        <option key={component.id} value={component.id}>
                                          {component.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <div className="rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-secondary">
                                    <div className="text-xs uppercase tracking-wide text-text-tertiary">Selected Component</div>
                                    <div className="mt-1 font-medium text-text-primary">
                                      {customComponentOptions.find((component) => component.id === (asString(item.cfg?.componentId) || item.selected[0]?.id))?.label || "Custom"}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="grid gap-2 md:grid-cols-2">
                                  {itemComponents.map((component) => {
                                    const selectedQty = selectedById.get(component.id);
                                    return (
                                      <div
                                        key={component.id}
                                        className="flex items-start justify-between gap-3 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm"
                                      >
                                        <label className="flex min-w-0 flex-1 items-start gap-2 text-text-secondary">
                                          <input
                                            type="checkbox"
                                            checked={selectedQty !== undefined}
                                            onChange={() => toggleItemComponent(item.id, component.id)}
                                            className="mt-1"
                                          />
                                          <span className="min-w-0">
                                            <span className="block text-text-primary">{getComponentLabel(component)}</span>
                                            {component.sourceLabel && <span className="text-xs text-text-tertiary">{component.sourceLabel}</span>}
                                            {!component.sourceLabel && component.groupId && <span className="text-xs text-text-tertiary">{component.groupId}</span>}
                                          </span>
                                        </label>
                                        {selectedQty !== undefined && (
                                          <input
                                            type="number"
                                            min="1"
                                            value={selectedQty}
                                            onChange={(event) =>
                                              updateItemComponentQty(item.id, component.id, Math.max(1, asNumber(event.target.value)))
                                            }
                                            className="w-16 rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                                            aria-label={`${getComponentLabel(component)} quantity`}
                                          />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h2 className="text-lg font-semibold text-text-primary">Workflow</h2>
            <label className="mt-4 block">
              <span className={labelClassName}>Status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as EstimateStatus);
                  setDirty(true);
                }}
                className={inputClassName}
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block">
              <span className={labelClassName}>Notes</span>
              <textarea
                value={body.notes}
                onChange={(event) => updateBody({ notes: event.target.value })}
                className={`${inputClassName} min-h-32`}
                placeholder="Scope notes, assumptions, or handoff context..."
              />
            </label>
          </section>

          <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h2 className="text-lg font-semibold text-text-primary">Calculation Inputs</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <SummaryRow label="Raw material" value={formatCurrency(rawTotals.mtl)} />
              <SummaryRow label="Raw labor hours" value={formatNumber(rawTotals.lbrHrs)} />
              <SummaryRow label="Bond" value={formatCurrency(costs.bond)} />
              <SummaryRow
                label="Margin %"
                value={formatPercent(estimateScopeMode === "installation" && costs.total > 0 ? costs.profit / costs.total : null)}
              />
            </dl>
          </section>

          <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h2 className="text-lg font-semibold text-text-primary">Platform Links</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-text-tertiary">Opportunity</dt>
                <dd className="mt-0.5 text-text-secondary">
                  {estimate.linked_opportunity_id ? (
                    <Link href={`/crm/opportunities/${estimate.linked_opportunity_id}`} className="text-brand-primary hover:underline">
                      {opportunityNumber || estimate.linked_opportunity_id}
                    </Link>
                  ) : (
                    "-"
                  )}
                </dd>
              </div>
              <SummaryRow label="Project" value={estimate.linked_project_id ?? "-"} />
              <SummaryRow label="Created" value={formatDate(estimate.created_at)} />
              <SummaryRow label="Updated" value={formatDate(estimate.updated_at)} />
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function LegacyDiagramPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`h-[360px] overflow-hidden rounded-xl border border-border-default bg-white ${className}`}
      style={legacyDiagramTheme}
    >
      {children}
    </div>
  );
}

function LegacyEstimatorWorkspace({
  estimate,
  onUpdate,
  onBack,
  platformEstimateId,
}: {
  estimate: EstimateBody;
  onUpdate: (patch: Partial<EstimateBody>) => void;
  onBack: () => void;
  platformEstimateId: string;
}) {
  const { subPage, setSubPage } = useEstimate() as unknown as {
    subPage?: { type?: string; alternateId?: string } | null;
    setSubPage: (value: Record<string, unknown> | null) => void;
  };
  const [showConduitFill, setShowConduitFill] = useState(false);

  useEffect(() => {
    function openConduitFill() {
      setShowConduitFill(true);
    }

    function returnFromConduitFill() {
      try {
        const raw = sessionStorage.getItem(CONDUIT_FILL_RESTORE_KEY);
        if (!raw) {
          setShowConduitFill(false);
          return;
        }
        const restore = JSON.parse(raw);
        sessionStorage.removeItem(CONDUIT_FILL_RESTORE_KEY);
        if (restore?.returnSubPage) {
          setSubPage({
            ...restore.returnSubPage,
            conduitFillDraft: restore.draft || null,
          });
        }
      } catch (error) {
        console.error("Failed to restore conduit fill state", error);
      } finally {
        setShowConduitFill(false);
      }
    }

    window.addEventListener("open-conduit-fill", openConduitFill);
    window.addEventListener("return-from-conduit-fill", returnFromConduitFill);
    return () => {
      window.removeEventListener("open-conduit-fill", openConduitFill);
      window.removeEventListener("return-from-conduit-fill", returnFromConduitFill);
    };
  }, [setSubPage]);

  if (showConduitFill) {
    return (
      <div style={{ height: "calc(100vh - 8rem)", overflow: "auto" }}>
        <div className="flex items-center justify-between border-b border-border-default bg-surface-overlay px-4 py-2">
          <div className="text-sm font-semibold text-text-primary">Conduit Fill Calculator</div>
          <button
            type="button"
            onClick={() => setShowConduitFill(false)}
            className="rounded-lg border border-border-default px-3 py-1.5 text-sm font-semibold text-text-secondary transition hover:bg-surface-raised hover:text-text-primary"
          >
            Back to Editor
          </button>
        </div>
        <ConduitFillPage />
      </div>
    );
  }

  return (
    <EstimateEditorWorkspace
      estimate={estimate}
      onBack={onBack}
      onUpdate={onUpdate}
      allowBidAlternateEditor={true}
      renderBidAlternateEditor={() => <BidAlternateEditor estimate={estimate} onBack={() => setSubPage(null)} onUpdate={onUpdate} alternateId={subPage?.alternateId} />}
      showProjectSettings={true}
      showBidAlternates={true}
      platformEstimateId={platformEstimateId}
    />
  );
}

function SummaryMetric({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-overlay p-4">
      <div className="text-xs uppercase tracking-wide text-text-tertiary">{label}</div>
      <div className={`mt-2 font-semibold text-text-primary ${emphasized ? "text-2xl" : "text-xl"}`}>{value}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="mt-0.5 break-words text-text-secondary">{value}</dd>
    </div>
  );
}

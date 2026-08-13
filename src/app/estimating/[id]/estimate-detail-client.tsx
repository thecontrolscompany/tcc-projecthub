"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AiTakeoffModal } from "@/modules/hvac-estimator/components/estimate/AiTakeoffModal";
import { EstimateEditorWorkspace } from "@/modules/hvac-estimator/components/estimate/EstimateEditorWorkspace";
import ConduitFillPage from "@/modules/hvac-estimator/components/conduitFill/ConduitFillPage";
import { BidAlternateEditor } from "@/modules/hvac-estimator/components/estimate/BidAlternateEditor";
import { DEFAULT_SETTINGS } from "@/modules/hvac-estimator/components/estimate/projectSettings";
import { summarizeHvacEstimate, type HvacEstimateBody } from "@/modules/hvac-estimator/platform-adapter";
import { ProjectHubEstimateProvider, useEstimate } from "@/modules/hvac-estimator/shared/EstimateContext";
import { CONDUIT_FILL_RESTORE_KEY } from "@/modules/hvac-estimator/shared/conduitFill";
import { applyImportedScopeImportToEstimate } from "@/modules/hvac-estimator/ai/scopeImportToEstimate";
import type { EstimateRecord, EstimateStatus } from "@/types/database";

type Props = {
  estimate: EstimateRecord;
  installCatalog: Record<string, unknown>;
  controlsCatalog: Record<string, unknown>;
  controlsDefaultOverrides: Record<string, string>;
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

type LocalDraft = {
  body: EstimateBody;
  status: EstimateStatus;
  savedAt: string;
};

const statusOptions: EstimateStatus[] = [
  "draft",
  "in_progress",
  "ready",
  "proposal_exported",
  "awarded",
  "archived",
];

const LOCAL_DRAFT_PREFIX = "hvac-estimate-draft";

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

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
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

function EstimateStatusBadge({
  status,
  onChange,
}: {
  status: EstimateStatus;
  onChange: (nextStatus: EstimateStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const statusMeta: Record<EstimateStatus, { label: string; bg: string; border: string; color: string }> = {
    draft: { label: "Draft", bg: "#F1F5F9", border: "#CBD5E1", color: "#475569" },
    in_progress: { label: "In Progress", bg: "#DBEAFE", border: "#93C5FD", color: "#2563EB" },
    ready: { label: "Ready", bg: "#DCFCE7", border: "#86EFAC", color: "#16A34A" },
    proposal_exported: { label: "Proposal Exported", bg: "#CCFBF1", border: "#5EEAD4", color: "#0F766E" },
    awarded: { label: "Awarded", bg: "#D1FAE5", border: "#6EE7B7", color: "#059669" },
    archived: { label: "Archived", bg: "#E2E8F0", border: "#CBD5E1", color: "#64748B" },
  };
  const selected = statusMeta[status] ?? statusMeta.draft;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:brightness-95"
        style={{
          background: selected.bg,
          borderColor: selected.border,
          color: selected.color,
        }}
      >
        <span>{selected.label}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-xl border border-border-default bg-surface-raised p-1 shadow-xl">
          {statusOptions.map((option) => {
            const meta = statusMeta[option];
            const active = option === status;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                  active ? "bg-surface-overlay text-text-primary" : "text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                }`}
              >
                <span>{meta.label}</span>
                {active ? <span className="text-brand-primary">✓</span> : <span className="text-text-tertiary"> </span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EstimateDetailClient({ estimate, installCatalog, controlsCatalog, controlsDefaultOverrides }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Captured once on mount: the cleanup effect below strips these from the URL via
  // router.replace, which would otherwise re-derive `initialProposalTab` as null on the
  // next render (useSearchParams is live) and reset the proposal modal back to "details".
  const [initialProposalTab] = useState(() => (searchParams.get("panel") === "documents" ? "documents" : null));
  const [initialAutoProvision] = useState(() => searchParams.get("autoProvision") === "1");

  useEffect(() => {
    if (initialProposalTab) {
      router.replace(pathname, { scroll: false });
    }
    // Only consume the `panel` query param once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialEstimateState = getInitialEstimateState(estimate);
  const serverEstimateState = useMemo(
    () => ({
      body: normalizeBody(estimate),
      status: estimate.status,
    }),
    [estimate],
  );
  const [body, setBody] = useState<EstimateBody>(() => initialEstimateState.body);
  const [status, setStatus] = useState<EstimateStatus>(() => initialEstimateState.status);
  const [showAiParser, setShowAiParser] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(() => initialEstimateState.recovered);
  const [error, setError] = useState<string | null>(null);
  const [saveChipState, setSaveChipState] = useState<"saved" | "saving" | "unsaved">(
    initialEstimateState.recovered ? "unsaved" : "saved",
  );
  const [savedAt, setSavedAt] = useState<string | null>(
    initialEstimateState.recovered ? null : new Date().toISOString(),
  );
  const [recoveryState, setRecoveryState] = useState<"pending" | "kept" | "discarded">(
    initialEstimateState.recovered ? "pending" : "kept",
  );
  const autosaveTimerRef = useRef<number | null>(null);

  const opportunityNumber = asString(body.platformContext?.opportunityNumber);
  const organizationId =
    asString(body.organizationId) ||
    asString((estimate as unknown as Record<string, unknown>).organizationId) ||
    asString((estimate as unknown as Record<string, unknown>).organization_id) ||
    asString(body.platformContext?.organizationId) ||
    asString(body.platformContext?.organization_id);
  function updateBody(patch: Partial<EstimateBody>) {
    setBody((current) => ({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
    setDirty(true);
    setSaveChipState("unsaved");
    setError(null);
  }

  async function applyImportedScopeImport(scopeImport: Record<string, unknown>) {
    const { nextEstimate, importedCount } = applyImportedScopeImportToEstimate(body, scopeImport) as {
      nextEstimate: EstimateBody;
      importedCount: number;
    };

    await persistEstimate(nextEstimate, status, controlsCatalog);
    setSaveChipState("saved");
    setSavedAt(new Date().toISOString());
  }

  useEffect(() => {
    if (!dirty) return;
    writeLocalDraft(estimate.id, body, status);
  }, [dirty, body, status, estimate.id]);

  async function persistEstimate(nextBody: EstimateBody, nextStatus: EstimateStatus, catalog = controlsCatalog) {
    const summary = summarizeHvacEstimate(nextBody, catalog);

    const res = await fetch(`/api/estimates/${estimate.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: nextStatus,
        archived: nextStatus === "archived",
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
    setStatus(nextStatus);
    setDirty(false);
    clearLocalDraft(estimate.id);
    setSaveChipState("saved");
    setSavedAt(new Date().toISOString());
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaveChipState("saving");

    const nextBody = {
      ...body,
      updatedAt: new Date().toISOString(),
    };

    try {
      await persistEstimate(nextBody, status, controlsCatalog);
      setError(null);
    } catch (error) {
      setSaveChipState("unsaved");
      setError(error instanceof Error ? error.message : "Unable to save estimate.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAutosave(nextBody: EstimateBody, nextStatus: EstimateStatus) {
    setSaving(true);
    setSaveChipState("saving");
    try {
      await persistEstimate(nextBody, nextStatus, controlsCatalog);
      setError(null);
    } catch (error) {
      setSaveChipState("unsaved");
      setError(error instanceof Error ? error.message : "Unable to save estimate.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (recoveryState === "pending") return;
    if (!dirty || saving) return;

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void handleAutosave(
        {
          ...body,
          updatedAt: new Date().toISOString(),
        },
        status,
      );
    }, 2000);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [body, dirty, recoveryState, saving, status]);

  useEffect(
    () => () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    },
    [],
  );

  function keepRecoveredDraft() {
    setRecoveryState("kept");
    setError(null);
  }

  function discardRecoveredDraft() {
    clearLocalDraft(estimate.id);
    setBody(serverEstimateState.body);
    setStatus(serverEstimateState.status);
    setDirty(false);
    setSaveChipState("saved");
    setSavedAt(null);
    setRecoveryState("discarded");
    setError(null);
  }

  function handleStatusChange(nextStatus: EstimateStatus) {
    setStatus(nextStatus);
    setDirty(true);
    setSaveChipState("unsaved");
    setError(null);
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete ${body.name || "this estimate"}?\n\nThis archives the estimate and returns you to the estimating list.`,
    );
    if (!confirmed) return;

    setDeleting(true);
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

  return (
    <ProjectHubEstimateProvider
      estimate={body}
      onChange={updateBody}
      onAutosave={handleAutosave}
      installCatalog={installCatalog}
      controlsCatalog={controlsCatalog}
      controlsDefaultOverrides={controlsDefaultOverrides}
    >
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
            {error && <span className="text-sm text-status-danger">{error}</span>}
            <EstimateStatusBadge status={status} onChange={handleStatusChange} />
          </div>
        </div>
        <LegacyEstimatorWorkspace
          estimate={body}
          onUpdate={updateBody}
          onBack={() => {
            window.location.href = "/estimating";
          }}
          onSave={handleSave}
          onDelete={handleDelete}
          saving={saving}
          deleting={deleting}
          platformEstimateId={estimate.id}
          initialProposalTab={initialProposalTab}
          initialAutoProvision={initialAutoProvision}
          status={status}
          onStatusChange={handleStatusChange}
          saveChipState={saveChipState}
          savedAt={savedAt}
          recoveryState={recoveryState}
          onKeepRecoveredDraft={keepRecoveredDraft}
          onDiscardRecoveredDraft={discardRecoveredDraft}
        />
        <AiTakeoffModal
          open={showAiParser}
          onClose={() => setShowAiParser(false)}
          estimate={body}
          estimateId={estimate.id}
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

function LegacyEstimatorWorkspace({
  estimate,
  onUpdate,
  onBack,
  onSave,
  onDelete,
  saving,
  deleting,
  platformEstimateId,
  initialProposalTab,
  initialAutoProvision,
}: {
  estimate: EstimateBody;
  onUpdate: (patch: Partial<EstimateBody>) => void;
  onBack: () => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
  platformEstimateId: string;
  initialProposalTab?: string | null;
  initialAutoProvision?: boolean;
  status?: EstimateStatus;
  onStatusChange?: (nextStatus: EstimateStatus) => void;
  saveChipState?: "saved" | "saving" | "unsaved";
  savedAt?: string | null;
  recoveryState?: "pending" | "kept" | "discarded";
  onKeepRecoveredDraft?: () => void;
  onDiscardRecoveredDraft?: () => void;
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
      onSave={onSave}
      onDelete={onDelete}
      saving={saving}
      deleting={deleting}
      allowBidAlternateEditor={true}
      renderBidAlternateEditor={() => <BidAlternateEditor estimate={estimate} onBack={() => setSubPage(null)} onUpdate={onUpdate} alternateId={subPage?.alternateId} />}
      showProjectSettings={true}
      showBidAlternates={true}
      platformEstimateId={platformEstimateId}
      initialProposalTab={initialProposalTab}
      initialAutoProvision={initialAutoProvision}
    />
  );
}

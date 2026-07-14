import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "../../shared/useIsMobile.js";
import { generateProposal } from "./export/generateProposal.js";
import { generateInternalEstimateExport } from "./export/generateInternalEstimateExport.js";
import { T } from "../../shared/tokens.js";
import { fmt$, fmtHr } from "../../shared/utils.js";
import { DEFAULT_SETTINGS, computeCosts, computeControlsCosts, getSanityCheck, getEstimateScopeModeLabel } from "./projectSettings.js";
import { useEstimate } from "../../shared/EstimateContext.jsx";
import { getCurrentUser } from "../../shared/currentUser.js";
import { AHU_TYPES } from "../ahu/ahuData.js";
import { AiTakeoffModal } from "./AiTakeoffModal.jsx";
import { ProposalDetailsModal } from "./ProposalDetailsModal.jsx";
import { applyImportedScopeImportToEstimate } from "../../ai/scopeImportToEstimate.js";
import {
  buildEstimateHealthRows,
  buildNeedsReviewIssues,
  EstimateCommandCenter,
  EstimatorActionBar,
  EstimatorTabs,
  EstimatorTabPanels,
} from "./estimateUx.jsx";
import { ControlsCostBreakdown } from "../../shared/ControlsCostBreakdown.jsx";
import {
  TYPE_META,
  buildItemsWithComps,
  calcEstimate,
  calcItem,
  fmtAuditDate,
  getItemDetails,
} from "./estimateCalc.js";

const STATUS_META = {
  draft: {
    label: "Draft",
    bg: "#F1F5F9",
    border: "#CBD5E1",
    color: "#475569",
  },
  in_progress: {
    label: "In Progress",
    bg: "#DBEAFE",
    border: "#93C5FD",
    color: "#2563EB",
  },
  ready: {
    label: "Ready",
    bg: "#DCFCE7",
    border: "#86EFAC",
    color: "#16A34A",
  },
  proposal_exported: {
    label: "Proposal Exported",
    bg: "#CCFBF1",
    border: "#5EEAD4",
    color: "#0F766E",
  },
  awarded: {
    label: "Awarded",
    bg: "#D1FAE5",
    border: "#6EE7B7",
    color: "#059669",
  },
  archived: {
    label: "Archived",
    bg: "#E2E8F0",
    border: "#CBD5E1",
    color: "#64748B",
  },
};

function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.draft;
}

function formatPercentValue(value) {
  const num = Number(value) || 0;
  return `${Number.isInteger(num) ? num.toFixed(0) : num.toFixed(1)}%`;
}

function hasIncompleteProposalDetails(settings) {
  return !String(settings?.baseScopeName || "").trim()
    || !String(settings?.customerContact || "").trim()
    || !String(settings?.estimateDate || "").trim();
}

function getMarginColor(pct) {
  if (pct >= 20) return T.green;
  if (pct >= 15) return T.amber;
  return T.rose;
}

function HeaderWithTooltip({ label, tooltip }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <span title={tooltip} className="cursor-help text-[10px] leading-none text-text-tertiary">
        ⓘ
      </span>
    </span>
  );
}

function EstimateStatusBadge({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = getStatusMeta(status);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        title="Estimate status"
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
          {Object.entries(STATUS_META).map(([key, meta]) => {
            const active = key === status;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onChange?.(key);
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

function VersionHistoryModal({ open, onClose }) {
  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border-default bg-surface-raised shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <h3 className="text-base font-semibold text-text-primary">Version History</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-default px-2.5 py-1 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
          >
            Close
          </button>
        </div>
        <div className="px-5 py-5 text-sm text-text-secondary">Version history coming soon.</div>
      </div>
    </div>,
    document.body
  );
}

function BidAlternateNameModal({ open, defaultName, onClose, onConfirm }) {
  const inputRef = useRef(null);
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (!open) return undefined;

    setName(defaultName);
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }, 0);

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [defaultName, onClose, open]);

  useEffect(() => {
    if (open) return;
    setName(defaultName);
  }, [defaultName, open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bid-alternate-modal-title"
        aria-describedby="bid-alternate-modal-desc"
        data-testid="bid-alternate-modal"
        className="w-full max-w-lg rounded-3xl border border-border-default bg-surface-raised shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border-default px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Bid Alternate</div>
            <h3 id="bid-alternate-modal-title" className="mt-1 text-lg font-semibold text-text-primary">
              Name this bid alternate
            </h3>
            <p id="bid-alternate-modal-desc" className="mt-2 text-sm text-text-secondary">
              The dialog is keyboard-friendly and exposes test hooks for automation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border-default px-3 py-1.5 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
          >
            Close
          </button>
        </div>

        <form
          className="space-y-4 px-6 py-5"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            onConfirm(trimmed);
          }}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-text-primary">Bid Alternate Name</span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onClose();
                }
              }}
              placeholder="Bid Alternate Name"
              aria-label="Bid Alternate Name"
              data-testid="bid-alternate-name-input"
              className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              data-testid="cancel-bid-alternate"
              className="rounded-xl border border-border-default bg-surface-base px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="confirm-bid-alternate"
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
export function EstimateDetail({
  estimate,
  onBack,
  onUpdate,
  onSave = null,
  saving = false,
  status = "draft",
  onStatusChange = null,
  saveChipState = "saved",
  savedAt = null,
  recoveryState = "kept",
  onKeepRecoveredDraft = null,
  onDiscardRecoveredDraft = null,
  customerMode = false,
  showProjectSettings = true,
  showBidAlternates = true,
  platformEstimateId = null,
  initialProposalTab = null,
}) {
  const { subPage, setSubPage, applyDefaultInstallType, refreshAllPrices, controlsCatalog } = useEstimate();
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const isMobile = useIsMobile();
  const [editHeader, setEditHeader] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [expandedDdc, setExpandedDdc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProposalDetails, setShowProposalDetails] = useState(false);
  const [showAiParser, setShowAiParser] = useState(false);
  const [activeTab, setActiveTab] = useState("estimate");
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [bidAlternateDialog, setBidAlternateDialog] = useState(null);
  const [highlightedSummaryRow, setHighlightedSummaryRow] = useState(null);
  const [proposalPreview, setProposalPreview] = useState(null);
  const summaryHighlightTimerRef = useRef(null);

  useEffect(() => {
    if (initialProposalTab === "documents") {
      setShowProposalDetails(true);
    }
  }, [initialProposalTab]);
  const [name,setName]         = useState(estimate.name);
  const [number,setNumber]     = useState(estimate.number||"");
  const [customer,setCustomer] = useState(estimate.customer||"");
  const [bidder,setBidder]     = useState(estimate.bidder||estimate.body?.bidder||"");
  const [version,setVersion]   = useState(estimate.version||"");
  const [notes,setNotes]       = useState(estimate.notes||"");
  const createdBy = estimate.createdBy?.name || estimate.createdBy?.email || "";
  const updatedBy = estimate.updatedBy?.name || estimate.updatedBy?.email || createdBy;
  const updatedOn = fmtAuditDate(estimate.updatedAt);

  // Settings live in estimate.settings, merged with defaults
  const settings = useMemo(() => {
    const stored = estimate.settings || {};
    return { ...DEFAULT_SETTINGS, ...stored };
  }, [estimate.settings]);
  const proposalDetailsIncomplete = hasIncompleteProposalDetails(settings);
  const drawingBasis = settings.drawingBasis || settings.proposalBasis || settings.bidBasis || "";
  const sharepointFolder = estimate.sharepointFolder || estimate.sharepoint_folder || estimate.body?.sharepointFolder || estimate.body?.sharepoint_folder || null;
  const organizationId =
    estimate.organizationId ||
    estimate.organization_id ||
    estimate.body?.organizationId ||
    estimate.body?.organization_id ||
    "";
  const alternates = useMemo(() => Array.isArray(estimate.alternates) ? estimate.alternates : [], [estimate.alternates]);
  const alternatesWithCosts = useMemo(() => alternates.map((alternate) => {
    const altItems = alternate.items || [];
    if (!altItems.length) return { ...alternate, altRaw: null, altCosts: null };
    const altSettings = { ...DEFAULT_SETTINGS, ...(alternate.settings || {}) };
    const altRaw = calcEstimate({ items: altItems }, controlsCatalog);
    const altCosts = computeCosts(altRaw.mtl, altRaw.lbrHrs, altSettings, altItems);
    return { ...alternate, altRaw, altCosts };
  }), [alternates, controlsCatalog]);
  const updateSettings = useCallback((patch) => {
    onUpdate({ ...estimate, updatedAt: new Date().toISOString(),
      settings: { ...settings, ...patch } });
  }, [estimate, settings, onUpdate]);

  const totals     = calcEstimate(estimate, controlsCatalog);
  const costs      = useMemo(() => computeCosts(totals.mtl, totals.lbrHrs, settings, estimate.items||[]), [totals.mtl, totals.lbrHrs, settings, estimate.items]);
  const grandTotal = costs.total;
  const controlsCosts = useMemo(
    () => computeControlsCosts(totals.controlsMtl, totals.controlsLbrHrs, settings),
    [settings, totals.controlsLbrHrs, totals.controlsMtl]
  );
  const ddcInfrastructure = totals.ddcInfrastructure || {
    rows: [],
    pointCounts: { AI: 0, AO: 0, BI: 0, BO: 0 },
    totalPoints: 0,
    controllerCount: 0,
    equipmentCount: 0,
    graphicsCount: 0,
    rawMtl: 0,
    rawLbrHrs: 0,
    grandTotal: 0,
  };
  const sanityCheck = useMemo(
    () => getSanityCheck({
      installTotal: costs.total,
      installLabor: costs.labor,
      controlsMaterial: controlsCosts.material,
      controlsLabor: controlsCosts.labor,
    }),
    [controlsCosts.labor, controlsCosts.material, costs.labor, costs.total]
  );
  const healthRows = useMemo(() => buildEstimateHealthRows(sanityCheck), [sanityCheck]);
  const needsReviewIssues = useMemo(() => buildNeedsReviewIssues({
    estimate,
    controlsCatalog,
    sanityCheck,
    showBidAlternates,
  }), [controlsCatalog, estimate, sanityCheck, showBidAlternates]);
  const reviewSeverityCounts = useMemo(() => {
    const counts = { critical: 0, warning: 0, info: 0 };
    for (const row of healthRows) {
      if (row.level === "warning") counts.warning += 1;
      if (row.level === "critical") counts.critical += 1;
    }
    for (const issue of needsReviewIssues) {
      if (issue.severity === "critical") counts.critical += 1;
      else if (issue.severity === "warning") counts.warning += 1;
      else counts.info += 1;
    }
    return counts;
  }, [healthRows, needsReviewIssues]);
  const reviewBadgeLabel = reviewSeverityCounts.critical || reviewSeverityCounts.warning
    ? `${reviewSeverityCounts.critical + reviewSeverityCounts.warning} review`
    : reviewSeverityCounts.info
      ? `${reviewSeverityCounts.info} note`
      : "";

  const saveHeader = () => {
    onUpdate({...estimate, name, number, customer, bidder, version, notes, updatedAt:new Date().toISOString()});
    setEditHeader(false);
  };

  const updateItem = useCallback((itemId, changes) => {
    onUpdate({
      ...estimate,
      updatedAt: new Date().toISOString(),
      items: estimate.items.map((it) => (it.id === itemId ? { ...it, ...changes } : it)),
    });
  }, [estimate, onUpdate]);

  const updateControlsOverride = (itemId, compId, overrideId, defaultId) => {
    const item = estimate.items.find(it => it.id === itemId);
    if (!item) return;
    const nextSelected = (item.selected || []).map(entry => {
      if (entry.id !== compId) return entry;
      const next = { ...entry };
      if (!overrideId || overrideId === defaultId) {
        delete next.controlsOverride;
      } else {
        next.controlsOverride = overrideId;
      }
      delete next.controlsCustomPart;
      return next;
    });
    updateItem(itemId, { selected: nextSelected });
  };

  const updateControlsCustomPart = (itemId, compId, customPart) => {
    const item = estimate.items.find(it => it.id === itemId);
    if (!item) return;
    const nextSelected = (item.selected || []).map(entry => {
      if (entry.id !== compId) return entry;
      const next = { ...entry };
      if (customPart) {
        next.controlsCustomPart = customPart;
        delete next.controlsOverride;
      } else {
        delete next.controlsCustomPart;
      }
      return next;
    });
    updateItem(itemId, { selected: nextSelected });
  };

  const removeItem = itemId =>
    onUpdate({...estimate, updatedAt:new Date().toISOString(),
      items: estimate.items.filter(it => it.id!==itemId)});

  const moveItem = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= estimate.items.length || fromIndex === toIndex) return;
    const items = [...estimate.items];
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    onUpdate({
      ...estimate,
      updatedAt: new Date().toISOString(),
      items,
    });
  };

  const updateAlternates = useCallback((nextAlternates) => {
    onUpdate({
      ...estimate,
      updatedAt: new Date().toISOString(),
      alternates: nextAlternates,
    });
  }, [estimate, onUpdate]);

  const cloneItems = useCallback((items) => {
    if (typeof structuredClone === "function") return structuredClone(items);
    return JSON.parse(JSON.stringify(items || []));
  }, []);

  const openBidAlternateDialog = useCallback((scopeMode = "installation", defaultPrefix = "Bid Alternate", seedWithCurrentItems = false) => {
    setBidAlternateDialog({
      scopeMode,
      defaultPrefix,
      seedWithCurrentItems,
      name: `${defaultPrefix} ${alternates.length + 1}`,
    });
  }, [alternates.length]);

  const createBidAlternate = useCallback((name, options = bidAlternateDialog) => {
    const trimmedName = String(name || "").trim();
    if (!trimmedName || !options) return;

    const next = {
      id: crypto.randomUUID(),
      name: trimmedName,
      settings: { ...(estimate.settings || {}), estimateScopeMode: options.scopeMode },
      items: options.seedWithCurrentItems ? cloneItems(estimate.items || []) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    updateAlternates([...alternates, next]);
    setSubPage({ type: "alternate", alternateId: next.id });
    setBidAlternateDialog(null);
  }, [alternates, bidAlternateDialog, cloneItems, estimate.items, estimate.settings, setSubPage, updateAlternates]);

  const openBidAlternate = useCallback((alternateId) => {
    setSubPage({ type: "alternate", alternateId });
  }, [setSubPage]);

  const removeBidAlternate = useCallback((alternateId) => {
    const next = alternates.filter((alternate) => alternate.id !== alternateId);
    updateAlternates(next);
    if (subPage?.type === "alternate" && subPage.alternateId === alternateId) {
      setSubPage(null);
    }
  }, [alternates, setSubPage, subPage, updateAlternates]);

  const [exporting, setExporting] = useState(false);

  async function uploadGeneratedToSharePoint(blob, fileName, documentRole) {
    const estimateId = platformEstimateId || estimate.id || estimate.body?.estimateId;
    if (!estimateId) return;
    try {
      const prepRes = await fetch(`/api/estimates/${estimateId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare", documentRole, fileName }),
      });
      if (!prepRes.ok) return;
      const prep = await prepRes.json().catch(() => null);
      if (!prep?.uploadUrl) return;

      const buffer = await blob.arrayBuffer();
      const upRes = await fetch(prep.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": blob.type || "text/html",
          "Content-Length": String(buffer.byteLength),
          "Content-Range": `bytes 0-${buffer.byteLength - 1}/${buffer.byteLength}`,
        },
        body: buffer,
      });
      if (![200, 201, 202].includes(upRes.status)) return;
      const upData = await upRes.json().catch(() => null);

      await fetch(`/api/estimates/${estimateId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit",
          documentRole,
          fileName,
          fileExt: fileName.includes(".") ? `.${fileName.split(".").pop()}`.toLowerCase() : null,
          contentType: blob.type || "text/html",
          fileSizeBytes: blob.size,
          storageItemId: upData?.id || "",
          storageWebUrl: upData?.webUrl || null,
          storagePath: prep.storagePath,
        }),
      });
    } catch {
      // SharePoint upload is best-effort; don't block the download
    }
  }

  const exportProposal = useCallback(async () => {
    setExporting(true);
    try {
      const itemsWithComps = buildItemsWithComps(estimate);
      const result = await generateProposal(estimate, itemsWithComps, grandTotal, costs.bond, controlsCatalog);
      if (result?.blob) {
        setProposalPreview({
          html: result.html || "",
          fileName: result.fileName || "",
          generatedAt: new Date().toISOString(),
        });
        void uploadGeneratedToSharePoint(result.blob, result.fileName, "proposal_pdf");
      }
    } catch (err) {
      console.error("Proposal export failed:", err);
      alert("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  }, [controlsCatalog, costs.bond, estimate, grandTotal]);

  const exportInternal = useCallback(async () => {
    try {
      const result = generateInternalEstimateExport(estimate, costs, getCurrentUser());
      if (result?.blob) {
        void uploadGeneratedToSharePoint(result.blob, result.fileName, "supporting_scope");
      }
    } catch (err) {
      console.error("Internal export failed:", err);
      alert("Internal export failed: " + err.message);
    }
  }, [estimate, costs]);

  const toggleRowDetails = useCallback((itemId) => {
    setExpandedRows(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  }, []);

  const handleImportedScopeImport = useCallback((scopeImport) => {
    const { nextEstimate, importedCount } = applyImportedScopeImportToEstimate(estimate, scopeImport);
    onUpdate(nextEstimate);
    return importedCount;
  }, [estimate, onUpdate]);

  const openAiSettings = useCallback(() => {
    window.location.href = `/estimating/settings?organizationId=${encodeURIComponent(organizationId)}`;
  }, [organizationId]);

  const handleUpdateAllPrices = useCallback(() => {
    const estimateId = platformEstimateId || estimate.id || estimate.body?.estimateId;
    if (!estimateId) return;
    const confirmed = window.confirm(
      "Update all equipment material/labor pricing to current price book values?\n\nThis re-captures every line item's price snapshot. Controls/DDC pricing always reflects the latest catalog automatically and is not affected by this action."
    );
    if (!confirmed) return;
    setUpdatingPrices(true);
    try {
      refreshAllPrices(estimateId);
    } finally {
      setUpdatingPrices(false);
    }
  }, [platformEstimateId, estimate.id, estimate.body, refreshAllPrices]);

  const handleFixReviewIssue = useCallback((issue) => {
    if (!issue) return;
    if (issue.fixTarget === "proposal-details") {
      setShowProposalDetails(true);
      return;
    }

    if (issue.fixTarget) {
      setActiveTab("estimate");
      setHighlightedSummaryRow(issue.fixTarget);
    }
  }, [setActiveTab, setHighlightedSummaryRow, setShowProposalDetails]);

  const handleJumpReviewIssue = useCallback((issue) => {
    if (!issue) return;
    if (issue.fixTarget === "proposal-details") {
      setActiveTab("estimate");
      window.setTimeout(() => {
        document.getElementById("proposal-details-entry")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 60);
      return;
    }
    if (issue.fixTarget) {
      setActiveTab("estimate");
      setHighlightedSummaryRow(issue.fixTarget);
    }
  }, [setActiveTab, setHighlightedSummaryRow]);

  useEffect(() => {
    if (!highlightedSummaryRow) return undefined;
    if (activeTab !== "estimate") return undefined;

    if (summaryHighlightTimerRef.current) {
      window.clearTimeout(summaryHighlightTimerRef.current);
      summaryHighlightTimerRef.current = null;
    }

    const rowId = `estimate-command-center-row-${highlightedSummaryRow}`;
    const timer = window.setTimeout(() => {
      const element = document.getElementById(rowId);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      summaryHighlightTimerRef.current = window.setTimeout(() => {
        setHighlightedSummaryRow(null);
        summaryHighlightTimerRef.current = null;
      }, 1800);
    }, 60);

    return () => window.clearTimeout(timer);
  }, [activeTab, highlightedSummaryRow]);

  useEffect(
    () => () => {
      if (summaryHighlightTimerRef.current) {
        window.clearTimeout(summaryHighlightTimerRef.current);
      }
    },
    [],
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

      {/* ── TOP HEADER BAR ── */}
      <div style={{ padding:"14px 24px", borderBottom:"1px solid "+T.border,
        background:T.surface, flexShrink:0 }}>
        {!editHeader ? (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
              <button onClick={onBack} style={{ background:"none", border:"1px solid "+T.border,
                borderRadius:4, color:T.muted, cursor:"pointer", fontSize:12,
                fontFamily:T.mono, padding:"6px 11px", whiteSpace:"nowrap" }}>← All Estimates</button>

              <div style={{ flex:"1 1 420px", minWidth:280, maxWidth:"100%" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:3 }}>
                  <span style={{ fontSize:18, lineHeight:1.25, fontWeight:800, color:T.text, overflowWrap:"break-word" }}>
                    {estimate.name}
                  </span>
                  {proposalDetailsIncomplete && (
                    <button
                      type="button"
                      onClick={() => setShowProposalDetails(true)}
                      title="Proposal details incomplete"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "2px 8px",
                        border: "1px solid #F59E0B",
                        borderRadius: 999,
                        background: "#FFFBEB",
                        color: "#B45309",
                        cursor: "pointer",
                        fontSize: 10,
                        fontFamily: T.mono,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        maxWidth: "min(100%, 240px)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      <span aria-hidden="true">⚠</span>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                        Proposal details incomplete
                      </span>
                    </button>
                  )}
                  {estimate.number && <span style={{ fontSize:11, color:T.muted, background:T.panel,
                    padding:"1px 6px", borderRadius:8, fontFamily:T.mono, border:"1px solid "+T.border }}>
                    #{estimate.number}</span>}
                  {estimate.customer && <span style={{ fontSize:12, color:T.muted }}>· {estimate.customer}</span>}
                  {(estimate.bidder||estimate.body?.bidder) && <span style={{ fontSize:12, color:T.blue, background:T.blueFaint, padding:"1px 6px", borderRadius:8, fontFamily:T.mono, border:"1px solid "+T.blueMid }}>Bidder: {estimate.bidder||estimate.body?.bidder}</span>}
                  <button onClick={()=>setEditHeader(true)} style={{ background:"none", border:"none",
                    color:T.dim, cursor:"pointer", fontSize:11, fontFamily:T.mono }}>✏ edit</button>
                </div>
                {estimate.notes && <div style={{ fontSize:11, color:T.muted, fontStyle:"italic" }}>{estimate.notes}</div>}
                {(createdBy || updatedBy) && (
                  <div style={{ fontSize:10, color:T.dim, fontFamily:T.mono, marginTop:3 }}>
                    {createdBy && `Created by ${createdBy}`}
                    {createdBy && updatedBy && " | "}
                    {updatedBy && `Last updated by ${updatedBy}${updatedOn ? ` on ${updatedOn}` : ""}`}
                  </div>
                )}
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginLeft:"auto" }}>
                <EstimateStatusBadge status={status} onChange={onStatusChange} />
                {estimate.version && (
                  <button
                    type="button"
                    onClick={() => setShowVersionHistory(true)}
                    title="Estimate version — increments when a proposal is exported. Click to view version history."
                    className="rounded-full border border-border-default px-3 py-1 text-xs font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
                  >
                    v{estimate.version}
                  </button>
                )}
              </div>

            </div>
          </div>
        ) : (
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <button onClick={onBack} style={{ background:"none", border:"1px solid "+T.border,
              borderRadius:4, color:T.muted, cursor:"pointer", fontSize:12,
              fontFamily:T.mono, padding:"4px 10px", whiteSpace:"nowrap" }}>← All Estimates</button>
            <div style={{ flex:1, display:"flex", flexWrap:"wrap", gap:8, alignItems:"flex-end" }}>
              {[["Name",name,setName,200],["Est #",number,setNumber,100],
                ["Customer",customer,setCustomer,160],["Bidder",bidder,setBidder,140],["Version",version,setVersion,80]].map(([lbl,val,fn,w])=>(
                <div key={lbl}>
                  <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>{lbl}</div>
                  <input value={val} onChange={e=>fn(e.target.value)}
                    style={{ width:w, padding:"5px 8px", border:"1px solid "+T.border2, borderRadius:4,
                      fontSize:13, color:T.text, outline:"none", background:T.bg }}/>
                </div>
              ))}
              <div style={{ flex:"1 1 100%" }}>
                <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Notes</div>
                <input value={notes} onChange={e=>setNotes(e.target.value)}
                  style={{ width:"100%", padding:"5px 8px", border:"1px solid "+T.border2, borderRadius:4,
                    fontSize:13, color:T.text, outline:"none", background:T.bg, boxSizing:"border-box" }}/>
              </div>
              <button onClick={saveHeader} style={{ padding:"6px 16px", border:"none", borderRadius:4,
                background:T.blue, color:"#fff", cursor:"pointer", fontSize:13 }}>Save</button>
              <button onClick={()=>setEditHeader(false)} style={{ padding:"6px 12px",
                border:"1px solid "+T.border2, borderRadius:4, background:"none",
                color:T.muted, cursor:"pointer", fontSize:13 }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <EstimatorTabs
        activeTab={activeTab}
        onChange={setActiveTab}
      tabs={[
          { id: "estimate", label: "Estimate" },
          ...(customerMode || settings.estimateScopeMode !== "both" ? [] : [{ id: "controlsBom", label: "Controls Parts" }]),
          { id: "review", label: "Review", badge: reviewBadgeLabel },
          { id: "costDetail", label: "Cost Breakdown" },
          { id: "outputs", label: "Outputs" },
          ...(customerMode ? [] : [{ id: "settings", label: "Settings" }]),
        ]}
      />

      {recoveryState === "pending" && (
        <div className="mx-6 mt-4 rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-950">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-base font-bold">⚠</span>
              <span>A locally recovered draft was loaded — your last saved version may differ.</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onKeepRecoveredDraft}
                className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                Keep this draft
              </button>
              <button
                type="button"
                onClick={onDiscardRecoveredDraft}
                className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-50"
              >
                Discard &amp; load saved
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding:"0 24px 16px", display: activeTab === "estimate" ? "grid" : "none", gap:12 }}>
        {!customerMode && (
          <EstimatorActionBar
            customerMode={customerMode}
            estimate={estimate}
            saving={saving}
            onSave={onSave}
            saveChipState={saveChipState}
            savedAt={savedAt}
            onProposalDetails={() => setShowProposalDetails((value) => !value)}
            onBidAlternate={() => openBidAlternateDialog("installation", "Bid Alternate")}
            onSystemWizard={() => setSubPage({ type: "wizard" })}
            onAiParser={() => setShowAiParser((value) => !value)}
            onSettings={() => setShowSettings((value) => !value)}
            onAiSettings={openAiSettings}
            onAddEquipment={(type) => setSubPage({ type })}
            onUpdateAllPrices={handleUpdateAllPrices}
            updatingPrices={updatingPrices}
            showBidAlternates={showBidAlternates}
            showProjectSettings={showProjectSettings}
          />
        )}

        <EstimateCommandCenter
          estimate={estimate}
          controlsCatalog={controlsCatalog}
          settings={settings}
          statusLabel={getEstimateScopeModeLabel(settings.estimateScopeMode)}
          estimateName={estimate.name}
          highlightedRowKey={highlightedSummaryRow}
        />

        {reviewBadgeLabel && (
          <button
            type="button"
            onClick={() => setActiveTab("review")}
            style={{
              justifySelf: "start",
              padding: "6px 10px",
              border: "1px solid " + T.border2,
              borderRadius: 999,
              background: T.surface,
              color: T.text,
              cursor: "pointer",
              fontSize: 11,
              fontFamily: T.mono,
              fontWeight: 700,
            }}
          >
            Review: {reviewBadgeLabel}
          </button>
        )}

      </div>

      {!customerMode && (
        <ProposalDetailsModal
          open={showProposalDetails}
          initialTab={initialProposalTab === "documents" ? "documents" : "details"}
          settings={settings}
          onChange={updateSettings}
          onClose={() => setShowProposalDetails(false)}
          saveState={saveChipState}
          estimateId={platformEstimateId || estimate.id}
          sharepointFolder={sharepointFolder}
          drawingBasis={drawingBasis}
          onChangeDrawingBasis={(value) => updateSettings({ drawingBasis: value })}
          onFolderProvisioned={(folder) => {
            onUpdate({
              ...estimate,
              body: { ...(estimate.body || {}), sharepointFolder: folder },
              updatedAt: new Date().toISOString(),
            });
          }}
        />
      )}

      {!customerMode && (
        <AiTakeoffModal
          open={showAiParser}
          onClose={() => setShowAiParser(false)}
          estimate={estimate}
          estimateId={platformEstimateId || estimate.id}
          organizationId={organizationId}
          onManageConnections={() => {
            setShowAiParser(false);
            window.location.href = `/estimating/settings?organizationId=${encodeURIComponent(organizationId)}`;
          }}
          onImport={(payload) => {
            handleImportedScopeImport(payload);
          }}
        />
      )}
      <BidAlternateNameModal
        open={Boolean(bidAlternateDialog)}
        defaultName={bidAlternateDialog?.name || ""}
        onClose={() => setBidAlternateDialog(null)}
        onConfirm={(name) => createBidAlternate(name)}
      />
      <VersionHistoryModal open={showVersionHistory} onClose={() => setShowVersionHistory(false)} />

      {/* ── LINE ITEMS TABLE ── */}
      <div style={{ display: activeTab === "estimate" ? "block" : "none", flex:1, overflow:"auto", padding:"20px 24px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap", marginBottom:14 }}>
          <div>
            <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1.3 }}>Live Estimate Summary</div>
            <div style={{ fontSize:12, color:T.dim, marginTop:2 }}>
              Grouped by equipment type so the line items are easier to scan.
            </div>
          </div>
          <div style={{ fontSize:11, color:T.muted, fontFamily:T.mono }}>
            {estimate.items.length} line item{estimate.items.length !== 1 ? "s" : ""} · {fmtHr(totals.lbrHrs)} raw labor
          </div>
        </div>
        {estimate.items.length === 0 ? (
          <div style={{ padding:"40px 24px", textAlign:"center", border:"2px dashed "+T.border,
            borderRadius:10, background:T.panel }}>
            <div style={{ fontSize:32, marginBottom:12 }}>⊞</div>
            <div style={{ fontSize:15, color:T.muted, marginBottom:8 }}>No equipment yet</div>
            <div style={{ fontSize:13, color:T.dim, marginBottom:20 }}>
              Use <strong>+ Add Equipment</strong> in Workflow Actions to start the estimate.
            </div>
          </div>
        ) : isMobile ? (
          <div style={{ display:"flex", flexDirection:"column", gap:8, paddingBottom:24 }}>
            {estimate.items.map((item, idx) => {
              const c = calcItem(item);
              const meta = TYPE_META[item.type] || { label:String(item.type || "ITEM").toUpperCase(), color:T.steel, bg:T.faint };
              return (
                <div key={item.id} style={{ background:T.surface, border:"1px solid "+T.border,
                  borderLeft:"3px solid "+meta.color, borderRadius:8, padding:"12px 14px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:11, background:meta.bg, color:meta.color,
                      padding:"2px 7px", borderRadius:10, fontFamily:T.mono, fontWeight:600 }}>
                      {meta.label}
                    </span>
                    <span style={{ fontFamily:T.mono, fontWeight:700, color:meta.color, fontSize:14 }}>{item.tag}</span>
                    <span style={{ fontSize:12, color:T.muted, marginLeft:4 }}>{item.location}</span>
                  </div>
                  <div style={{ display:"flex", gap:16, marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:9, color:T.dim, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Qty</div>
                      <input type="number" min="1" value={item.qty}
                        onChange={e=>updateItem(item.id,{qty:Math.max(1,parseInt(e.target.value)||1)})}
                        style={{ width:52, padding:"3px 5px", border:"1px solid "+T.border2,
                          borderRadius:4, fontSize:13, fontFamily:T.mono, color:T.text,
                          background:customerMode ? T.panel : T.bg, outline:"none", textAlign:"center" }}/>
                    </div>
                    <div>
                      <div style={{ fontSize:9, color:T.dim, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Conduit</div>
                      <div style={{ fontSize:12, color:T.muted, fontFamily:T.mono, paddingTop:4 }}>{item.installType}</div>
                    </div>
                    {!customerMode && (
                      <div style={{ marginLeft:"auto" }}>
                        <div style={{ fontSize:9, color:T.dim, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Total</div>
                        <div style={{ fontSize:14, fontWeight:700, color:T.blue, fontFamily:T.mono }}>{fmt$(c.totalMtl)}</div>
                        <div style={{ fontSize:11, color:T.muted, fontFamily:T.mono }}>{fmtHr(c.totalLbr)}</div>
                      </div>
                    )}
                  </div>
                  {!customerMode && (
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>setSubPage({type:item.type, editItemId:item.id})}
                        style={{ flex:1, padding:"7px 0", border:"1px solid "+T.blueMid,
                          borderRadius:5, background:T.blueFaint, color:T.blue,
                          cursor:"pointer", fontSize:12, fontFamily:T.mono, fontWeight:600 }}>
                        Edit
                      </button>
                      <button onClick={()=>moveItem(idx, idx-1)} disabled={idx===0}
                        style={{ padding:"7px 10px", border:"1px solid "+T.border2, borderRadius:5,
                          background:"none", color:idx===0?T.border2:T.muted, cursor:idx===0?"default":"pointer",
                          fontSize:12, fontFamily:T.mono }}>↑</button>
                      <button onClick={()=>moveItem(idx, idx+1)} disabled={idx===estimate.items.length-1}
                        style={{ padding:"7px 10px", border:"1px solid "+T.border2, borderRadius:5,
                          background:"none", color:idx===estimate.items.length-1?T.border2:T.muted,
                          cursor:idx===estimate.items.length-1?"default":"pointer",
                          fontSize:12, fontFamily:T.mono }}>↓</button>
                      <button onClick={()=>removeItem(item.id)}
                        style={{ padding:"7px 10px", border:"1px solid color-mix(in srgb, var(--t-rose) 40%, transparent)",
                          borderRadius:5, background:"none", color:T.rose,
                          cursor:"pointer", fontSize:14, fontFamily:T.mono }}>×</button>
                    </div>
                  )}
                </div>
              );
            })}
            {!customerMode && (
              <div style={{ background:T.blueFaint, border:"1px solid "+T.blueMid,
                borderRadius:8, padding:"12px 14px" }}>
                {[
                  { label:"Material", val:costs.material, color:T.blue },
                  { label:"Labor", val:costs.labor, color:T.steel },
                  { label:"Overhead ("+settings.overheadPct+"%)", val:costs.overhead, color:"#7C3AED" },
                  { label:"Profit ("+settings.profitPct+"%)", val:costs.profit, color:T.green },
                  { label:"Bond ("+settings.bondPct+"%)", val:costs.bond, color:"#B45309" },
                  { label:"TOTAL", val:costs.total, color:T.blue, bold:true },
                ].map(({label,val,color,bold}) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between",
                    padding:"4px 0", borderBottom:"1px solid "+T.blueMid }}>
                    <span style={{ fontSize:12, color:T.muted, fontFamily:T.mono }}>{label}</span>
                    <span style={{ fontSize:bold?15:13, fontWeight:bold?800:700, color, fontFamily:T.mono }}>{fmt$(val)}</span>
                  </div>
                ))}
              </div>
            )}
            {customerMode && (
              <div style={{ background:T.blueFaint, border:"1px solid "+T.blueMid,
                borderRadius:8, padding:"12px 14px", display:"flex", justifyContent:"space-between",
                alignItems:"center" }}>
                <span style={{ fontSize:13, color:T.blue, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Estimate Total</span>
                <span style={{ fontSize:16, fontWeight:800, color:T.blue, fontFamily:T.mono }}>{fmt$(costs.total)}</span>
              </div>
            )}
          </div>
        ) : (
          <table style={{ width:"100%", minWidth:1120, borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:"2px solid "+T.border }}>
                {[
                  { label: "Tag" },
                  { label: "Type" },
                  { label: "Location" },
                  { label: "Qty" },
                  { label: "Conduit", tooltip: "Conduit type used for installation wiring runs" },
                  { label: "Unit Mtl ($)", tooltip: "Per-unit controls material cost, before multipliers" },
                  { label: "Unit Lbr (h)", tooltip: "Per-unit installation labor hours" },
                  { label: "Total Mtl ($)", tooltip: "Extended material cost = Unit Mtl × Qty" },
                  { label: "Total Lbr (h)", tooltip: "Extended labor hours = Unit Lbr × Qty" },
                  { label: "Actions" },
                ].map((header) => (
                  <th
                    key={header.label}
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      fontSize: 10,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      color: T.muted,
                      fontFamily: T.mono,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {header.tooltip ? <HeaderWithTooltip label={header.label} tooltip={header.tooltip} /> : header.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estimate.items.map((item,idx) => {
                const c = calcItem(item, controlsCatalog);
                const details = getItemDetails(item, controlsCatalog);
                const isExpanded = !!expandedRows[item.id];
                const meta = TYPE_META[item.type] || { label:String(item.type || "ITEM").toUpperCase(), color:T.steel, bg:T.faint };
                const ahuLabel = item.type==="ahu" && item.cfg
                  ? AHU_TYPES.find(t=>t.id===item.cfg.ahuType)?.label : "";
                return (
                  <Fragment key={item.id}>
                  <tr className="item-row" style={{ borderBottom:isExpanded?"none":"1px solid "+T.border,
                    background: idx%2===0 ? T.surface : T.faint }}>
                    <td style={{ padding:"10px 10px" }}>
                      <span style={{ fontFamily:T.mono, fontWeight:700, color:meta.color, fontSize:13 }}>{item.tag}</span>
                    </td>
                    <td style={{ padding:"10px 10px" }}>
                      <span style={{ fontSize:11, background:meta.bg, color:meta.color,
                        padding:"2px 7px", borderRadius:10, fontFamily:T.mono, fontWeight:600 }}>
                        {meta.label}
                      </span>
                      {ahuLabel && <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>{ahuLabel}</div>}
                    </td>
                    <td style={{ padding:"10px 10px", color:T.muted, fontSize:12 }}>{item.location}</td>
                      <td style={{ padding:"10px 10px" }}>
                        <input type="number" min="1" value={item.qty}
                          onChange={e=>updateItem(item.id,{qty:Math.max(1,parseInt(e.target.value)||1)})}
                          style={{ width:52, padding:"4px 6px", border:"1px solid "+T.border2,
                            borderRadius:4, fontSize:13, fontFamily:T.mono, color:T.text,
                            background:customerMode ? T.panel : T.bg, outline:"none", textAlign:"center" }}/>
                      </td>
                    <td style={{ padding:"10px 10px" }}>
                      <span style={{ fontSize:11, color:T.muted, fontFamily:T.mono }}>{item.installType}</span>
                    </td>
                      <td style={{ padding:"10px 10px", fontFamily:T.mono }}>{customerMode ? "—" : fmt$(c.unitMtl)}</td>
                      <td style={{ padding:"10px 10px", fontFamily:T.mono, color:T.muted }}>{customerMode ? "—" : fmtHr(c.unitLbr)}</td>
                      <td style={{ padding:"10px 10px", fontFamily:T.mono, fontWeight:600, color:T.blue }}>{customerMode ? "—" : fmt$(c.totalMtl)}</td>
                      <td style={{ padding:"10px 10px", fontFamily:T.mono, color:T.muted }}>{customerMode ? "—" : fmtHr(c.totalLbr)}</td>
                    <td className="item-actions" style={{ padding:"10px 10px", whiteSpace:"nowrap" }}>
                      <button
                        onClick={() => toggleRowDetails(item.id)}
                        title={isExpanded ? "Hide details" : "Show details"}
                        style={{ background:isExpanded ? T.blueFaint : "none",
                          border:"1px solid "+(isExpanded ? T.blueMid : T.border2),
                          borderRadius:4, color:isExpanded ? T.blue : T.muted,
                          cursor:"pointer", fontSize:11, fontFamily:T.mono,
                          padding:"3px 7px", marginRight:6 }}>
                        {isExpanded ? "Hide" : "Details"}
                      </button>
                      <button
                        onClick={() => moveItem(idx, idx - 1)}
                        disabled={idx === 0}
                        title="Move up"
                        style={{ background:"none", border:"1px solid "+T.border2,
                          borderRadius:4, color:idx===0?T.border2:T.muted,
                          cursor:idx===0?"default":"pointer",
                          fontSize:11, fontFamily:T.mono, padding:"3px 6px", marginRight:4 }}>
                        ↑
                      </button>
                      <button
                        onClick={() => moveItem(idx, idx + 1)}
                        disabled={idx === estimate.items.length - 1}
                        title="Move down"
                        style={{ background:"none", border:"1px solid "+T.border2,
                          borderRadius:4, color:idx===estimate.items.length - 1?T.border2:T.muted,
                          cursor:idx===estimate.items.length - 1?"default":"pointer",
                          fontSize:11, fontFamily:T.mono, padding:"3px 6px", marginRight:6 }}>
                        ↓
                      </button>
                      <button onClick={()=>setSubPage({type:item.type, editItemId:item.id})}
                        style={{ background:"none", border:"1px solid "+T.blueMid,
                          borderRadius:4, color:T.blue, cursor:"pointer",
                          fontSize:11, fontFamily:T.mono, padding:"3px 8px", marginRight:6 }}>
                        Edit
                      </button>
                      <button onClick={()=>removeItem(item.id)} style={{ background:"none",
                        border:"none", color:T.dim, cursor:"pointer", fontSize:16 }}>×</button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ borderBottom:"1px solid "+T.border, background: idx%2===0 ? T.surface : T.faint }}>
                      <td colSpan={10} style={{ padding:"0 10px 12px 10px" }}>
                        <div style={{
                          border:"1px solid "+T.border,
                          borderRadius:8,
                          background:T.panel,
                          padding:"12px 14px",
                          display:"grid",
                          gridTemplateColumns:"minmax(260px, 1fr) minmax(220px, 1fr)",
                          gap:14,
                        }}>
                          <div>
                            <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono,
                              textTransform:"uppercase", letterSpacing:1.3, marginBottom:8 }}>
                              Selected Components ({details.selected.length})
                            </div>
                            {details.selected.length ? details.selected.map(entry => (
                              <div key={entry.id} style={{
                                display:"flex",
                                alignItems:"baseline",
                                justifyContent:"space-between",
                                gap:10,
                                padding:"5px 0",
                                borderBottom:"1px dashed "+T.border,
                                flexWrap:"wrap",
                              }}>
                                <div style={{ minWidth:0 }}>
                                  <div style={{ fontSize:12, color:T.text }}>{entry.label}</div>
                                  <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono }}>Qty {entry.qty}</div>
                                  {!customerMode && entry.controlsId && (() => {
                                    const optionMap = new Map();
                                    const options = [
                                      { id: entry.controlsId, desc: entry.controlsAlternates.find((alt) => alt.id === entry.controlsId)?.desc || entry.controlsId },
                                      ...entry.controlsAlternates,
                                    ].filter((alt) => {
                                      if (!alt?.id) return false;
                                      if (optionMap.has(alt.id)) return false;
                                      optionMap.set(alt.id, true);
                                      return true;
                                    });
                                    const customPart = entry.controlsCustomPart || null;
                                    const selectValue = customPart ? "__custom__" : (entry.controlsOverride || entry.controlsId);
                                    return (
                                      <>
                                        <select
                                          value={selectValue}
                                          onChange={e => {
                                            if (e.target.value === "__custom__") {
                                              updateControlsCustomPart(item.id, entry.id, { partNumber: "", description: "", mtlUnit: 0, hrsUnit: 0 });
                                              return;
                                            }
                                            updateControlsOverride(item.id, entry.id, e.target.value, entry.controlsId);
                                          }}
                                          style={{ marginTop:4, padding:"2px 4px", border:"1px solid "+T.border2,
                                            borderRadius:3, fontSize:10, fontFamily:T.mono, background:T.bg,
                                            color:T.text, outline:"none", maxWidth:260 }}
                                        >
                                          {options.map(alt => (
                                            <option key={alt.id} value={alt.id}>{alt.desc}</option>
                                          ))}
                                          <option value="__custom__">Custom part...</option>
                                        </select>
                                        {customPart && !customerMode && (
                                          <div style={{
                                            marginTop:6,
                                            display:"grid",
                                            gridTemplateColumns:"repeat(2, minmax(0, 1fr))",
                                            gap:6,
                                            maxWidth:360,
                                          }}>
                                            {[
                                              { key: "partNumber", label: "Part Number", type: "text" },
                                              { key: "description", label: "Description", type: "text" },
                                              { key: "mtlUnit", label: "Mtl $", type: "number" },
                                              { key: "hrsUnit", label: "Hrs", type: "number" },
                                            ].map((field) => (
                                              <label key={field.key} style={{ display:"flex", flexDirection:"column", gap:2 }}>
                                                <span style={{ fontSize:9, color:T.dim, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>
                                                  {field.label}
                                                </span>
                                                <input
                                                  type={field.type}
                                                  value={customPart[field.key] ?? ""}
                                                  onChange={e => updateControlsCustomPart(item.id, entry.id, { ...customPart, [field.key]: e.target.value })}
                                                  onBlur={e => updateControlsCustomPart(item.id, entry.id, { ...customPart, [field.key]: e.target.value })}
                                                  style={{
                                                    padding:"3px 5px",
                                                    border:"1px solid "+T.border2,
                                                    borderRadius:3,
                                                    fontSize:10,
                                                    fontFamily:T.mono,
                                                    background:T.bg,
                                                    color:T.text,
                                                    outline:"none",
                                                  }}
                                                />
                                              </label>
                                            ))}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                                {!customerMode && (
                                  <div style={{ textAlign:"right", flexShrink:0 }}>
                                    <div style={{ fontSize:11, color:T.blue, fontFamily:T.mono }}>{fmt$(entry.mtl)}</div>
                                    <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono }}>{fmtHr(entry.lbr)}</div>
                                    {settings.estimateScopeMode === "both" && entry.controlsId && (
                                      <div style={{ fontSize:10, color:T.purple, fontFamily:T.mono, marginTop:2 }}>
                                        Ctrl {fmt$(entry.controlsMtl)} / {fmtHr(entry.controlsLbr)}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )) : (
                              <div style={{ fontSize:11, color:T.dim }}>No standard components selected.</div>
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono,
                              textTransform:"uppercase", letterSpacing:1.3, marginBottom:8 }}>
                              Custom Assemblies ({details.custom.length})
                            </div>
                            {details.custom.length ? details.custom.map(entry => (
                              <div key={entry.id} style={{
                                display:"flex",
                                alignItems:"baseline",
                                justifyContent:"space-between",
                                gap:10,
                                padding:"5px 0",
                                borderBottom:"1px dashed "+T.border,
                              }}>
                                <div style={{ minWidth:0 }}>
                                  <div style={{ fontSize:12, color:T.text }}>{entry.label}</div>
                                  <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono }}>
                                    {entry.category === "Assembly" ? "Catalog assembly" : "Imported assembly"}
                                    {entry.qty > 1 ? ` · Qty ${entry.qty}` : ""}
                                  </div>
                                </div>
                                {!customerMode && (
                                  <div style={{ textAlign:"right", flexShrink:0 }}>
                                    <div style={{ fontSize:11, color:T.blue, fontFamily:T.mono }}>{fmt$(entry.mtl)}</div>
                                    <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono }}>{fmtHr(entry.lbr)}</div>
                                  </div>
                                )}
                              </div>
                            )) : (
                              <div style={{ fontSize:11, color:T.dim }}>No custom assemblies added.</div>
                            )}
                          </div>
                        </div>
                        {(details.selected.some((entry) => entry.controlsId || entry.controlsCustomPart) || details.custom.length > 0) && (
                          <div style={{ marginTop: 12 }}>
                            <ControlsCostBreakdown
                              item={item}
                              controlsCatalog={controlsCatalog}
                              settings={settings}
                              defaultOpen={false}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              {!customerMode && <tr style={{ borderTop:"2px solid "+T.border, background:T.faint }}>
                <td colSpan={7} style={{ padding:"8px 10px", fontFamily:T.mono, fontSize:11,
                  color:T.muted, textTransform:"uppercase", letterSpacing:1 }}>Raw Totals</td>
                <td style={{ padding:"8px 10px", fontFamily:T.mono, fontWeight:700, color:T.blue }}>{fmt$(totals.mtl)}</td>
                <td style={{ padding:"8px 10px", fontFamily:T.mono, color:T.steel }}>{fmtHr(totals.lbrHrs)}</td>
                <td/>
              </tr>}
              {!customerMode && <tr>
                <td colSpan={10} style={{ padding:"0 10px" }}>
                  <div style={{ height:1, background:T.border, margin:"4px 0 0" }} />
                </td>
              </tr>}
              {!customerMode && <tr style={{ background:T.blueFaint }}>
                <td colSpan={10} style={{ padding:"8px 10px 10px" }}>
                  <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1.4, marginBottom:8 }}>
                    Installation Bid Price Breakdown
                  </div>
                  <div style={{ display:"flex", gap:0, flexWrap:"wrap" }}>
                    {[
                      { label:"Labor", value:costs.labor, color:T.steel },
                      { label:"Material", value:costs.material, color:T.blue },
                      { label:"Overhead", value:costs.overhead, color:"#7C3AED", pct: settings.overheadPct },
                      { label:"Profit", value:costs.profit, color:T.green, pct: settings.profitPct },
                      { label:"Bond", value:costs.bond, color:"#B45309", pct: settings.bondPct },
                    ].map(({label,value,color,pct}) => (
                      <div key={label} style={{ flex:"1 1 150px", minWidth:150, padding:"6px 10px", borderRight:"1px solid "+T.blueMid }}>
                        <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
                        <div style={{ fontSize:13, fontWeight:700, color, fontFamily:T.mono }}>{fmt$(value)}</div>
                        {pct !== undefined && (
                          <div style={{ marginTop:2, fontSize:10, color:T.muted, fontFamily:T.mono }}>{formatPercentValue(pct)}</div>
                        )}
                      </div>
                    ))}
                    <div style={{ flex:"1 1 150px", minWidth:150, padding:"6px 10px", background:T.blueA18 }}>
                      <div style={{ fontSize:9, color:T.blue, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Total</div>
                      <div style={{ fontSize:14, fontWeight:800, color:T.blue, fontFamily:T.mono }}>{fmt$(costs.total)}</div>
                    </div>
                  </div>
                </td>
              </tr>}
              {customerMode && (
                <tr style={{ background:T.blueFaint }}>
                  <td colSpan={9} style={{ padding:"8px 10px", fontFamily:T.mono, fontSize:11,
                    color:T.blue, textTransform:"uppercase", letterSpacing:1 }}>
                    Estimate Total
                  </td>
                  <td style={{ padding:"8px 10px", fontFamily:T.mono, fontSize:14, fontWeight:800, color:T.blue }}>
                    {fmt$(costs.total)}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        )}

      </div>

      <EstimatorTabPanels
        activeTab={activeTab}
        estimate={estimate}
        controlsCatalog={controlsCatalog}
        customerMode={customerMode}
        settings={settings}
        sanityCheck={sanityCheck}
        costs={costs}
        totals={totals}
        ddcInfrastructure={ddcInfrastructure}
        expandedDdc={expandedDdc}
        onToggleDdc={() => setExpandedDdc((value) => !value)}
        healthRows={healthRows}
        needsReviewIssues={needsReviewIssues}
        onFixIssue={handleFixReviewIssue}
        onJumpIssue={handleJumpReviewIssue}
        highlightedSummaryRowKey={highlightedSummaryRow}
        showBidAlternates={showBidAlternates}
        showProjectSettings={showProjectSettings}
        alternatesWithCosts={alternatesWithCosts}
        exporting={exporting}
        onOpenProposalDetails={() => setShowProposalDetails(true)}
        onExportInternal={exportInternal}
        onExportProposal={exportProposal}
        onCreateBidAlternate={() => openBidAlternateDialog("installation", "Bid Alternate")}
        onOpenBidAlternate={openBidAlternate}
        onRemoveBidAlternate={removeBidAlternate}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings((value) => !value)}
        onOpenAiParser={() => setShowAiParser(true)}
        onOpenAiSettings={openAiSettings}
        onOpenSystemWizard={() => setSubPage({ type: "wizard" })}
        onUpdateSettings={updateSettings}
        onApplyDefaultInstallType={applyDefaultInstallType}
        proposalPreview={proposalPreview}
        estimateId={estimate.id}
        rawLbrHrs={totals.lbrHrs}
        itemCount={estimate.items?.length || 0}
      />
    </div>
  );
}

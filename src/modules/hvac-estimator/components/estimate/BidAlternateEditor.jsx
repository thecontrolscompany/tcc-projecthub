import { useMemo } from "react";
import { ProjectHubEstimateProvider } from "../../shared/EstimateContext.jsx";
import { EstimateEditorWorkspace } from "./EstimateEditorWorkspace.jsx";

function createAlternateEstimate(parentEstimate, alternate) {
  const alternateSettings = alternate.settings && typeof alternate.settings === "object" ? alternate.settings : {};
  return {
    ...parentEstimate,
    id: alternate.id,
    name: alternate.name || "Bid Alternate",
    number: alternate.number ?? parentEstimate.number ?? "",
    customer: alternate.customer ?? parentEstimate.customer ?? "",
    version: alternate.version ?? parentEstimate.version ?? "1.0",
    notes: alternate.notes ?? "",
    settings: { ...(parentEstimate.settings || {}), ...alternateSettings },
    items: Array.isArray(alternate.items) ? alternate.items : [],
    createdAt: alternate.createdAt || parentEstimate.createdAt,
    updatedAt: alternate.updatedAt || parentEstimate.updatedAt,
    createdBy: alternate.createdBy ?? parentEstimate.createdBy ?? null,
    updatedBy: alternate.updatedBy ?? parentEstimate.updatedBy ?? null,
  };
}

function nextAltArray(parentEstimate, nextAlternate) {
  const alternates = Array.isArray(parentEstimate.alternates) ? parentEstimate.alternates : [];
  const existingIndex = alternates.findIndex((entry) => entry.id === nextAlternate.id);
  const normalized = {
    ...nextAlternate,
    items: Array.isArray(nextAlternate.items) ? nextAlternate.items : [],
  };

  if (existingIndex === -1) {
    return [...alternates, normalized];
  }

  const next = alternates.slice();
  next[existingIndex] = normalized;
  return next;
}

export function BidAlternateEditor({ estimate, alternateId, onBack, onUpdate }) {
  const alternates = Array.isArray(estimate.alternates) ? estimate.alternates : [];
  const alternate = alternates.find((entry) => entry.id === alternateId) || null;

  const alternateEstimate = useMemo(() => {
    if (!alternate) return null;
    return createAlternateEstimate(estimate, alternate);
  }, [alternate, estimate]);

  const handleUpdate = (nextAlternateEstimate) => {
    if (!nextAlternateEstimate) return;
    const nextAlternate = {
      id: nextAlternateEstimate.id || alternateId,
      name: nextAlternateEstimate.name || alternate?.name || "Bid Alternate",
      number: nextAlternateEstimate.number || "",
      customer: nextAlternateEstimate.customer || estimate.customer || "",
      version: nextAlternateEstimate.version || estimate.version || "1.0",
      notes: nextAlternateEstimate.notes || "",
      settings: {
        ...(estimate.settings || {}),
        ...(nextAlternateEstimate.settings || {}),
      },
      items: Array.isArray(nextAlternateEstimate.items) ? nextAlternateEstimate.items : [],
      createdAt: nextAlternateEstimate.createdAt || alternate?.createdAt || estimate.createdAt,
      updatedAt: nextAlternateEstimate.updatedAt || new Date().toISOString(),
      createdBy: nextAlternateEstimate.createdBy ?? alternate?.createdBy ?? estimate.createdBy ?? null,
      updatedBy: nextAlternateEstimate.updatedBy ?? estimate.updatedBy ?? estimate.createdBy ?? null,
    };

    onUpdate({
      ...estimate,
      updatedAt: new Date().toISOString(),
      alternates: nextAltArray(estimate, nextAlternate),
    });
  };

  if (!alternateEstimate) {
    return (
      <div style={{ padding: 24 }}>
        <button
          type="button"
          onClick={onBack}
          style={{ marginBottom: 16, padding: "6px 10px", border: "1px solid #CBD5E1", borderRadius: 4, background: "none", cursor: "pointer" }}
        >
          Back to Estimate
        </button>
        <div style={{ fontSize: 14, color: "#475569" }}>That bid alternate no longer exists.</div>
      </div>
    );
  }

  return (
    <ProjectHubEstimateProvider estimate={alternateEstimate} onChange={handleUpdate}>
      <EstimateEditorWorkspace
        estimate={alternateEstimate}
        onBack={onBack}
        onUpdate={handleUpdate}
        allowBidAlternateEditor={false}
        showProjectSettings={false}
        showBidAlternates={false}
      />
    </ProjectHubEstimateProvider>
  );
}

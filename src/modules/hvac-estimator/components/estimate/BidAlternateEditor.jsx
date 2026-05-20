import { useMemo } from "react";
import { EstimateDetail } from "./EstimateDetail.jsx";
import { ProjectHubEstimateProvider } from "../../shared/EstimateContext.jsx";
import { useEstimate } from "../../shared/EstimateContext.jsx";
import ErrorBoundary from "../../shared/ErrorBoundary.jsx";
import AHUSchematic from "../ahu/AHUSchematic.jsx";
import DXSchematic from "../dx/DXSchematic.jsx";
import FCUSchematic from "../fcu/FCUSchematic.jsx";
import ExhaustFanSchematic from "../exhaustFan/ExhaustFanSchematic.jsx";
import CustomComponentPage from "../custom/CustomComponentPage.jsx";
import NetworkSchematic from "../network/NetworkSchematic.jsx";
import PlantSchematic from "../plant/PlantSchematic.jsx";
import RTUSchematic from "../rtu/RTUSchematic.jsx";
import UHSchematic from "../uh/UHSchematic.jsx";
import VAVSchematic from "../vav/VAVSchematic.jsx";
import VRFSchematic from "../vrf/VRFSchematic.jsx";
import SelectionWizardPage from "../selectionWizard";

function createAlternateEstimate(parentEstimate, alternate) {
  return {
    ...parentEstimate,
    id: alternate.id,
    name: alternate.name || "Bid Alternate",
    number: alternate.number ?? parentEstimate.number ?? "",
    customer: alternate.customer ?? parentEstimate.customer ?? "",
    version: alternate.version ?? parentEstimate.version ?? "1.0",
    notes: alternate.notes ?? "",
    settings: { ...(parentEstimate.settings || {}) },
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
      settings: { ...(estimate.settings || {}) },
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
      <BidAlternateWorkspace
        estimate={alternateEstimate}
        onBack={onBack}
        onUpdate={handleUpdate}
      />
    </ProjectHubEstimateProvider>
  );
}

function BidAlternateWorkspace({ estimate, onBack, onUpdate }) {
  const { subPage, setSubPage } = useEstimate();

  if (subPage?.type === "wizard") {
    return (
      <EditorFrame title="System Wizard" onBack={() => setSubPage(null)}>
        <SelectionWizardPage
          hasActiveEstimate={true}
          onAddToEstimate={(type) => {
            setSubPage({ type });
          }}
        />
      </EditorFrame>
    );
  }

  if (subPage?.type) {
    const editor = (() => {
      switch (subPage.type) {
        case "ahu":
          return <AHUSchematic />;
        case "vav":
          return <VAVSchematic />;
        case "rtu":
          return <RTUSchematic />;
        case "dx":
          return <DXSchematic />;
        case "vrf":
          return <VRFSchematic />;
        case "fcu":
          return <FCUSchematic />;
        case "uh":
          return <UHSchematic />;
        case "plant":
          return <PlantSchematic />;
        case "network":
          return <NetworkSchematic />;
        case "exhaust-fan":
          return <ExhaustFanSchematic />;
        case "custom":
          return <CustomComponentPage />;
        default:
          return (
            <EstimateDetail
              estimate={estimate}
              onBack={onBack}
              onUpdate={onUpdate}
              showProjectSettings={false}
              showBidAlternates={false}
            />
          );
      }
    })();

    return (
      <ErrorBoundary fallback={<EditorCrashFallback systemType={subPage.type} onBack={() => setSubPage(null)} />}>
        {editor}
      </ErrorBoundary>
    );
  }

  return (
    <EstimateDetail
      estimate={estimate}
      onBack={onBack}
      onUpdate={onUpdate}
      showProjectSettings={false}
      showBidAlternates={false}
    />
  );
}

function EditorFrame({ title, onBack, children }) {
  return (
    <div style={{ minHeight: "calc(100vh - 8rem)", overflow: "auto" }}>
      <div className="flex items-center justify-between border-b border-border-default bg-surface-overlay px-4 py-2">
        <div className="text-sm font-semibold text-text-primary">{title}</div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-border-default px-3 py-1.5 text-sm font-semibold text-text-secondary transition hover:bg-surface-raised hover:text-text-primary"
        >
          Back to Estimate
        </button>
      </div>
      {children}
    </div>
  );
}

function EditorCrashFallback({ systemType, onBack }) {
  return (
    <div className="p-8">
      <h2 className="text-xl font-semibold text-text-primary">{String(systemType || "System").toUpperCase()} editor crashed</h2>
      <p className="mt-2 text-sm text-text-secondary">Return to the estimate, then reopen this editor or choose another system.</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-5 rounded-lg border border-border-default px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
      >
        Back to Estimate
      </button>
    </div>
  );
}

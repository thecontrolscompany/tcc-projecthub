import { EstimateDetail } from "./EstimateDetail.jsx";
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

/**
 * @typedef {Object} EstimateEditorWorkspaceProps
 * @property {Record<string, unknown>} estimate
 * @property {() => void} onBack
 * @property {(estimate: Record<string, unknown>) => void} onUpdate
 * @property {(() => void) | null} [onSave]
 * @property {(() => void) | null} [onDelete]
 * @property {boolean} [saving]
 * @property {boolean} [deleting]
 * @property {string} [status]
 * @property {(status: string) => void} [onStatusChange]
 * @property {"saved" | "saving" | "unsaved"} [saveChipState]
 * @property {string | null} [savedAt]
 * @property {"pending" | "kept" | "discarded"} [recoveryState]
 * @property {(() => void) | null} [onKeepRecoveredDraft]
 * @property {(() => void) | null} [onDiscardRecoveredDraft]
 * @property {boolean} [allowBidAlternateEditor]
 * @property {(() => import("react").ReactNode) | null} [renderBidAlternateEditor]
 * @property {boolean} [showProjectSettings]
 * @property {boolean} [showBidAlternates]
 * @property {string | null} [platformEstimateId]
 * @property {string | null} [initialProposalTab]
 */

/**
 * @param {EstimateEditorWorkspaceProps} props
 */
export function EstimateEditorWorkspace(props) {
  /** @type {EstimateEditorWorkspaceProps} */
  const {
    estimate,
    onBack,
    onUpdate,
    onSave = null,
    onDelete = null,
    saving = false,
    deleting = false,
    status = "draft",
    onStatusChange = null,
    saveChipState = "saved",
    savedAt = null,
    recoveryState = "kept",
    onKeepRecoveredDraft = null,
    onDiscardRecoveredDraft = null,
    allowBidAlternateEditor = false,
    renderBidAlternateEditor = null,
    showProjectSettings = false,
    showBidAlternates = false,
    platformEstimateId = null,
    initialProposalTab = null,
  } = props;
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
        case "alternate":
          if (allowBidAlternateEditor && typeof renderBidAlternateEditor === "function") {
            return renderBidAlternateEditor();
          }
          return (
            <EstimateDetail
              estimate={estimate}
              onBack={onBack}
              onUpdate={onUpdate}
              onSave={onSave}
              onDelete={onDelete}
              saving={saving}
              deleting={deleting}
              status={status}
              onStatusChange={onStatusChange}
              saveChipState={saveChipState}
              savedAt={savedAt}
              recoveryState={recoveryState}
              onKeepRecoveredDraft={onKeepRecoveredDraft}
              onDiscardRecoveredDraft={onDiscardRecoveredDraft}
              showProjectSettings={showProjectSettings}
              showBidAlternates={showBidAlternates}
              platformEstimateId={platformEstimateId}
              initialProposalTab={initialProposalTab}
            />
          );
        default:
          return (
            <EstimateDetail
              estimate={estimate}
              onBack={onBack}
              onUpdate={onUpdate}
              onSave={onSave}
              onDelete={onDelete}
              saving={saving}
              deleting={deleting}
              status={status}
              onStatusChange={onStatusChange}
              saveChipState={saveChipState}
              savedAt={savedAt}
              recoveryState={recoveryState}
              onKeepRecoveredDraft={onKeepRecoveredDraft}
              onDiscardRecoveredDraft={onDiscardRecoveredDraft}
              showProjectSettings={showProjectSettings}
              showBidAlternates={showBidAlternates}
              platformEstimateId={platformEstimateId}
              initialProposalTab={initialProposalTab}
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
      onSave={onSave}
      onDelete={onDelete}
      saving={saving}
      deleting={deleting}
      status={status}
      onStatusChange={onStatusChange}
      saveChipState={saveChipState}
      savedAt={savedAt}
      recoveryState={recoveryState}
      onKeepRecoveredDraft={onKeepRecoveredDraft}
      onDiscardRecoveredDraft={onDiscardRecoveredDraft}
      showProjectSettings={showProjectSettings}
      showBidAlternates={showBidAlternates}
      platformEstimateId={platformEstimateId}
      initialProposalTab={initialProposalTab}
    />
  );
}

/**
 * @param {{ title: string; onBack: () => void; children: import("react").ReactNode }} props
 */
export function EditorFrame({ title, onBack, children }) {
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

/**
 * @param {{ systemType?: string; onBack: () => void }} props
 */
export function EditorCrashFallback({ systemType, onBack }) {
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

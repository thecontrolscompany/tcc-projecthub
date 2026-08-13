import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EstimateDocumentsPanel } from "./EstimateDocumentsPanel.tsx";
import { ProposalDetailsPanel } from "./ProposalDetailsPanel.jsx";
import { ProposalScopePanel } from "./ProposalScopePanel.jsx";

export function ProposalDetailsModal({
  open,
  initialTab = "details",
  initialAutoProvision = false,
  settings,
  onChange,
  onClose,
  saveState = "saved",
  estimateId,
  sharepointFolder,
  drawingBasis,
  onChangeDrawingBasis,
  onFolderProvisioned,
}) {
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab === "documents" ? "documents" : "details");
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const tabButtonStyle = (isActive) => ({
    backgroundColor: isActive ? "#1f3c5a" : "#ffffff",
    color: isActive ? "#ffffff" : "#334155",
    border: `1px solid ${isActive ? "#1f3c5a" : "#cbd5e1"}`,
    boxShadow: isActive ? "0 10px 24px rgba(31, 60, 90, 0.22)" : "none",
  });

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] max-h-[85vh] min-h-0 w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Proposal Details
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                Edit proposal information and supporting documents
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Close
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              style={tabButtonStyle(activeTab === "details")}
              className="rounded-full px-4 py-2 text-sm font-semibold transition hover:bg-slate-50"
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("documents")}
              style={tabButtonStyle(activeTab === "documents")}
              className="rounded-full px-4 py-2 text-sm font-semibold transition hover:bg-slate-50"
            >
              Documents
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("scope")}
              style={tabButtonStyle(activeTab === "scope")}
              className="rounded-full px-4 py-2 text-sm font-semibold transition hover:bg-slate-50"
            >
              Scope
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-scroll overscroll-contain p-6">
          {activeTab === "documents" ? (
            estimateId ? (
              <EstimateDocumentsPanel
                embedded
                estimateId={estimateId}
                sharepointFolder={sharepointFolder}
                drawingBasis={drawingBasis}
                onChangeDrawingBasis={onChangeDrawingBasis}
                onFolderProvisioned={onFolderProvisioned}
                autoProvision={initialAutoProvision}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                Documents will appear here once this estimate is loaded.
              </div>
            )
          ) : activeTab === "scope" ? (
            <ProposalScopePanel
              settings={settings}
              onChange={onChange}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <ProposalDetailsPanel
                settings={settings}
                onChange={onChange}
              />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>Proposal fields auto-save as you edit.</span>
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  saveState === "saving"
                    ? "border-amber-300 bg-amber-100 text-amber-700"
                    : saveState === "unsaved"
                      ? "border-rose-300 bg-rose-100 text-rose-700"
                      : "border-emerald-300 bg-emerald-100 text-emerald-700"
                }`}
              >
                {saveState === "saving" ? "Saving..." : saveState === "unsaved" ? "Unsaved changes" : "Saved"}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

import { useEffect, useState } from "react";
import { EstimateDocumentsPanel } from "./EstimateDocumentsPanel.tsx";
import { ProposalDetailsPanel } from "./ProposalDetailsPanel.jsx";

export function ProposalDetailsModal({
  open,
  settings,
  onChange,
  onClose,
  estimateId,
  sharepointFolder,
  drawingBasis,
  onChangeDrawingBasis,
}) {
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (!open) return undefined;

    setActiveTab("details");

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const tabButtonStyle = (isActive) => ({
    backgroundColor: isActive ? "#1f3c5a" : "#ffffff",
    color: isActive ? "#ffffff" : "#334155",
    border: `1px solid ${isActive ? "#1f3c5a" : "#cbd5e1"}`,
    boxShadow: isActive ? "0 10px 24px rgba(31, 60, 90, 0.22)" : "none",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
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
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {activeTab === "documents" ? (
            estimateId ? (
              <EstimateDocumentsPanel
                embedded
                estimateId={estimateId}
                sharepointFolder={sharepointFolder}
                drawingBasis={drawingBasis}
                onChangeDrawingBasis={onChangeDrawingBasis}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                Documents will appear here once this estimate is loaded.
              </div>
            )
          ) : (
            <ProposalDetailsPanel
              settings={settings}
              onChange={onChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

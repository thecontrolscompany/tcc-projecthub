import { useEffect, useState } from "react";
import { T } from "../../shared/tokens.js";
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
    if (!open) return;
    setActiveTab("details");
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const hasDocumentsTab = Boolean(estimateId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Proposal Details"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(15, 23, 42, 0.58)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(96vw, 1320px)",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: 16,
          border: "1px solid " + T.border,
          background: T.bg,
          boxShadow: "0 28px 80px rgba(15,23,42,0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: "16px 20px",
            borderBottom: "1px solid " + T.border,
            background: T.surface,
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                color: T.muted,
                fontFamily: T.mono,
                textTransform: "uppercase",
                letterSpacing: 1.4,
              }}
            >
              Proposal Details
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: T.dim }}>
              Expanded workspace for proposal fields and future proposal tools.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 12px",
              border: "1px solid " + T.border2,
              borderRadius: 8,
              background: "none",
              color: T.muted,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: T.mono,
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>

        <div style={{ borderBottom: "1px solid " + T.border, background: T.bg, padding: "0 20px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "10px 0" }}>
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              style={{
                padding: "7px 12px",
                border: "1px solid " + (activeTab === "details" ? T.blue : T.border2),
                borderRadius: 999,
                background: activeTab === "details" ? T.blueFaint : "none",
                color: activeTab === "details" ? T.blue : T.muted,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: T.mono,
                fontWeight: 600,
              }}
            >
              Details
            </button>
            {hasDocumentsTab && (
              <button
                type="button"
                onClick={() => setActiveTab("documents")}
                style={{
                  padding: "7px 12px",
                  border: "1px solid " + (activeTab === "documents" ? T.blue : T.border2),
                  borderRadius: 999,
                  background: activeTab === "documents" ? T.blueFaint : "none",
                  color: activeTab === "documents" ? T.blue : T.muted,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: T.mono,
                  fontWeight: 600,
                }}
              >
                Documents
              </button>
            )}
          </div>
        </div>

        <div style={{ overflow: "auto", padding: 20 }}>
          {activeTab === "documents" && hasDocumentsTab ? (
            <EstimateDocumentsPanel
              embedded
              estimateId={estimateId}
              sharepointFolder={sharepointFolder}
              drawingBasis={drawingBasis || ""}
              onChangeDrawingBasis={onChangeDrawingBasis || (() => {})}
            />
          ) : (
            <ProposalDetailsPanel settings={settings} onChange={onChange} />
          )}
        </div>
      </div>
    </div>
  );
}

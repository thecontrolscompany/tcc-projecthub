import { useEffect } from "react";
import { T } from "../../shared/tokens.js";
import { ProposalDetailsPanel } from "./ProposalDetailsPanel.jsx";

export function ProposalDetailsModal({ open, settings, onChange, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

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
            alignItems: "center",
            justifyContent: "space-between",
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

        <div style={{ overflow: "auto", padding: 20 }}>
          <ProposalDetailsPanel settings={settings} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

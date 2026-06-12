import { T } from "../../shared/tokens.js";
import { ESTIMATE_SCOPE_MODES, getEstimateScopeModeLabel, normalizeEstimateScopeMode } from "./projectSettings.js";

export function ProposalDetailsPanel({ settings, onChange }) {
  const S = settings;

  const textField = (key, label, placeholder = "") => (
    <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </span>
      <input
        type="text"
        value={S[key] || ""}
        placeholder={placeholder}
        onChange={(e) => onChange({ [key]: e.target.value })}
        style={{
          padding: "5px 8px",
          border: "1px solid " + T.border2,
          borderRadius: 4,
          fontSize: 12,
          background: T.bg,
          color: T.text,
          outline: "none",
        }}
      />
    </label>
  );

  const dateField = (key, label) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </span>
      <input
        type="date"
        value={S[key] || ""}
        onChange={(e) => onChange({ [key]: e.target.value })}
        style={{
          padding: "5px 8px",
          border: "1px solid " + T.border2,
          borderRadius: 4,
          fontSize: 12,
          background: T.bg,
          color: T.text,
          outline: "none",
          fontFamily: T.mono,
        }}
      />
    </label>
  );

  const selectField = (key, label, options, note = "") => (
    <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </span>
      <select
        value={S[key] || options[0]?.value || ""}
        onChange={(e) => onChange({ [key]: e.target.value })}
        style={{
          padding: "5px 8px",
          border: "1px solid " + T.border2,
          borderRadius: 4,
          fontSize: 12,
          background: T.bg,
          color: T.text,
          outline: "none",
          fontFamily: T.mono,
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {note && <div style={{ fontSize: 10, color: T.dim }}>{note}</div>}
    </label>
  );

  const section = (children) => (
    <div
      style={{
        background: T.surface,
        border: "1px solid " + T.border,
        borderRadius: 8,
        overflow: "hidden",
        flex: "1 1 280px",
        minWidth: 260,
      }}
    >
      <div style={{ padding: "7px 14px", background: "#0F766E12", borderBottom: "1px solid #0F766E30" }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#0F766E",
            fontFamily: T.mono,
            textTransform: "uppercase",
            letterSpacing: 1.5,
          }}
        >
          Proposal Details
        </span>
      </div>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );

  return section(
    <>
      <div style={{ fontSize: 10, color: T.muted }}>
        Used in the exported customer proposal.
      </div>
      <div style={{ fontSize: 11, color: T.text, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "6px 8px" }}>
        Current bid version: <strong>{getEstimateScopeModeLabel(S.estimateScopeMode)}</strong>
      </div>
      {selectField(
        "proposalScopeMode",
        "Proposal Detail",
        [
          { value: "brief", label: "Brief" },
          { value: "detailed", label: "Detailed" },
        ],
        "Brief shows a short summary. Detailed spells out selected components.",
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1 }}>
          Bid Version
        </span>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {ESTIMATE_SCOPE_MODES.map((mode) => {
            const checked = normalizeEstimateScopeMode(S.estimateScopeMode) === mode.id;
            return (
              <label
                key={mode.id}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  cursor: "pointer",
                  border: `1px solid ${checked ? "#2563EB" : T.border2}`,
                  background: checked ? "#EFF6FF" : T.bg,
                  borderRadius: 6,
                  padding: "8px 10px",
                }}
              >
                <input
                  type="radio"
                  name="estimateScopeMode"
                  checked={checked}
                  onChange={() => onChange({ estimateScopeMode: mode.id })}
                  style={{ marginTop: 2, accentColor: T.blue, cursor: "pointer" }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: T.text, fontFamily: T.mono }}>{mode.label}</div>
                  <div style={{ fontSize: 10, color: T.muted, lineHeight: 1.4 }}>{mode.description}</div>
                </div>
              </label>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: T.dim, lineHeight: 1.5 }}>
          The controls estimate should start from the same equipment selection, then get its own controls parts and cost model as that scope is defined.
        </div>
      </div>
      {textField("baseScopeName", "Base Scope Name", "Scope")}
      {textField("customerContact", "Customer Contact", "Attn line for proposal")}
      {dateField("estimateDate", "Estimate Date")}
    </>,
  );
}

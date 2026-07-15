import { T } from "../../shared/tokens.js";
import { getEstimateScopeModeLabel } from "./projectSettings.js";

function formatDateInputValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10);

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return "";
}

function normalizeDateInputValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const formatted = formatDateInputValue(text);
  return formatted || text;
}

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
        value={formatDateInputValue(S[key])}
        onChange={(e) => onChange({ [key]: normalizeDateInputValue(e.currentTarget.value) })}
        onInput={(e) => onChange({ [key]: normalizeDateInputValue(e.currentTarget.value) })}
        onBlur={(e) => onChange({ [key]: normalizeDateInputValue(e.currentTarget.value) })}
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
        Used in the exported customer proposal. Changes auto-save as you edit.
      </div>
      <div style={{ fontSize: 11, color: T.text, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "6px 8px" }}>
        Bid version: <strong>{getEstimateScopeModeLabel(S.estimateScopeMode)}</strong> · change this in the Settings tab
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
      {textField("baseScopeName", "Base Scope Name", "Scope")}
      {textField("customerContact", "Customer Contact", "Attn line for proposal")}
      {dateField("estimateDate", "Estimate Date")}
    </>,
  );
}

import { T } from "../../shared/tokens.js";

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
      {S.customerScopeImport && (
        <div
          style={{
            fontSize: 10,
            color: "#0F766E",
            background: "#0F766E12",
            border: "1px solid #0F766E30",
            borderRadius: 6,
            padding: "6px 8px",
            lineHeight: 1.4,
          }}
        >
          Parsed scope from the AI importer is loaded into this estimate and will be used when customer scope is enabled.
        </div>
      )}
      {selectField(
        "proposalScopeMode",
        "Proposal Scope",
        [
          { value: "brief", label: "Brief" },
          { value: "detailed", label: "Detailed" },
        ],
        "Brief shows tags and quantities only. Detailed includes the selected components for each system.",
      )}
      {textField("baseScopeName", "Base Scope Name", "Scope")}
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
        <input
          type="checkbox"
          checked={!!S.useCustomerScope}
          onChange={(e) => onChange({ useCustomerScope: e.target.checked })}
          style={{ width: 16, height: 16, accentColor: T.blue, cursor: "pointer" }}
        />
        <span style={{ fontSize: 12, color: T.text, fontFamily: T.mono }}>Use customer scope</span>
      </label>
      {S.useCustomerScope &&
        (<label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1 }}>
            Customer Scope
          </span>
          <textarea
            value={S.customerScope || ""}
            placeholder="Paste the customer-provided scope here. Each line will be formatted into the proposal."
            rows={8}
            onChange={(e) => onChange({ customerScope: e.target.value })}
            style={{
              padding: "8px 10px",
              border: "1px solid " + T.border2,
              borderRadius: 4,
              fontSize: 12,
              background: T.bg,
              color: T.text,
              outline: "none",
              fontFamily: T.mono,
              resize: "vertical",
              lineHeight: 1.5,
            }}
          />
        </label>)}
      {textField("customerContact", "Customer Contact", "Attn line for proposal")}
      {dateField("estimateDate", "Estimate Date")}
    </>,
  );
}

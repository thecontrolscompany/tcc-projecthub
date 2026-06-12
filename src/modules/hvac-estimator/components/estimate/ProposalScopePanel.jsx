import { T } from "../../shared/tokens.js";

export function ProposalScopePanel({ settings, onChange }) {
  const S = settings;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
            rows={20}
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
    </div>
  );
}

import { useMemo, useState } from "react";
import { UnitEditorPage } from "../../shared/UnitEditorPage.jsx";
import { useEstimate } from "../../shared/EstimateContext.jsx";
import { T } from "../../shared/tokens.js";
import { getCustomComponentOptions } from "../../shared/componentCatalog.js";

function EmptyFlow() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 6 }}>Custom Equipment</div>
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
          Pick a catalog component first, then configure the line item and add it to the estimate.
        </div>
      </div>
    </div>
  );
}

function CustomComponentSelector({ options, selectedId, onChange }) {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 4 }}>Custom Equipment</div>
      <div style={{ fontSize: 14, color: T.muted, marginBottom: 20 }}>
        Select the catalog component you want to add as a custom line item.
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1 }}>
          Component
        </span>
        <select
          value={selectedId}
          onChange={(event) => onChange(event.target.value)}
          style={{
            padding: "10px 12px",
            border: `1px solid ${T.border2}`,
            borderRadius: 6,
            background: T.surface,
            color: T.text,
            fontSize: 13,
            fontFamily: T.mono,
            outline: "none",
          }}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export default function CustomComponentPage({ onBack = null } = {}) {
  const { activeEstimate } = useEstimate();
  const quoteDefault = activeEstimate?.settings?.defaultInstallType ?? "EMT";
  const options = useMemo(() => getCustomComponentOptions(), []);
  const [selectedId, setSelectedId] = useState(options[0]?.id || "");
  const selected = options.find((option) => option.id === selectedId) || options[0] || null;

  if (!selected) {
    return <CustomComponentSelector options={[]} selectedId="" onChange={() => {}} />;
  }

  if (!selectedId) {
    return <CustomComponentSelector options={options} selectedId={selectedId} onChange={setSelectedId} />;
  }

  return (
    <UnitEditorPage
      onBack={onBack}
      key={selected.id}
      type="custom"
      comps={[selected.component]}
      title={selected.label}
      badge="CUST"
      accent="#6B7280"
      accentBg="#F3F4F6"
      accentBorder="#D1D5DB"
      defaultTag="CUST"
      defaultLocation="Field"
      defaultInstallType={quoteDefault}
      pageKey="custom"
      cfg={{ componentId: selected.id }}
      toolbarExtra={(
        <button
          type="button"
          onClick={() => setSelectedId("")}
          style={{
            padding: "3px 9px",
            border: `1px solid ${T.border2}`,
            borderRadius: 4,
            background: "none",
            color: T.muted,
            cursor: "pointer",
            fontSize: 11,
            fontFamily: T.mono,
          }}
        >
          ← Change Component
        </button>
      )}
      flowNode={() => <EmptyFlow />}
      mainFooter={(selectedComps) => (
        <div style={{ padding: "0 20px 8px", fontSize: 11, color: T.muted, fontFamily: T.mono }}>
          {selectedComps.length} component{selectedComps.length === 1 ? "" : "s"} selected
        </div>
      )}
    />
  );
}

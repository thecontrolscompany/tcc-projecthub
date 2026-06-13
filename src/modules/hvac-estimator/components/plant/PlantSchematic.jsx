import { useEffect, useState } from "react";
import { T } from "../../shared/tokens.js";
import { useEstimate } from "../../shared/EstimateContext.jsx";
import { UnitEditorPage } from "../../shared/UnitEditorPage.jsx";
import { PlantFlowDiagram } from "./PlantFlowDiagram.jsx";
import { PLANT_TYPES, PLANT_COMPS } from "./plantData.js";
import { ProjectHubOntologyGraphicPanel } from "../../shared/ProjectHubOntologyGraphicPanel";
import { resolveProjectHubGraphicsSource } from "../../shared/projecthubGraphics";

function PlantTypeSelector({ onSelect, onBack }) {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 24px" }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          marginBottom: 18,
          padding: "6px 11px",
          border: `1px solid ${T.border2}`,
          borderRadius: 4,
          background: T.surface,
          color: T.muted,
          cursor: "pointer",
          fontSize: 12,
          fontFamily: T.mono,
        }}
      >
        ← Back to Estimate
      </button>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 4 }}>Central Plant</div>
      <div style={{ fontSize: 14, color: T.muted, marginBottom: 28 }}>
        Select the plant equipment type. Each becomes a separate line item in the estimate.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {PLANT_TYPES.map(type => (
          <button
            key={type.id}
            onClick={() => onSelect(type)}
            style={{
              padding: "14px 16px",
              borderRadius: 7,
              textAlign: "left",
              cursor: "pointer",
              border: `2px solid ${T.border}`,
              background: T.surface,
              transition: "all 0.12s",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
            onMouseEnter={event => {
              event.currentTarget.style.borderColor = T.blue;
              event.currentTarget.style.background = T.blueFaint;
            }}
            onMouseLeave={event => {
              event.currentTarget.style.borderColor = T.border;
              event.currentTarget.style.background = T.surface;
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1, marginTop: 2 }}>{type.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 3 }}>{type.label}</div>
              <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4 }}>{type.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PlantSchematic({ onBack = null } = {}) {
  const { activeEstimate, editingItem, subPage, setSubPage } = useEstimate();
  const editPlantType = editingItem?.cfg?.plantType
    ? PLANT_TYPES.find(type => type.id === editingItem.cfg.plantType) || null
    : null;
  const [plantType, setPlantType] = useState(editPlantType);
  const quoteDefault = activeEstimate?.settings?.defaultInstallType ?? "EMT";
  const handleBack = () => {
    if (typeof onBack === "function") {
      onBack();
      return;
    }
    setSubPage(null);
  };

  useEffect(() => {
    setPlantType(editPlantType);
  }, [editingItem?.id]);

  useEffect(() => {
    const nextPlantType = subPage?.type === "plant" ? subPage?.conduitFillDraft?.cfg?.plantType : null;
    if (!nextPlantType) return;
    setPlantType(PLANT_TYPES.find(type => type.id === nextPlantType) || null);
  }, [subPage]);

  if (!plantType) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <PlantTypeSelector onSelect={setPlantType} onBack={handleBack} />
        </div>
      </div>
    );
  }

  return (
    <UnitEditorPage
      key={plantType.id}
      type="plant"
      comps={PLANT_COMPS[plantType.id] || []}
      title={plantType.label}
      badge="PLANT"
      accent={T.blue}
      accentBg={T.blueFaint}
      accentBorder={T.blueMid}
      defaultTag={plantType.label}
      defaultLocation="Mechanical Room"
      defaultInstallType={quoteDefault}
      pageKey="plant"
      cfg={{ plantType: plantType.id }}
      toolbarExtra={(
        <button
          onClick={() => setPlantType(null)}
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
          ← Change Type
        </button>
      )}
      flowNode={(selected, toggle) => {
        const graphicsSource = resolveProjectHubGraphicsSource("plant", { plantType: plantType.id }, selected);
        if (graphicsSource) {
          return (
            <ProjectHubOntologyGraphicPanel
              type="plant"
              cfg={{ plantType: plantType.id }}
              selected={selected}
            />
          );
        }

        return <PlantFlowDiagram plantType={plantType.id} selected={selected} onToggle={toggle} />;
      }}
      assemblyTitle="Add Plant Assembly"
      assemblyDescription="Select from the available central plant assemblies for this plant type. This uses the current assembly pricing and adds it as an extra line item."
      assemblyEmptyText="No plant assemblies match that search."
      assemblyCategory="Plant Assembly"
    />
  );
}

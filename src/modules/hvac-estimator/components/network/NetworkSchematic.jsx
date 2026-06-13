import { UnitEditorPage } from "../../shared/UnitEditorPage.jsx";
import { useEstimate } from "../../shared/EstimateContext.jsx";
import { T, CAT_COLOR } from "../../shared/tokens.js";
import { NETWORK_COMPS } from "./networkData.js";
import { NetworkFlowDiagram } from "./NetworkFlowDiagram.jsx";

export default function NetworkPage({ onBack = null } = {}) {
  const { activeEstimate } = useEstimate();
  const quoteDefault = activeEstimate?.settings?.defaultInstallType ?? "EMT";

  return (
    <UnitEditorPage
      onBack={onBack}
      type="network"
      comps={NETWORK_COMPS}
      title="Network"
      badge="NET"
      defaultTag="NET"
      defaultLocation="IDF Room"
      defaultInstallType={quoteDefault}
      pageKey="network"
      flowNode={(selected, toggle) => (
        <NetworkFlowDiagram selected={selected} onToggle={toggle} />
      )}
      mainFooter={(selected, toggle) => {
        const selComps = NETWORK_COMPS.filter(c => selected.some(s => s.id === c.id));
        if (!selComps.length) return null;
        return (
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", padding:"0 20px 8px" }}>
            {selComps.map(comp => {
              const color = CAT_COLOR[comp.cat] || T.steel;
              return (
                <div key={comp.id} onClick={() => toggle(comp.id)} style={{
                  display:"flex", alignItems:"center", gap:4, padding:"2px 8px 2px 5px",
                  background:color+"10", border:"1px solid "+color+"28",
                  borderRadius:12, cursor:"pointer" }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:color }} />
                  <span style={{ fontSize:10, color:T.muted }}>{comp.name}</span>
                </div>
              );
            })}
          </div>
        );
      }}
    />
  );
}

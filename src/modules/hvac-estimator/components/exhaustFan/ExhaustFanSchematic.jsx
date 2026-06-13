import { UnitEditorPage } from "../../shared/UnitEditorPage.jsx";
import { useEstimate } from "../../shared/EstimateContext.jsx";
import { T } from "../../shared/tokens.js";
import { EXHAUST_FAN_COMPS } from "./exhaustFanData.js";

function EmptyFlow() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 6 }}>Exhaust Fan</div>
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
          Configure the exhaust fan controls and related components, then add the line item back to the estimate.
        </div>
      </div>
    </div>
  );
}

export default function ExhaustFanSchematic() {
  const { activeEstimate } = useEstimate();
  const quoteDefault = activeEstimate?.settings?.defaultInstallType ?? "EMT";

  return (
    <UnitEditorPage
      type="exhaust-fan"
      comps={EXHAUST_FAN_COMPS}
      title="Exhaust Fan"
      badge="EF"
      accent="#B45309"
      accentBg="#FFFBEB"
      accentBorder="#FCD34D"
      defaultTag="EF"
      defaultLocation="Mechanical Room"
      defaultInstallType={quoteDefault}
      pageKey="exhaust-fan"
      flowNode={() => <EmptyFlow />}
      mainFooter={(selected) => (
        <div style={{ padding: "0 20px 8px", fontSize: 11, color: T.muted, fontFamily: T.mono }}>
          {selected.length} component{selected.length === 1 ? "" : "s"} selected
        </div>
      )}
    />
  );
}

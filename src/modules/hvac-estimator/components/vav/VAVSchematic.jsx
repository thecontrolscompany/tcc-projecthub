import { useEffect, useMemo, useState } from "react";
import { T, CAT_COLOR } from "../../shared/tokens.js";
import { SidebarLayout } from "../../shared/SidebarLayout.jsx";
import { fmt$, fmtHr } from "../../shared/utils.js";
import { AssemblyPickerModal } from "../../shared/AssemblyPickerModal.jsx";
import { toAssemblyOptions } from "../../shared/assemblyPicker.js";
import {
  VAV_COMPS,
  VAV_COMPONENT_GROUPS,
  VAV_DUCT_TYPES,
  VAV_HEAT_TYPES,
  VAV_FAN_TYPES,
  VAV_ACTUATOR_TYPES,
  VAV_RADIANT_TYPES,
  VAV_STARTER_TEMPLATES,
  applyVavStarterTemplate,
  getVisibleVavComponents,
  normalizeVavCfg,
  reconcileVavSelected,
  toggleVavComponentSelection,
} from "./vavData.js";
import { AddToEstimateBtn } from "../../shared/AddToEstimateBtn.jsx";
import { useEstimate } from "../../shared/EstimateContext.jsx";
import { calcAssembly, ASSEMBLIES, UNIT_ITEMS } from "../../shared/assemblyData.js";
import { SchematicTabs } from "../../shared/SchematicTabs.jsx";
import { DiagramViewer } from "../../shared/DiagramViewer.jsx";
import { PointsList } from "../../shared/PointsList.jsx";
import { TemplateSvgDiagram } from "../../shared/TemplateSvgDiagram.jsx";
import {
  buildCableBundleFromPoints,
  CONDUIT_FILL_BUNDLE_KEY,
  CONDUIT_FILL_CONTEXT_KEY,
  findHomeRunComponentId,
} from "../../shared/conduitFill.js";

const EXCLUDED_VAV_IDS = new Set(["vav-power", "vav-pwr-trunk"]);
const ACTIVE_VAV_COMPS = VAV_COMPS.filter(comp => !EXCLUDED_VAV_IDS.has(comp.id));
const LEGACY_COMM_AID_BY_INSTALL = { EMT: "60142", Plenum: "219" };
const LEGACY_SHARED_XFMR_AID = "60132";
const LEGACY_POWER_TRUNK_AID_BY_INSTALL = { EMT: "60135", Plenum: "60052" };
const MODERN_CAT6_AID_BY_INSTALL = { EMT: "852", Plenum: "854" };
const RJ45_TERM_AID = "190";
const LEGACY_VALIDATION_AID = "200";
const LEGACY_SHARED_QTY = 0.2;
const LEGACY_VALIDATION_QTY = 10;
const LEGACY_BASE_COMM_FT = 40;
const DEFAULT_POWER_MODE = "built-in";
const DEFAULT_COMM_MODE = "legacy-223";
const DEFAULT_INTEGRATION_MODE = "integrated";
const DAMPR_COMP_ID = "vav-act";
const DAMPR_INCR_COMP_ID = "vav-act-incr";
const FLOW_COMP_ID = "flow-sensor";
const ACTUATOR_GROUP = VAV_COMPONENT_GROUPS.find(group => group.groupId === "vav-actuator-type");
const ACTUATOR_MEMBER_IDS = new Set(
  VAV_COMPS.filter(comp => comp.groupId === ACTUATOR_GROUP?.groupId).map(comp => comp.id)
);
const REHEAT_GROUP = VAV_COMPONENT_GROUPS.find(group => group.groupId === "reheat-actuator");
const REHEAT_MEMBER_IDS = new Set(
  VAV_COMPS.filter(comp => comp.groupId === REHEAT_GROUP?.groupId).map(comp => comp.id)
);

const normalizeCfg = cfg => {
  const base = normalizeVavCfg(cfg);
  return {
    ...base,
    powerMode: cfg?.powerMode || base.powerMode || DEFAULT_POWER_MODE,
    commMode: cfg?.commMode || base.commMode || DEFAULT_COMM_MODE,
    damperIntegration: cfg?.damperIntegration || base.damperIntegration || DEFAULT_INTEGRATION_MODE,
    flowIntegration: cfg?.flowIntegration || base.flowIntegration || DEFAULT_INTEGRATION_MODE,
    commRunFt: Number.isFinite(Number(cfg?.commRunFt))
      ? Number(cfg.commRunFt)
      : base.commRunFt ?? LEGACY_BASE_COMM_FT,
  };
};
const labelFor = (opts, id) => opts.find(opt => opt.id === id)?.label || id;
const VAV_TEMPLATE_OPTIONS = [
  { id: "", label: "Custom" },
  ...VAV_STARTER_TEMPLATES,
];

function buildVavTemplateVisibility(cfg, selected) {
  const activeCfg = normalizeCfg(cfg);
  const on = id => selected.some(item => item.id === id);

  const showZoneCo2 = on("zn-co2");
  const showDischarge = on("disch-temp");
  const showDamperActuator = activeCfg.actuatorType === "integrated" || [...ACTUATOR_MEMBER_IDS].some(id => on(id));
  const showValve = activeCfg.heatType === "valve" && [...REHEAT_MEMBER_IDS].some(id => on(id));
  const showElectric = activeCfg.heatType === "electric";
  const showRadiant = activeCfg.radiant === "yes" && on("rad-htg");

  return {
    base_single: activeCfg.ductType === "single",
    base_dual: activeCfg.ductType === "dual",
    base_series_fan: activeCfg.fanType === "series",
    base_parallel_fan: activeCfg.fanType === "parallel",
    base_heat: activeCfg.heatType !== "cooling-only",
    base_valve_heat: activeCfg.heatType === "valve",
    base_elec_heat: activeCfg.heatType === "electric",
    base_radiant: showRadiant,
    device_flow: on("flow-sensor"),
    device_damper_act: showDamperActuator,
    device_controller: on("vav-ctrl"),
    device_discharge: showDischarge,
    device_valve: showValve,
    device_zone: on("zn-temp") || showZoneCo2,
    device_zone_co2: showZoneCo2,
    device_radiant: showRadiant,
    label_heat_valve: showValve,
    label_elec_heat: showElectric,
    "intake-duct": true,
    "supply-duct": true,
    da: true,
    sa: true,
    "da-vp": on("flow-sensor"),
    "dpr-o": showDamperActuator,
    "da-t": showDischarge,
    "sa-t": false,
    "htg-vlv": showValve,
    "htg-c": showElectric,
    "htg-c2": showElectric,
    "htg-c3": showElectric,
    "htg-scr": showElectric,
    "rad-htg": showRadiant,
    "zn-t": on("zn-temp") || showZoneCo2,
    "zn-q": showZoneCo2,
    "zn-h": false,
    "occ-s": false,
    "light-c": false,
  };
}

function buildInitialVavSelection(cfg) {
  const activeCfg = normalizeCfg(cfg);
  const ids = new Set(getVisibleVavComponents(activeCfg, ACTIVE_VAV_COMPS).filter(comp => comp.def && !comp.hidden).map(comp => comp.id));
  ids.add("zn-temp");
  ids.delete("zn-co2");
  if (activeCfg.damperIntegration === "integrated" || activeCfg.flowIntegration === "integrated") {
    ids.add("vav-ctrl");
  }

  return reconcileVavSelected(
    [...ids].map(id => ({ id, qty: 1 })),
    activeCfg,
    { components: ACTIVE_VAV_COMPS }
  );
}

function VAVSchematic({ selected, onToggle, hasReheat, damperToggleId, hasDamperActuator }) {
  const [hov, setHov] = useState(null);
  const on = id => selected.some(s => s.id === id);
  const onReheatActuator = [...REHEAT_MEMBER_IDS].some(id => on(id));
  const cc = CAT_COLOR;
  const DY = 210, DH = 28, TOP = DY-DH, BOT = DY+DH;

  return (
    <svg viewBox="0 0 680 380" style={{ width:"100%", height:"100%", display:"block" }}>
      <rect width="680" height="380" fill={T.surface} />
      {Array.from({length:35}).map((_,i)=>(
        <line key={"v"+i} x1={i*20} y1="0" x2={i*20} y2="380" stroke={T.border} strokeWidth="0.3" />
      ))}
      {Array.from({length:20}).map((_,i)=>(
        <line key={"h"+i} x1="0" y1={i*20} x2="680" y2={i*20} stroke={T.border} strokeWidth="0.3" />
      ))}
      <defs>
        <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <polygon points="0,0 8,4 0,8" fill={T.text} />
        </marker>
      </defs>

      {/* Inlet duct */}
      <rect x="18" y={TOP+2} width="110" height={DH*2-4} rx="2"
        fill={T.panel} stroke={T.border2} strokeWidth="1.5" />
      <text x="73" y={DY-2} textAnchor="middle" fontSize="8" fill={T.muted} fontFamily={T.mono}>INLET DUCT</text>
      <text x="73" y={DY+10} textAnchor="middle" fontSize="7" fill={T.dim} fontFamily={T.mono}>from AHU</text>
      <line x1="30" y1={DY} x2="48" y2={DY} stroke={T.dim} strokeWidth="1" markerEnd="url(#arr)" />
      <line x1="65" y1={DY} x2="83" y2={DY} stroke={T.dim} strokeWidth="1" markerEnd="url(#arr)" />

      {/* VAV box */}
      <rect x="128" y={TOP-2} width="220" height={DH*2+4} rx="3"
        fill={T.blueFaint} stroke={T.blue} strokeWidth="2" />
      <text x="238" y={DY-4} textAnchor="middle" fontSize="11"
        fill={T.blue} fontFamily={T.mono} fontWeight="700">VAV BOX</text>
      <text x="238" y={DY+10} textAnchor="middle" fontSize="7.5"
        fill={T.blueL} fontFamily={T.mono}>Variable Air Volume Terminal Unit</text>

      {/* Damper */}
      <g transform="translate(200,210)"
        style={{ cursor:"pointer" }} onClick={() => onToggle(damperToggleId)}
        opacity={hasDamperActuator ? 1 : 0.3}>
        <rect x="-16" y="-11" width="32" height="22" rx="2"
          fill={hasDamperActuator ? "#F0FDFA" : T.panel}
          stroke={hasDamperActuator ? cc.Actuators : T.dim}
          strokeWidth={hasDamperActuator ? 2 : 1.5} />
        <line x1="-12" y1="0" x2="12" y2="0"
          stroke={hasDamperActuator ? cc.Actuators : T.dim} strokeWidth="2" />
        <line x1="-12" y1="-6" x2="12" y2="-6"
          stroke={hasDamperActuator ? cc.Actuators+"66" : T.faint} strokeWidth="1" />
        <line x1="-12" y1="6" x2="12" y2="6"
          stroke={hasDamperActuator ? cc.Actuators+"66" : T.faint} strokeWidth="1" />
      </g>
      <text x="200" y="238" textAnchor="middle" fontSize="7.5"
        fill={hasDamperActuator ? cc.Actuators : T.dim} fontFamily={T.mono}>DAMPER</text>

      {/* DP taps */}
      {on("flow-sensor") && (
        <g opacity="0.65">
          <line x1="142" y1={TOP} x2="142" y2={TOP-16} stroke={cc.Pressure} strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="156" y1={BOT} x2="156" y2={BOT+16} stroke={cc.Pressure} strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="142" y1={TOP-16} x2="74" y2={TOP-16} stroke={cc.Pressure} strokeWidth="1" strokeDasharray="3 2" />
          <line x1="156" y1={BOT+16} x2="74" y2={BOT+16} stroke={cc.Pressure} strokeWidth="1" strokeDasharray="3 2" />
        </g>
      )}

      {/* Discharge duct */}
      {!hasReheat ? (
        <rect x="348" y={TOP+2} width="130" height={DH*2-4} rx="2"
          fill={T.panel} stroke={T.border2} strokeWidth="1.5" />
      ) : (
        <>
          <rect x="348" y={TOP+2} width="68" height={DH*2-4} rx="2"
            fill={T.panel} stroke={T.border2} strokeWidth="1.5" />
          <rect x="416" y={TOP-4} width="58" height={DH*2+8} rx="2"
            fill={onReheatActuator ? "#F0FDFA" : T.panel}
            stroke={onReheatActuator ? cc.Actuators : T.border2}
            strokeWidth={onReheatActuator ? 2 : 1.5} />
          {[0,1,2,3].map(i=>(
            <path key={i} d={`M ${422+i*11} ${TOP+2} Q ${427+i*11} ${DY} ${422+i*11} ${BOT-2}`}
              fill="none" stroke={onReheatActuator ? cc.Actuators+"bb" : T.dim} strokeWidth="1.8" />
          ))}
          <text x="445" y={BOT+20} textAnchor="middle" fontSize="7"
            fill={onReheatActuator ? cc.Actuators : T.dim} fontFamily={T.mono}>HW COIL</text>
          <rect x="474" y={TOP+2} width="72" height={DH*2-4} rx="2"
            fill={T.panel} stroke={T.border2} strokeWidth="1.5" />
        </>
      )}

      <text x={hasReheat ? 382 : 413} y={DY-2} textAnchor="middle" fontSize="8" fill={T.muted} fontFamily={T.mono}>DISCHARGE</text>
      <text x={hasReheat ? 382 : 413} y={DY+10} textAnchor="middle" fontSize="7" fill={T.dim} fontFamily={T.mono}>to zone</text>
      <line x1={hasReheat ? 547 : 478} y1={DY} x2={hasReheat ? 568 : 500} y2={DY}
        stroke={T.dim} strokeWidth="1" markerEnd="url(#arr)" />

      {/* Zone box */}
      <rect x={hasReheat ? 568 : 500} y={TOP-4} width="68" height={DH*2+8} rx="3"
        fill={T.panel} stroke={T.border2} strokeWidth="1.5" strokeDasharray="5 3" />
      <text x={hasReheat ? 602 : 534} y={DY-2} textAnchor="middle" fontSize="9"
        fill={T.muted} fontFamily={T.mono}>ZONE</text>
      <text x={hasReheat ? 602 : 534} y={DY+11} textAnchor="middle" fontSize="8"
        fill={T.dim} fontFamily={T.mono}>SPACE</text>

      {/* DDC box */}
      <g style={{ cursor:"pointer" }} onClick={() => onToggle("vav-ctrl")}>
        <rect x="256" y="36" width="88" height="36" rx="4"
          fill={on("vav-ctrl") ? T.blueFaint : T.panel}
          stroke={on("vav-ctrl") ? T.blue : T.border2}
          strokeWidth={on("vav-ctrl") ? 2 : 1.5} />
        <text x="300" y="52" textAnchor="middle" fontSize="10"
          fill={on("vav-ctrl") ? T.blue : T.muted} fontFamily={T.mono} fontWeight="700">DDC</text>
        <text x="300" y="65" textAnchor="middle" fontSize="7.5"
          fill={on("vav-ctrl") ? T.blueL : T.dim} fontFamily={T.mono}>CONTROLLER</text>
        {on("vav-ctrl") && (
          <line x1="300" y1="72" x2="300" y2={TOP}
            stroke={T.blue} strokeWidth="1.5" strokeDasharray="5 3" opacity="0.5" />
        )}
      </g>

      {on("zn-temp") && !on("zn-co2") && (
        <line x1="490" y1="68" x2={hasReheat ? 590 : 520} y2={TOP}
          stroke={cc.Temperature} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
      )}
      {on("zn-co2") && (
        <line x1="570" y1="68" x2={hasReheat ? 590 : 520} y2={TOP}
          stroke={cc["Air Quality"]} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
      )}

      {ACTIVE_VAV_COMPS.filter(comp => comp.pos && comp.anc).map(comp => {
        const isOn = on(comp.id);
        const color = CAT_COLOR[comp.cat] || T.steel;
        const px = comp.pos.x, py = comp.pos.y;
        return (
          <g key={comp.id} style={{ cursor:"pointer" }}
            onClick={() => onToggle(comp.id)}
            onMouseEnter={() => setHov(comp.id)}
            onMouseLeave={() => setHov(null)}>
            {isOn && (
              <line x1={px} y1={py+16} x2={comp.anc.x} y2={comp.anc.y}
                stroke={color} strokeWidth="1.5" strokeDasharray="5 3" opacity="0.45" />
            )}
            {hov === comp.id && !isOn && (
              <circle cx={px} cy={py} r="20" fill="none" stroke={color}
                strokeWidth="1" opacity="0.35" strokeDasharray="3 2" />
            )}
            <circle cx={px} cy={py} r="16"
              fill={isOn ? color+"18" : T.panel}
              stroke={isOn ? color : T.border2}
              strokeWidth={isOn ? 2 : 1.5} />
            <text x={px} y={py} textAnchor="middle" dominantBaseline="middle"
              fontSize={comp.sym.length>3?6:comp.sym.length>2?7:9}
              fill={isOn ? color : T.dim}
              fontFamily={T.mono} fontWeight="700">{comp.sym}</text>
            <text x={px} y={py+26} textAnchor="middle" fontSize="8.5"
              fill={isOn ? color : T.dim} fontFamily={T.mono}
              fontWeight={isOn ? "700" : "400"}>
              {comp.name.length>14 ? comp.name.slice(0,13)+"…" : comp.name}
            </text>
          </g>
        );
      })}

      <text x="10" y="370" fontSize="7.5" fill={T.faint} fontFamily={T.mono}>
        VAV · Single Duct · Click symbols to toggle
      </text>
    </svg>
  );
}

function VAVConfigSelector({ initialCfg, onSelect }) {
  const [cfg, setCfg] = useState(() => normalizeCfg(initialCfg));
  const applyTemplate = templateId => {
    if (!templateId) return;
    setCfg(prev => normalizeCfg(applyVavStarterTemplate(prev, templateId)));
  };

  const section = (title, key, options) => (
    <div style={{ background:T.surface, border:"1px solid "+T.border, borderRadius:10, padding:12 }}>
      <div style={{ fontSize:10, letterSpacing:1.3, textTransform:"uppercase", color:T.muted, fontFamily:T.mono, marginBottom:7 }}>
        {title}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {options.map(opt => {
          const active = cfg[key] === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setCfg(prev => ({ ...prev, [key]: opt.id }))}
              style={{
                textAlign:"left",
                padding:"7px 10px",
                borderRadius:6,
                border:"1px solid "+(active ? T.blue : T.border2),
                background:active ? T.blueFaint : "transparent",
                color:active ? T.blue : T.muted,
                fontSize:12,
                fontFamily:T.mono,
                cursor:"pointer",
                fontWeight:active ? 700 : 500,
              }}>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:980, margin:"0 auto", padding:"28px 24px" }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:24, fontWeight:800, color:T.text, marginBottom:4 }}>Configure VAV</div>
        <div style={{ fontSize:13, color:T.muted }}>Select core VAV options before opening the editor.</div>
      </div>

      <div style={{ marginBottom:12, background:T.surface, border:"1px solid "+T.border, borderRadius:10, padding:12, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <div style={{ fontSize:10, letterSpacing:1.3, textTransform:"uppercase", color:T.muted, fontFamily:T.mono }}>
          Starter Template
        </div>
        <select
          value=""
          onChange={event => applyTemplate(event.target.value)}
          style={{
            padding:"7px 10px",
            borderRadius:6,
            border:"1px solid "+T.border2,
            background:T.bg,
            color:T.text,
            fontSize:12,
            fontFamily:T.mono,
            outline:"none",
          }}
        >
          {VAV_TEMPLATE_OPTIONS.map(option => (
            <option key={option.id || "custom"} value={option.id}>{option.label}</option>
          ))}
        </select>
        <span style={{ fontSize:12, color:T.muted }}>
          Applies cfg presets only. Component defaults still come from VAV rules.
        </span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {section("Duct Type", "ductType", VAV_DUCT_TYPES)}
        {section("Heating", "heatType", VAV_HEAT_TYPES)}
        {section("Fan Type", "fanType", VAV_FAN_TYPES)}
        {section("Actuator Type", "actuatorType", VAV_ACTUATOR_TYPES)}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
        {section("Power Source", "powerMode", [
          { id:"built-in", label:"Built-in XFMR" },
          { id:"shared-xfmr", label:"Shared XFMR" },
          { id:"power-trunk", label:"24V Power Trunk" },
        ])}
        {section("Comm Wiring", "commMode", [
          { id:"legacy-223", label:"Legacy 22/3 Shielded" },
          { id:"cat6", label:"CAT6 + RJ45 Terms" },
        ])}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
        {section("Radiant", "radiant", VAV_RADIANT_TYPES)}
        {section("Flow/Velocity", "flowIntegration", [
          { id:"integrated", label:"Integrated" },
          { id:"field", label:"Field Installed" },
        ])}
      </div>

      <div style={{ marginTop:12, background:T.surface, border:"1px solid "+T.border, borderRadius:10, padding:12 }}>
        <div style={{ fontSize:10, letterSpacing:1.3, textTransform:"uppercase", color:T.muted, fontFamily:T.mono, marginBottom:7 }}>
          Run Length
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <input
            type="number"
            min="0"
            value={cfg.commRunFt}
            onChange={e => setCfg(prev => ({ ...prev, commRunFt: Math.max(0, parseFloat(e.target.value) || 0) }))}
            style={{
              width:120,
              padding:"7px 10px",
              borderRadius:6,
              border:"1px solid "+T.border2,
              background:"transparent",
              color:T.text,
              fontSize:12,
              fontFamily:T.mono,
              outline:"none",
            }}
          />
          <span style={{ fontSize:12, color:T.muted, fontFamily:T.mono }}>ft</span>
        </div>
      </div>

      <div style={{ marginTop:12, background:T.surface, border:"1px solid "+T.border, borderRadius:10, padding:10, height:220 }}>
        <TemplateSvgDiagram
          svgPath="/diagrams/vav-template.svg"
          visibility={buildVavTemplateVisibility(cfg, buildInitialVavSelection(cfg))}
          fallback={
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:T.muted, fontFamily:T.mono }}>
              VAV template preview unavailable
            </div>
          }
        />
      </div>

      <div style={{ marginTop:16, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", background:T.blueFaint, borderRadius:8, border:"1px solid "+T.blueMid }}>
        <span style={{ fontSize:12, color:T.blue, fontFamily:T.mono }}>
          {labelFor(VAV_DUCT_TYPES, cfg.ductType)} | {labelFor(VAV_HEAT_TYPES, cfg.heatType)} | {labelFor(VAV_FAN_TYPES, cfg.fanType)} | {labelFor(VAV_ACTUATOR_TYPES, cfg.actuatorType)}
        </span>
        <button onClick={() => onSelect(cfg)} style={{ padding:"9px 14px", border:"none", borderRadius:6, background:T.blue, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:T.mono }}>
          Start VAV Editor
        </button>
      </div>
    </div>
  );
}


export default function VAVPage({ onBack = null } = {}) {
  const { activeEstimate, editingItem, subPage } = useEstimate();
  const isEditing = !!editingItem && editingItem.type === "vav";
  const quoteDefault = activeEstimate?.settings?.defaultInstallType ?? "EMT";

  const [cfg, setCfg] = useState(() => isEditing ? normalizeCfg(editingItem.cfg) : null);
  const [selected, setSel] = useState(() =>
    {
      if (!isEditing) return [];
      const next = (editingItem.selected || []).filter(entry => !EXCLUDED_VAV_IDS.has(entry.id));
      const editCfg = normalizeCfg(editingItem.cfg);
      const needsController = editCfg.damperIntegration === "integrated" || editCfg.flowIntegration === "integrated";
      if (needsController && !next.some(entry => entry.id === "vav-ctrl")) {
        next.push({ id: "vav-ctrl", qty: 1 });
      }
      return next;
    }
  );
  const [custom, setCustom] = useState(() => isEditing ? (editingItem.custom || []) : []);
  const [installType, setIT] = useState(() => isEditing ? editingItem.installType : quoteDefault);
  const [powerMode, setPowerMode] = useState(() => isEditing ? (editingItem.cfg?.powerMode || DEFAULT_POWER_MODE) : DEFAULT_POWER_MODE);
  const [commMode, setCommMode] = useState(() => isEditing ? (editingItem.cfg?.commMode || DEFAULT_COMM_MODE) : DEFAULT_COMM_MODE);
  const [damperIntegration, setDamperIntegration] = useState(() => isEditing ? normalizeCfg(editingItem.cfg).damperIntegration : DEFAULT_INTEGRATION_MODE);
  const [flowIntegration, setFlowIntegration] = useState(() => isEditing ? (editingItem.cfg?.flowIntegration || DEFAULT_INTEGRATION_MODE) : DEFAULT_INTEGRATION_MODE);
  const [commRunFt, setCRF] = useState(() => {
    const saved = Number(editingItem?.cfg?.commRunFt);
    return Number.isFinite(saved) && saved >= 0 ? saved : LEGACY_BASE_COMM_FT;
  });
  const [qty, setQty] = useState(() => isEditing ? editingItem.qty : 1);
  const [tag, setTag] = useState(() => isEditing ? editingItem.tag : "VAV");
  const [loc, setLoc] = useState(() => isEditing ? editingItem.location : "Typical");
  const handleBack = () => {
    if (typeof onBack === "function") {
      onBack();
      return;
    }
    setSubPage(null);
  };
  const [filterCat, setFC] = useState("All");
  const [expanded, setExp] = useState(null);
  const [showModal, setModal] = useState(false);
  const [blockedDefaultIds, setBlockedDefaultIds] = useState([]);
  const [syncDefaults, setSyncDefaults] = useState(() => !isEditing);

  const applyTemplate = templateId => {
    if (!templateId) return;
    handleSelectConfig(applyVavStarterTemplate(cfg, templateId));
  };

  const handleSelectConfig = nextCfg => {
    const normalized = normalizeCfg(nextCfg);
    setCfg(normalized);
    setBlockedDefaultIds([]);
    setSyncDefaults(true);
    setPowerMode(normalized.powerMode || DEFAULT_POWER_MODE);
    setCommMode(normalized.commMode || DEFAULT_COMM_MODE);
    setDamperIntegration(normalized.actuatorType === "integrated" ? "integrated" : "field");
    setFlowIntegration(normalized.flowIntegration || DEFAULT_INTEGRATION_MODE);
    setCRF(Number(normalized.commRunFt) || LEGACY_BASE_COMM_FT);
    if (!isEditing || !editingItem?.cfg) {
      setSel(buildInitialVavSelection(normalized));
      setCustom([]);
    }
  };

  useEffect(() => {
    if (!cfg || !syncDefaults) return;
    setSel(prev => reconcileVavSelected(prev, cfg, {
      blockedIds: blockedDefaultIds,
      components: ACTIVE_VAV_COMPS,
    }));
  }, [blockedDefaultIds, cfg, syncDefaults]);

  useEffect(() => {
    const draft = subPage?.type === "vav" ? subPage?.conduitFillDraft : null;
    if (!draft) return;
    const nextCfg = draft.cfg ? normalizeCfg(draft.cfg) : null;
    if (nextCfg) {
      setCfg(nextCfg);
      setPowerMode(nextCfg.powerMode || DEFAULT_POWER_MODE);
      setCommMode(nextCfg.commMode || DEFAULT_COMM_MODE);
      setDamperIntegration(nextCfg.damperIntegration || DEFAULT_INTEGRATION_MODE);
      setFlowIntegration(nextCfg.flowIntegration || DEFAULT_INTEGRATION_MODE);
      setCRF(Number(nextCfg.commRunFt) || LEGACY_BASE_COMM_FT);
    }
    if (draft.selected) setSel(draft.selected);
    if (draft.custom) setCustom(draft.custom);
    if (draft.installType) setIT(draft.installType);
    if (Number.isFinite(Number(draft.qty))) setQty(Math.max(1, Number(draft.qty) || 1));
    if (typeof draft.tag === "string") setTag(draft.tag);
    if (typeof draft.location === "string") setLoc(draft.location);
    setBlockedDefaultIds(draft.blockedDefaultIds || []);
    setSyncDefaults(Boolean(draft.syncDefaults));
  }, [subPage]);

  const visibleComponents = useMemo(
    () => getVisibleVavComponents(cfg, ACTIVE_VAV_COMPS),
    [cfg]
  );
  const activeDamperActuatorId = cfg?.actuatorType === "incremental" ? DAMPR_INCR_COMP_ID : DAMPR_COMP_ID;
  const hasDamperActuator = cfg?.actuatorType === "integrated" || [...ACTUATOR_MEMBER_IDS].some(id => selected.some(s => s.id === id));

  if (!cfg) {
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 52px)", overflow:"hidden" }}>
        <div style={{ flex:1, overflowY:"auto" }}>
          <VAVConfigSelector initialCfg={isEditing ? editingItem.cfg : null} onSelect={handleSelectConfig} />
        </div>
      </div>
    );
  }

  const isOn      = id => selected.some(s => s.id === id);
  const isIntegrated = id =>
    (id === DAMPR_COMP_ID && damperIntegration === "integrated") ||
    (id === FLOW_COMP_ID && flowIntegration === "integrated");
  const requiresController = damperIntegration === "integrated" || flowIntegration === "integrated";
  const isShown = id => isOn(id) || isIntegrated(id);
  const getQty    = id => selected.find(s => s.id === id)?.qty ?? 1;
  const setCompQty = (id, qty) => setSel(s => s.map(x => x.id===id ? {...x, qty:Math.max(1,qty)} : x));
  const setDamperMode = mode => {
    setDamperIntegration(mode);
    setSel(prev => {
      let next = mode === "integrated"
        ? prev.filter(x => x.id !== DAMPR_COMP_ID)
        : (prev.some(x => x.id === DAMPR_COMP_ID) ? prev : [...prev, { id: DAMPR_COMP_ID, qty: 1 }]);
      if (mode === "integrated" && !next.some(x => x.id === "vav-ctrl")) {
        next = [...next, { id: "vav-ctrl", qty: 1 }];
      }
      return next;
    });
  };
  const setFlowMode = mode => {
    setFlowIntegration(mode);
    setSel(prev => {
      let next = mode === "integrated"
        ? prev.filter(x => x.id !== FLOW_COMP_ID)
        : (prev.some(x => x.id === FLOW_COMP_ID) ? prev : [...prev, { id: FLOW_COMP_ID, qty: 1 }]);
      if (mode === "integrated" && !next.some(x => x.id === "vav-ctrl")) {
        next = [...next, { id: "vav-ctrl", qty: 1 }];
      }
      return next;
    });
  };
  const toggle = id => {
    if (EXCLUDED_VAV_IDS.has(id)) return;
    if (isIntegrated(id)) return;
    if (id === "vav-ctrl" && requiresController) return;
    if (id==="zn-co2" && !isOn("zn-co2")) {
      setBlockedDefaultIds(prev => prev.filter(entry => entry !== "zn-temp"));
      return setSel(s=>[...s.filter(x=>x.id!=="zn-temp"),{id:"zn-co2",qty:1}]);
    }
    if (id==="zn-temp" && !isOn("zn-temp")) {
      setBlockedDefaultIds(prev => prev.filter(entry => entry !== "zn-co2"));
      return setSel(s=>[...s.filter(x=>x.id!=="zn-co2"),{id:"zn-temp",qty:1}]);
    }
    const isDefaulted = visibleComponents.some(comp => comp.id === id && comp.defaultWhen?.(cfg));
    if (isOn(id)) {
      if (isDefaulted) {
        setBlockedDefaultIds(prev => (prev.includes(id) ? prev : [...prev, id]));
      }
      return setSel(s => toggleVavComponentSelection(s, id, { components: ACTIVE_VAV_COMPS }));
    }
    setBlockedDefaultIds(prev => prev.filter(entry => entry !== id));
    setSel(s => toggleVavComponentSelection(s, id, { components: ACTIVE_VAV_COMPS }));
  };

  const getAsmCost = (comp) => {
    const aid = String(installType==="EMT" ? comp.emtAID : comp.plnAID);
    if (!aid || aid==="undefined") return { mtl:comp.unitMtl||0, lbr:comp.unitLbr||0, items:[] };
    const result = calcAssembly(aid);
    const asm = ASSEMBLIES[aid];
    return { ...result, items: asm?.items||[] };
  };

  const divFor = per => per==='C'?100:per==='M'?1000:1;
  const scaleCost = (cost, factor = 1) => ({
    mtl: cost.mtl * factor,
    lbr: cost.lbr * factor,
  });

  const hasReheat = cfg.heatType !== "cooling-only";
  const commScale = Number(commRunFt) || 0;
  const legacyCommAID = LEGACY_COMM_AID_BY_INSTALL[installType] || LEGACY_COMM_AID_BY_INSTALL.Plenum;
  const cat6AID = MODERN_CAT6_AID_BY_INSTALL[installType] || MODERN_CAT6_AID_BY_INSTALL.Plenum;
  const commCost = commMode === "cat6"
    ? {
        mtl: (calcAssembly(cat6AID).mtl * commScale) + (calcAssembly(RJ45_TERM_AID).mtl * 2),
        lbr: (calcAssembly(cat6AID).lbr * commScale) + (calcAssembly(RJ45_TERM_AID).lbr * 2),
      }
    : scaleCost(calcAssembly(legacyCommAID), commScale);
  const powerCost = powerMode === "shared-xfmr"
    ? scaleCost(calcAssembly(LEGACY_SHARED_XFMR_AID), LEGACY_SHARED_QTY)
    : powerMode === "power-trunk"
      ? calcAssembly(LEGACY_POWER_TRUNK_AID_BY_INSTALL[installType] || LEGACY_POWER_TRUNK_AID_BY_INSTALL.Plenum)
      : { mtl: 0, lbr: 0 };
  const validationCost = scaleCost(calcAssembly(LEGACY_VALIDATION_AID), LEGACY_VALIDATION_QTY);
  const displaySelected = [
    ...selected,
    ...(damperIntegration === "integrated" && !isOn(DAMPR_COMP_ID) ? [{ id: DAMPR_COMP_ID, qty: 1 }] : []),
    ...(flowIntegration === "integrated" && !isOn(FLOW_COMP_ID) ? [{ id: FLOW_COMP_ID, qty: 1 }] : []),
  ];
  const diagramSelectedIds = displaySelected.map(entry => entry.id === DAMPR_INCR_COMP_ID ? DAMPR_COMP_ID : entry.id);
  const selComps  = ACTIVE_VAV_COMPS.filter(c=>isOn(c.id));
  const custMtl   = custom.reduce((a,c)=>a+(c.unitMtl+c.extraMtl),0);
  const custLbr   = custom.reduce((a,c)=>a+(c.unitLbr+c.extraLbr),0);
  const unitMtl   = selComps.reduce((a,c)=>a+getAsmCost(c).mtl*getQty(c.id),0) + custMtl + commCost.mtl + powerCost.mtl + validationCost.mtl;
  const unitLbr   = selComps.reduce((a,c)=>a+getAsmCost(c).lbr*getQty(c.id),0) + custLbr + commCost.lbr + powerCost.lbr + validationCost.lbr;

  const cats = ["All",...Object.keys(CAT_COLOR)];
  const visible = filterCat==="All" ? visibleComponents : visibleComponents.filter(c=>c.cat===filterCat);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 52px)", overflow:"hidden" }}>
      {showModal && (
        <AssemblyPickerModal
          title="Add VAV Assembly"
          installType={installType}
          options={toAssemblyOptions(visibleComponents)}
          onAdd={c=>{setCustom(cs=>[...cs,c]);setModal(false);}}
          onClose={()=>setModal(false)}
        />
      )}

      <div style={{ padding:"10px 20px", borderBottom:"1px solid "+T.border,
        display:"flex", alignItems:"center", gap:12, background:T.surface, flexShrink:0 }}>
        <div style={{ padding:"3px 10px", background:T.blueFaint, border:"1px solid "+T.blueMid, borderRadius:4 }}>
          <span style={{ fontSize:11, color:T.blue, fontFamily:T.mono, fontWeight:700, letterSpacing:1 }}>VAV</span>
        </div>
        <input value={tag} onChange={e=>setTag(e.target.value)}
          style={{ background:T.blueFaint, border:"1px solid "+T.blueMid, borderRadius:4,
            color:T.blue, fontFamily:T.mono, fontSize:13, padding:"4px 8px", width:80, outline:"none", fontWeight:700 }} />
        {qty>1 && <span style={{ fontSize:13, color:T.blue, fontFamily:T.mono }}>× {qty} typical</span>}
        <input value={loc} onChange={e=>setLoc(e.target.value)}
          style={{ background:T.panel, border:"1px solid "+T.border, borderRadius:4,
            color:T.steel, fontFamily:T.mono, fontSize:12, padding:"4px 8px", width:150, outline:"none" }} />
        <span style={{ fontSize:11, color:T.blueL, background:T.blueFaint, padding:"2px 8px", borderRadius:10, border:"1px solid "+T.blueMid, fontFamily:T.mono }}>
          {labelFor(VAV_DUCT_TYPES, cfg.ductType)} | {labelFor(VAV_HEAT_TYPES, cfg.heatType)} | {labelFor(VAV_ACTUATOR_TYPES, cfg.actuatorType)}
        </span>
        {/*
          Persist pricing options in cfg so edit mode rehydrates the same costing strategy.
        */}
        <AddToEstimateBtn type="vav" tag={tag} location={loc}
          cfg={{ ...cfg, heatType: cfg.heatType, actuatorType: cfg.actuatorType, powerMode, commMode, commRunFt, damperIntegration, flowIntegration }} selected={selected} custom={custom}
          qty={qty} installType={installType} />
        <button
          type="button"
          onClick={handleBack}
          title="Return to this estimate without saving changes"
          style={{ padding:"4px 10px", border:"1px solid "+T.border2, borderRadius:4, background:"none", color:T.muted, cursor:"pointer", fontSize:11, fontFamily:T.mono, whiteSpace:"nowrap" }}>
          ← Back to Estimate
        </button>
        <div style={{ flex:1 }} />
        <div style={{ display:"flex", gap:14, padding:"5px 14px", background:T.blueFaint,
          borderRadius:6, border:"1px solid "+T.blueMid }}>
          <span style={{ fontFamily:T.mono, fontSize:12, color:T.muted }}>
            Unit <span style={{ color:T.blue, fontWeight:700 }}>{fmt$(unitMtl)}</span>
          </span>
          {qty>1 && <span style={{ fontFamily:T.mono, fontSize:12, color:T.muted }}>
            Total <span style={{ color:T.blue, fontWeight:700 }}>{fmt$(unitMtl*qty)}</span>
          </span>}
        </div>
        <button
          onClick={() => {
            setCfg(null);
            setSel([]);
            setCustom([]);
            setBlockedDefaultIds([]);
            setSyncDefaults(false);
          }}
          style={{ padding:"5px 12px", border:"1px solid "+T.border2, borderRadius:5, background:"none", color:T.muted, cursor:"pointer", fontSize:11, fontFamily:T.mono }}>
          Reconfigure
        </button>
      </div>

      <SidebarLayout pageKey="vav" mobileBadge={fmt$(unitMtl)} main={(
        <div style={{ flex:1, padding:"16px 20px", display:"flex", flexDirection:"column", overflow:"hidden", height:"100%" }}>
          <div style={{ flex:1, background:T.surface, borderRadius:8, border:"1px solid "+T.border,
            overflow:"hidden", minHeight:0 }}>
            <SchematicTabs>{{
              flow: <TemplateSvgDiagram
                svgPath="/diagrams/vav-template.svg"
                visibility={buildVavTemplateVisibility(cfg, displaySelected)}
                fallback={<VAVSchematic selected={displaySelected} onToggle={toggle} hasReheat={hasReheat} damperToggleId={activeDamperActuatorId} hasDamperActuator={hasDamperActuator} />}
              />,
              elec: <DiagramViewer
                svgPath="/diagrams/vav-elec.svg"
                selectedIds={diagramSelectedIds}
                allIds={ACTIVE_VAV_COMPS.map(c=>c.id)}
                fallback={<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}><span style={{color:T.muted,fontFamily:T.mono,fontSize:13}}>Drop vav-elec.svg into public/diagrams/</span></div>}
              />,
              points: <PointsList comps={ACTIVE_VAV_COMPS} selected={displaySelected} installType={installType} tag={tag}/>
            }}</SchematicTabs>
          </div>
          <div style={{ marginTop:10, padding:"9px 14px", background:T.blueFaint,
            border:"1px dashed "+T.blueL, borderRadius:5, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:15, color:T.blueL }}>⊕</span>
            <div style={{ flex:1, fontSize:12, color:T.blue, fontWeight:500 }}>
              Conduit Fill Calculator
              <span style={{ fontWeight:400, color:T.blueL, marginLeft:8, fontSize:11 }}>
                — home run conduit count from cable ODs
              </span>
            </div>
            <button
              onClick={() => {
                const bundle = buildCableBundleFromPoints(
                  visibleComponents.filter(c => isShown(c.id)),
                  selected
                );
                if (!bundle.length) return;
                sessionStorage.setItem(CONDUIT_FILL_BUNDLE_KEY, JSON.stringify(bundle));
                sessionStorage.setItem(CONDUIT_FILL_CONTEXT_KEY, JSON.stringify({
                  returnSubPage: editingItem ? { type: "vav", editItemId: editingItem.id } : { type: "vav" },
                  homerunId: findHomeRunComponentId(ACTIVE_VAV_COMPS),
                  draft: {
                    cfg,
                    selected,
                    custom,
                    installType,
                    qty,
                    tag,
                    location: loc,
                    blockedDefaultIds,
                    syncDefaults,
                  },
                }));
                window.dispatchEvent(new CustomEvent("open-conduit-fill"));
              }}
              style={{ padding:"4px 10px", border:"1px solid "+T.blueL, borderRadius:4,
              background:"none", color:T.blue, fontSize:11, cursor:"pointer", fontFamily:T.mono }}>
              Configure →
            </button>
          </div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginTop:8 }}>
            {visibleComponents.filter(c=>isShown(c.id)).map(comp => {
              const color = CAT_COLOR[comp.cat]||T.steel;
              const suffix = isIntegrated(comp.id) ? " (Integrated)" : "";
              return (
                <div key={comp.id} onClick={()=>toggle(comp.id)} style={{
                  display:"flex", alignItems:"center", gap:4, padding:"2px 8px 2px 5px",
                  background:color+"10", border:"1px solid "+color+"28",
                  borderRadius:12, cursor:"pointer" }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:color }} />
                  <span style={{ fontSize:10, color:T.muted }}>{comp.name}{suffix}</span>
                </div>
              );
            })}
          </div>
        </div>
      )} sidebar={(
      <>
          <div style={{ padding:"12px 14px 10px", borderBottom:"1px solid "+T.border }}>
            <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono, letterSpacing:2,
              textTransform:"uppercase", marginBottom:3 }}>System</div>
            <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:8 }}>VAV Terminal Unit</div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8,
              padding:"6px 10px", background:T.blueFaint, borderRadius:5, border:"1px solid "+T.blueMid }}>
              <span style={{ fontSize:11, color:T.blue, fontFamily:T.mono, letterSpacing:1, textTransform:"uppercase" }}>Typical ×</span>
              <input type="number" min="1" value={qty} onChange={e=>setQty(Math.max(1,parseInt(e.target.value)||1))}
                style={{ width:52, padding:"4px 6px", border:"1px solid "+T.blueMid, borderRadius:4,
                  fontSize:14, fontFamily:T.mono, background:T.surface, color:T.blue,
                  fontWeight:700, outline:"none", textAlign:"center" }} />
              <span style={{ fontSize:11, color:T.muted }}>{qty===1?"unit":"units"}</span>
            </div>
            <div style={{ display:"flex", gap:6, marginBottom:10 }}>
              {["Plenum","EMT"].map(tt=>(
                <button key={tt} onClick={()=>setIT(tt)} style={{
                  flex:1, padding:"4px 0", borderRadius:4,
                  border:"1px solid "+(installType===tt?T.blue:T.border2),
                  background:installType===tt?T.blueFaint:"transparent",
                  color:installType===tt?T.blue:T.muted,
                  fontSize:11, fontFamily:T.mono, cursor:"pointer", fontWeight:installType===tt?700:400 }}>
                  {tt}
                </button>
              ))}
            </div>
            {false && (<>
            <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono, letterSpacing:1.5,
              textTransform:"uppercase", marginBottom:5 }}>Power Source</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:5, marginBottom:10 }}>
              <option value="">— None —</option>
              {[{ id:"built-in", label:"Built-in XFMR" }, { id:"shared-xfmr", label:"Shared XFMR" }, { id:"power-trunk", label:"24V Power Trunk" }].map(opt => {
                const active = powerMode === opt.id;
                return (
                  <button key={opt.id} onClick={()=>setPowerMode(opt.id)} style={{
                    textAlign:"left",
                    padding:"5px 8px",
                    borderRadius:4,
                    border:"1px solid "+(active ? T.blue : T.border2),
                    background:active ? T.blueFaint : "transparent",
                    color:active ? T.blue : T.muted,
                    fontSize:11,
                    fontFamily:T.mono,
                    cursor:"pointer",
                    fontWeight:active ? 700 : 500,
                  }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono, letterSpacing:1.5,
              textTransform:"uppercase", marginBottom:5 }}>Controller Integration</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:5, marginBottom:10 }}>
              <button onClick={()=>setDamperMode("integrated")} style={{
                textAlign:"left", padding:"5px 8px", borderRadius:4,
                border:"1px solid "+(damperIntegration === "integrated" ? T.blue : T.border2),
                background:damperIntegration === "integrated" ? T.blueFaint : "transparent",
                color:damperIntegration === "integrated" ? T.blue : T.muted,
                fontSize:11, fontFamily:T.mono, cursor:"pointer",
                fontWeight:damperIntegration === "integrated" ? 700 : 500 }}>
                Damper Actuator: Integrated
              </button>
              <button onClick={()=>setDamperMode("field")} style={{
                textAlign:"left", padding:"5px 8px", borderRadius:4,
                border:"1px solid "+(damperIntegration === "field" ? T.blue : T.border2),
                background:damperIntegration === "field" ? T.blueFaint : "transparent",
                color:damperIntegration === "field" ? T.blue : T.muted,
                fontSize:11, fontFamily:T.mono, cursor:"pointer",
                fontWeight:damperIntegration === "field" ? 700 : 500 }}>
                Damper Actuator: Field Installed
              </button>
              <button onClick={()=>setFlowMode("integrated")} style={{
                textAlign:"left", padding:"5px 8px", borderRadius:4,
                border:"1px solid "+(flowIntegration === "integrated" ? T.blue : T.border2),
                background:flowIntegration === "integrated" ? T.blueFaint : "transparent",
                color:flowIntegration === "integrated" ? T.blue : T.muted,
                fontSize:11, fontFamily:T.mono, cursor:"pointer",
                fontWeight:flowIntegration === "integrated" ? 700 : 500 }}>
                Flow/Velocity: Integrated
              </button>
              <button onClick={()=>setFlowMode("field")} style={{
                textAlign:"left", padding:"5px 8px", borderRadius:4,
                border:"1px solid "+(flowIntegration === "field" ? T.blue : T.border2),
                background:flowIntegration === "field" ? T.blueFaint : "transparent",
                color:flowIntegration === "field" ? T.blue : T.muted,
                fontSize:11, fontFamily:T.mono, cursor:"pointer",
                fontWeight:flowIntegration === "field" ? 700 : 500 }}>
                Flow/Velocity: Field Installed
              </button>
            </div>
            <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono, letterSpacing:1.5,
              textTransform:"uppercase", marginBottom:5 }}>Comm Wiring</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:5, marginBottom:6 }}>
              {[{ id:"legacy-223", label:"Legacy 22/3 Shielded" }, { id:"cat6", label:"CAT6 + RJ45 Terms" }].map(opt => {
                const active = commMode === opt.id;
                return (
                  <button key={opt.id} onClick={()=>setCommMode(opt.id)} style={{
                    textAlign:"left",
                    padding:"5px 8px",
                    borderRadius:4,
                    border:"1px solid "+(active ? T.blue : T.border2),
                    background:active ? T.blueFaint : "transparent",
                    color:active ? T.blue : T.muted,
                    fontSize:11,
                    fontFamily:T.mono,
                    cursor:"pointer",
                    fontWeight:active ? 700 : 500,
                  }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize:10, color:T.dim, fontFamily:T.mono, marginBottom:5 }}>
              {commMode === "cat6"
                ? `Assembly ${installType==="EMT" ? "852" : "854"} + 2x RJ45 terminations`
                : `Assembly ${installType==="EMT" ? "60142" : "219"} scaled by footage`}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontSize:10, color:T.muted, fontFamily:T.mono }}>Run length</span>
              <input type="number" value={commRunFt} onChange={e=>setCRF(parseFloat(e.target.value)||0)}
                style={{ flex:1, padding:"4px 8px", border:"1px solid "+T.border2, borderRadius:4,
                  fontSize:12, fontFamily:T.mono, background:T.bg, color:T.text, outline:"none" }} />
              <span style={{ fontSize:10, color:T.muted, fontFamily:T.mono }}>ft</span>
            </div>
            <div style={{ marginTop:6, fontSize:10, color:T.dim, fontFamily:T.mono }}>
              Run length defaults to {LEGACY_BASE_COMM_FT} ft.
            </div>
            </>)}
            <div style={{ fontSize:10, color:T.dim, fontFamily:T.mono }}>
              Use Reconfigure to change power, wiring, and integration settings.
            </div>
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono, letterSpacing:1.5, textTransform:"uppercase", marginBottom:5 }}>
                Starter Template
              </div>
              <select
                value=""
                onChange={event => applyTemplate(event.target.value)}
                style={{
                  width:"100%",
                  padding:"6px 8px",
                  border:"1px solid "+T.border2,
                  borderRadius:4,
                  background:T.bg,
                  color:T.text,
                  fontSize:12,
                  fontFamily:T.mono,
                  outline:"none",
                }}
              >
                {VAV_TEMPLATE_OPTIONS.map(option => (
                  <option key={option.id || "custom"} value={option.id}>{option.label}</option>
                ))}
              </select>
              <div style={{ marginTop:5, fontSize:10, color:T.dim, fontFamily:T.mono }}>
                Applies cfg presets only and lets rule-driven defaults rebuild selections.
              </div>
            </div>
          </div>

          <div style={{ padding:"6px 10px", borderBottom:"1px solid "+T.border,
            display:"flex", gap:3, flexWrap:"wrap", alignItems:"center" }}>
            {cats.map(cat=>{
              const color = CAT_COLOR[cat]||T.steel;
              const active = filterCat===cat;
              return (
                <button key={cat} onClick={()=>setFC(cat)} style={{
                  padding:"2px 7px", borderRadius:10, fontSize:9.5, fontFamily:T.mono, cursor:"pointer",
                  border:"1px solid "+(active?color:T.border),
                  background:active?color+"14":"transparent",
                  color:active?color:T.muted }}>
                  {cat}
                </button>
              );
            })}
            <div style={{ marginLeft:"auto", display:"flex", gap:3 }}>
              <button onClick={()=>setSel(sel=>{const next=[...sel];for(const c of visible){if(!isIntegrated(c.id)&&!next.some(s=>s.id===c.id))next.push({id:c.id,qty:1});}return next;})} style={{ padding:"2px 7px", borderRadius:10, fontSize:9.5, fontFamily:T.mono, cursor:"pointer", border:"1px solid "+T.border, background:"transparent", color:T.muted }}>All</button>
              <button onClick={()=>setSel(sel=>sel.filter(s=>!visible.some(c=>c.id===s.id)||isIntegrated(s.id)))} style={{ padding:"2px 7px", borderRadius:10, fontSize:9.5, fontFamily:T.mono, cursor:"pointer", border:"1px solid "+T.border, background:"transparent", color:T.muted }}>None</button>
            </div>
          </div>

          <div style={{ flex:1, overflowY:"auto" }}>
            {visible.map(comp=>{
              const checked = isShown(comp.id);
              const lockedIntegrated = isIntegrated(comp.id);
              const isOn = checked;
              const compQty = selected.find(s => s.id === comp.id)?.qty ?? 1;
              const isExp = expanded===comp.id;
              const color = CAT_COLOR[comp.cat]||T.steel;
              const cost  = getAsmCost(comp);
              return (
                <div key={comp.id} style={{
                  borderBottom:"1px solid "+T.border,
                  borderLeft:"3px solid "+(checked?color:"transparent"),
                  background:checked?color+"08":T.surface }}>
                  <div style={{ padding:"8px 13px", cursor:"pointer", display:"flex", alignItems:"center", gap:7 }}
                    onClick={()=>toggle(comp.id)}>
                    <div style={{ width:14, height:14, borderRadius:3, flexShrink:0,
                      background:checked?color:"transparent",
                      border:"2px solid "+(checked?color:T.border2),
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {isOn && <span style={{ color:"#fff", fontSize:9, fontWeight:900, lineHeight:1 }}>✓</span>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, color:isOn?T.text:T.muted, fontWeight:isOn?600:400 }}>{comp.name}</div>
                      <div style={{ fontSize:10, color:isOn?color:T.dim, fontFamily:T.mono, marginTop:1 }}>
                        {lockedIntegrated ? `${comp.cat} · Integrated` : comp.cat}
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:11, color:isOn?T.text:T.muted, fontFamily:T.mono }}>
                        {lockedIntegrated ? fmt$(0) : fmt$(cost.mtl * compQty)}
                      </div>
                      <div style={{ fontSize:10, color:T.dim, fontFamily:T.mono }}>
                        {lockedIntegrated ? fmtHr(0) : fmtHr(cost.lbr * compQty)}
                      </div>
                    </div>
                    {isOn && !lockedIntegrated && (
                        <input type="number" min="1" value={compQty}
                          onClick={e=>e.stopPropagation()}
                          onChange={e=>setCompQty(comp.id, parseInt(e.target.value)||1)}
                          style={{ width:36, padding:"2px 4px", border:"1px solid "+T.blueMid,
                            borderRadius:3, fontSize:11, fontFamily:T.mono, background:T.blueFaint,
                            color:T.blue, fontWeight:700, outline:"none", textAlign:"center" }} />
                      )}
                    {isOn && !lockedIntegrated && (
                      <button onClick={e=>{ e.stopPropagation(); setExp(isExp?null:comp.id); }}
                        style={{ background:"none", border:"none", color:T.dim, cursor:"pointer",
                          fontSize:11, padding:"0 2px", lineHeight:1, marginLeft:2 }}>
                        {isExp?"▲":"▼"}
                      </button>
                    )}
                  </div>

                  {isOn && !lockedIntegrated && isExp && cost.items.length>0 && (
                    <div style={{ background:color+"06", borderTop:"1px solid "+color+"20", padding:"4px 8px 8px 8px" }}>
                      <div style={{ fontSize:9, color, fontFamily:T.mono, letterSpacing:1.5,
                        textTransform:"uppercase", marginBottom:4, paddingLeft:4 }}>Parts</div>
                      {cost.items.map((it,i)=>{
                        const itemMtl = it.qty * it.mtlUnit / divFor(it.mtlPer);
                        const itemHrs = it.qty * it.hrsUnit / divFor(it.hrsPer);
                        return (
                          <div key={i} style={{ display:"flex", alignItems:"baseline", gap:6,
                            padding:"2px 4px", borderRadius:3,
                            background:i%2===0?"transparent":T.faint }}>
                            <span style={{ fontSize:9, color:T.dim, fontFamily:T.mono, width:28, flexShrink:0 }}>
                              {it.qty}{it.mtlPer==='C'?'/C':it.mtlPer==='M'?'/M':''}
                            </span>
                            <span style={{ fontSize:10, color:T.muted, flex:1, minWidth:0,
                              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                              {UNIT_ITEMS[it.item]?.desc||it.item}
                            </span>
                            <span style={{ fontSize:10, color:T.steel, fontFamily:T.mono, flexShrink:0 }}>
                              {fmt$(itemMtl)} · {fmtHr(itemHrs)}
                            </span>
                          </div>
                        );
                      })}
                      <div style={{ display:"flex", justifyContent:"space-between",
                        marginTop:5, paddingTop:5, borderTop:"1px solid "+color+"30" }}>
                        <span style={{ fontSize:9, color:T.muted, fontFamily:T.mono }}>TOTAL</span>
                        <span style={{ fontSize:11, color, fontFamily:T.mono, fontWeight:700 }}>
                          {fmt$(cost.mtl)} · {fmtHr(cost.lbr)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {(filterCat==="All"||filterCat==="Custom") && custom.map(comp=>{
              const color = CAT_COLOR.Custom;
              return (
                <div key={comp.id} style={{ padding:"8px 13px", background:color+"08",
                  borderBottom:"1px solid "+T.border, borderLeft:"3px solid "+color }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <div style={{ width:14, height:14, borderRadius:3, background:color+"20",
                      border:"2px solid "+color, flexShrink:0,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ fontSize:9, color, fontWeight:900 }}>+</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:T.text,
                        display:"flex", alignItems:"center", gap:4 }}>
                        {comp.name}
                        <span style={{ fontSize:8, color, background:color+"14",
                          padding:"1px 4px", borderRadius:3, fontFamily:T.mono }}>CUSTOM</span>
                      </div>
                      <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono }}>{comp.category}</div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:11, fontFamily:T.mono }}>{fmt$(comp.unitMtl+comp.extraMtl)}</div>
                      <div style={{ fontSize:10, color:T.dim, fontFamily:T.mono }}>{fmtHr(comp.unitLbr+comp.extraLbr)}</div>
                    </div>
                    <button onClick={()=>setCustom(cs=>cs.filter(c=>c.id!==comp.id))}
                      style={{ background:"none", border:"none", color:T.dim, cursor:"pointer", fontSize:15, padding:"0 2px" }}>×</button>
                  </div>
                  {comp.notes && <div style={{ fontSize:10, color:T.muted, marginTop:3,
                    marginLeft:21, fontStyle:"italic" }}>{comp.notes}</div>}
                </div>
              );
            })}
            <div style={{ padding:"10px 13px" }}>
              <button onClick={()=>setModal(true)} style={{ width:"100%", padding:"7px",
                border:"1px dashed "+T.border2, borderRadius:5, background:"none",
                color:T.muted, cursor:"pointer", fontSize:11, fontFamily:T.mono,
                display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                <span style={{ fontSize:14, color:T.blue }}>+</span>Add custom component…
              </button>
            </div>
          </div>

          <div style={{ padding:"10px 13px", borderTop:"1px solid "+T.border, background:T.panel }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
              marginBottom:6, padding:"5px 8px", background:T.surface,
              borderRadius:4, border:"1px solid "+T.border }}>
              <span style={{ fontSize:10, color:T.muted, fontFamily:T.mono,
                textTransform:"uppercase", letterSpacing:1 }}>Per unit</span>
              <span style={{ fontSize:12, fontFamily:T.mono }}>
                <span style={{ color:T.blue, fontWeight:700 }}>{fmt$(unitMtl)}</span>
                <span style={{ color:T.dim, marginLeft:10 }}>{fmtHr(unitLbr)}</span>
              </span>
            </div>
            {qty>1 && (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"7px 10px", background:T.blueFaint, borderRadius:5, border:"1px solid "+T.blueMid }}>
                <span style={{ fontSize:11, color:T.blue, fontFamily:T.mono,
                  textTransform:"uppercase", letterSpacing:1 }}>Total × {qty}</span>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:15, color:T.blue, fontFamily:T.mono, fontWeight:700 }}>{fmt$(unitMtl*qty)}</div>
                  <div style={{ fontSize:11, color:T.blueL, fontFamily:T.mono }}>{fmtHr(unitLbr*qty)}</div>
                </div>
              </div>
            )}
          </div>
      </>
    )}
    />
    </div>
  );
}


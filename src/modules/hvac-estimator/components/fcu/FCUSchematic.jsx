import { useEffect, useMemo, useRef, useState } from "react";
import { T } from "../../shared/tokens.js";
import { TemplateSvgDiagram } from "../../shared/TemplateSvgDiagram.jsx";
import { UnitEditorPage } from "../../shared/UnitEditorPage.jsx";
import { useEstimate } from "../../shared/EstimateContext.jsx";
import {
  DEFAULT_FCU_CFG,
  FCU_COMPS,
  getVisibleFcuComponents,
  normalizeFcuCfg,
  reconcileFcuSelected,
  toggleFcuComponentSelection,
} from "./fcuData.js";

const COOLING_IDS = new Set(["fcu-chw-vlv", "fcu-chw-vlv-incr", "fcu-chw-vlv-2pos", "fcu-clg-staged"]);
const HEATING_IDS = new Set(["fcu-hw-vlv", "fcu-hw-vlv-incr", "fcu-hw-vlv-2pos", "fcu-htg-staged"]);
const COMMON_COIL_IDS = new Set(["fcu-cmn-vlv-prop", "fcu-cmn-vlv-incr", "fcu-cmn-vlv-2pos"]);
const COOLING_PRIORITY = ["fcu-chw-vlv", "fcu-chw-vlv-incr", "fcu-chw-vlv-2pos", "fcu-clg-staged", "fcu-cmn-vlv-prop", "fcu-cmn-vlv-incr", "fcu-cmn-vlv-2pos"];
const HEATING_PRIORITY = ["fcu-hw-vlv", "fcu-hw-vlv-incr", "fcu-hw-vlv-2pos", "fcu-htg-staged", "fcu-cmn-vlv-prop", "fcu-cmn-vlv-incr", "fcu-cmn-vlv-2pos"];
const isAnySelected = (selected, ids) => selected.some(item => ids.has(item.id));

export function getInitialFcuCfg(editingItem) {
  const isEditingFcu = !!editingItem && editingItem.type === "fcu";
  return isEditingFcu ? normalizeFcuCfg(editingItem.cfg) : normalizeFcuCfg(DEFAULT_FCU_CFG);
}

function getCoilToggleId(cfg, priority) {
  const visibleIds = new Set(getVisibleFcuComponents(cfg).map(comp => comp.id));
  return priority.find(id => visibleIds.has(id)) || priority[0];
}

function buildFcuTemplateVisibility(cfg, selected) {
  const activeCfg = normalizeFcuCfg(cfg);
  const on = id => selected.some(item => item.id === id);
  const showRoom = on("fcu-rm-t");
  const showHumidity = on("fcu-rh");
  const showCooling = isAnySelected(selected, COOLING_IDS) || isAnySelected(selected, COMMON_COIL_IDS);
  const showHeating = isAnySelected(selected, HEATING_IDS) || isAnySelected(selected, COMMON_COIL_IDS);

  return {
    "supply-duct": true,
    "intake-duct": true,
    da: true,
    ra: true,
    "da-t": on("fcu-da-t"),
    "zn-t": showRoom || showHumidity,
    "zn-h": showHumidity,
    "zn-q": false,
    "occ-s": on("fcu-occ-sensor"),
    "light-c": on("fcu-lighting-rly"),
    "htg-vlv": showHeating,
    "sf-c": on("fcu-fan-cs"),
    "filt-s": on("fcu-filter"),
    "cc-t": on("fcu-condensate"),
    "clg-vlv": showCooling,
    group: false,
    "sw-s": on("fcu-sw-switch") && activeCfg.commonCoilType !== "none",
  };
}

function DraggableCallout({ svgRef, dragRef, blockPos, id, anchor, width, height, lines, onClick, children, active = true }) {
  const toSvgPoint = event => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * 860,
      y: ((event.clientY - rect.top) / rect.height) * 300,
    };
  };

  const startDrag = event => {
    event.preventDefault();
    event.stopPropagation();
    const pt = toSvgPoint(event);
    if (!pt) return;
    dragRef.current = {
      key: id,
      moved: false,
      offsetX: pt.x - blockPos[id].x,
      offsetY: pt.y - blockPos[id].y,
      onClick,
    };
  };

  const pos = blockPos[id];
  return (
    <g style={{ cursor: "move" }} onMouseDown={startDrag} opacity={active ? 1 : 0.45}>
      <line x1={anchor.x} y1={anchor.y} x2={pos.x} y2={pos.y - height / 2} stroke="#111827" strokeWidth="1.2" />
      <rect x={pos.x - width / 2} y={pos.y - height / 2} width={width} height={height} rx="8" fill="#F3F4F6" stroke="#111827" strokeWidth="1.2" />
      {lines.map((line, idx) => (
        <text key={idx} x={pos.x} y={pos.y - ((lines.length - 1) * 7) + idx * 15 + 4} textAnchor="middle" fontSize="10" fontFamily={T.mono} fill="#000">
          {line}
        </text>
      ))}
      {children}
    </g>
  );
}

function FCUInlineFan({ cx, cy, color }) {
  return (
    <g>
      <rect x={cx - 18} y={cy - 18} width="36" height="36" rx="3" fill="#FFF" stroke={color} strokeWidth="1.4" />
      <circle cx={cx} cy={cy} r="11" fill="none" stroke={color} strokeWidth="1.4" />
      <path d={`M ${cx} ${cy - 9} L ${cx + 5} ${cy} L ${cx} ${cy + 2} Z`} fill={color} />
      <path d={`M ${cx - 8} ${cy + 2} L ${cx + 1} ${cy + 4} L ${cx - 2} ${cy + 9} Z`} fill={color} />
      <path d={`M ${cx - 6} ${cy - 6} L ${cx - 1} ${cy + 1} L ${cx - 8} ${cy - 1} Z`} fill={color} />
      <circle cx={cx} cy={cy} r="2" fill={color} />
    </g>
  );
}

function FCUFlowDiagram({ cfg, selected, onToggle }) {
  const coolingToggleId = getCoilToggleId(cfg, COOLING_PRIORITY);
  const heatingToggleId = getCoilToggleId(cfg, HEATING_PRIORITY);
  const isOn = id => selected.some(s => s.id === id);
  const showCooling = isAnySelected(selected, COOLING_IDS) || isAnySelected(selected, COMMON_COIL_IDS);
  const showHeating = isAnySelected(selected, HEATING_IDS) || isAnySelected(selected, COMMON_COIL_IDS);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [blockPos, setBlockPos] = useState({
    room: { x: 728, y: 88 },
    controller: { x: 360, y: 244 },
    dat: { x: 606, y: 84 },
    chw: { x: 614, y: 214 },
    hw: { x: 742, y: 214 },
    fan: { x: 208, y: 242 },
  });

  const handleDrag = event => {
    const drag = dragRef.current;
    if (!drag || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((event.clientX - rect.left) / rect.width) * 860 - drag.offsetX;
    const y = ((event.clientY - rect.top) / rect.height) * 300 - drag.offsetY;
    if (!drag.moved && (Math.abs(x - blockPos[drag.key].x) > 1 || Math.abs(y - blockPos[drag.key].y) > 1)) {
      drag.moved = true;
    }
    setBlockPos(prev => ({ ...prev, [drag.key]: { x, y } }));
  };

  const stopDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved && drag.onClick) drag.onClick();
    dragRef.current = null;
  };

  const line = "#111827";
  const activeColor = "#2563EB";
  const ductStartX = 120;
  const ductEndX = 560;
  const ductTopY = 126;
  const ductBottomY = 174;

  return (
    <svg ref={svgRef} viewBox="0 0 860 300" style={{ width: "100%", height: "100%", display: "block", background: "#F7F7F7", cursor: dragRef.current ? "grabbing" : "default" }} onMouseMove={handleDrag} onMouseUp={stopDrag} onMouseLeave={stopDrag}>
      <rect width="860" height="300" fill="#F7F7F7" />
      <line x1={ductStartX} y1={ductTopY} x2={ductEndX} y2={ductTopY} stroke="#000" strokeWidth="3" />
      <line x1={ductStartX} y1={ductBottomY} x2={ductEndX} y2={ductBottomY} stroke="#000" strokeWidth="3" />
      <polygon points={`${ductStartX},150 ${ductStartX - 34},126 ${ductStartX - 34},174`} fill="#000" />
      <polygon points={`${ductEndX + 34},150 ${ductEndX},126 ${ductEndX},174`} fill="#000" />

      <text x="72" y="156" fontSize="11" fontFamily={T.mono} fill="#000" fontWeight="700">RA</text>
      <text x="600" y="156" fontSize="11" fontFamily={T.mono} fill="#000" fontWeight="700">SA</text>

      <rect x="322" y="118" width="108" height="64" rx="3" fill="#FFFFFF" stroke={line} strokeWidth="2" />
      <text x="376" y="157" textAnchor="middle" fontSize="13" fontFamily={T.mono} fill="#000" fontWeight="700">FCU</text>

      <g style={{ cursor: "pointer" }} onClick={() => onToggle("fcu-filter")}>
        <rect x="270" y="132" width="10" height="36" fill={isOn("fcu-filter") ? activeColor : "#D1D5DB"} stroke={line} strokeWidth="1.3" />
        {[0.2, 0.5, 0.8].map(frac => (
          <line key={frac} x1="270" y1={132 + 36 * frac} x2="280" y2={132 + 36 * frac} stroke={line} strokeWidth="1" />
        ))}
      </g>

      <g style={{ cursor: "pointer" }} onClick={() => onToggle("fcu-fan-cs")}>
        <FCUInlineFan cx={224} cy={150} color={isOn("fcu-fan-cs") ? activeColor : line} />
      </g>

      <g style={{ cursor: "pointer" }} onClick={() => onToggle(coolingToggleId)} opacity={showCooling ? 1 : 0.4}>
        <rect x="468" y="136" width="26" height="28" fill={showCooling ? activeColor : "#E5E7EB"} stroke={line} strokeWidth="1.4" rx="2" />
        <line x1="471" y1="161" x2="491" y2="139" stroke={line} strokeWidth="1.4" />
      </g>

      <g style={{ cursor: "pointer" }} onClick={() => onToggle("fcu-da-t")}>
        <circle cx="536" cy="150" r="10" fill={isOn("fcu-da-t") ? activeColor : "#E5E7EB"} stroke={line} strokeWidth="1.4" />
        <text x="536" y="154" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill="#111827">T</text>
      </g>

      <DraggableCallout svgRef={svgRef} dragRef={dragRef} blockPos={blockPos} id="controller" anchor={{ x: 376, y: 182 }} width={118} height={42} lines={["FCU-CTRL"]} onClick={() => onToggle("fcu-ctrl")} active={isOn("fcu-ctrl") || isOn("fcu-tec")} />
      <DraggableCallout svgRef={svgRef} dragRef={dragRef} blockPos={blockPos} id="fan" anchor={{ x: 224, y: 182 }} width={132} height={42} lines={["Fan Status"]} onClick={() => onToggle("fcu-fan-cs")} active={isOn("fcu-fan-cs")} />
      <DraggableCallout svgRef={svgRef} dragRef={dragRef} blockPos={blockPos} id="dat" anchor={{ x: 536, y: 138 }} width={128} height={42} lines={["Discharge Temp"]} onClick={() => onToggle("fcu-da-t")} active={isOn("fcu-da-t")} />
      <DraggableCallout svgRef={svgRef} dragRef={dragRef} blockPos={blockPos} id="chw" anchor={{ x: 481, y: 164 }} width={118} height={42} lines={["Cooling Coil"]} onClick={() => onToggle(coolingToggleId)} active={showCooling} />
      <DraggableCallout svgRef={svgRef} dragRef={dragRef} blockPos={blockPos} id="hw" anchor={{ x: 516, y: 164 }} width={118} height={42} lines={["Heating Coil"]} onClick={() => onToggle(heatingToggleId)} active={showHeating} />
      <DraggableCallout svgRef={svgRef} dragRef={dragRef} blockPos={blockPos} id="room" anchor={{ x: 376, y: 126 }} width={142} height={50} lines={["Room Sensor"]} onClick={() => onToggle("fcu-rm-t")} active={isOn("fcu-rm-t")}>
        <text x={blockPos.room.x} y={blockPos.room.y + 13} textAnchor="middle" fontSize="9" fontFamily={T.mono} fill="#374151">Temp / RH</text>
      </DraggableCallout>
    </svg>
  );
}

export default function FCUPage({ onBack = null } = {}) {
  const { activeEstimate, editingItem, subPage } = useEstimate();
  const quoteDefault = activeEstimate?.settings?.defaultInstallType ?? "EMT";
  const isEditing = !!editingItem && editingItem.type === "fcu";
  const [cfg, setCfg] = useState(() => getInitialFcuCfg(editingItem));
  const [blockedIds, setBlockedIds] = useState([]);
  const visibleComponents = useMemo(() => getVisibleFcuComponents(cfg), [cfg]);

  useEffect(() => {
    setBlockedIds([]);
    setCfg(getInitialFcuCfg(editingItem));
  }, [editingItem?.id, isEditing]);

  useEffect(() => {
    if (subPage?.type !== "fcu" || !subPage?.conduitFillDraft?.cfg) return;
    setBlockedIds([]);
    setCfg(normalizeFcuCfg(subPage.conduitFillDraft.cfg));
  }, [subPage]);

  const updateCfg = patch => setCfg(prev => normalizeFcuCfg({ ...prev, ...patch }));

  return (
    <UnitEditorPage
      onBack={onBack}
      type="fcu"
      comps={visibleComponents}
      title="Fan Coil Unit"
      badge="FCU"
      defaultTag="FCU"
      defaultLocation="Ceiling"
      defaultInstallType={quoteDefault}
      cfg={cfg}
      pageKey="fcu"
      buildDefaultSelected={(comps, activeCfg) =>
        reconcileFcuSelected([], activeCfg, { components: comps, blockedIds })
      }
      normalizeSelected={(selected, comps, activeCfg) =>
        reconcileFcuSelected(selected, activeCfg, { components: comps, blockedIds })
      }
      reconcileSelected={(selected, comps, activeCfg) =>
        reconcileFcuSelected(selected, activeCfg, { components: comps, blockedIds })
      }
      toggleSelected={(selected, componentId, comps, activeCfg) => {
        const isSelected = selected.some(entry => entry.id === componentId);
        const isDefaulted = comps.some(comp => comp.id === componentId && comp.defaultWhen?.(activeCfg));

        setBlockedIds(prev => {
          if (isDefaulted && isSelected) {
            return prev.includes(componentId) ? prev : [...prev, componentId];
          }
          if (!isSelected) {
            return prev.filter(id => id !== componentId);
          }
          return prev;
        });

        return toggleFcuComponentSelection(selected, componentId, { components: comps, cfg: activeCfg });
      }}
      flowNode={(selected, toggle) => (
        <TemplateSvgDiagram
          svgPath="/diagrams/fcu-template.svg"
          visibility={buildFcuTemplateVisibility(cfg, selected)}
          fallback={<FCUFlowDiagram cfg={cfg} selected={selected} onToggle={toggle} />}
        />
      )}
      addAssemblyLabel="Add FCU assembly..."
    />
  );
}

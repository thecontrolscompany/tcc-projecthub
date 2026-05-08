import { T } from "./tokens.js";
import { BlowerSymbol, DraggableCallout, FlowSvg, useDraggableBlocks } from "./diagramUtils.js";

const UNITARY_CONFIG = {
  rtu: {
    footer: "RTU - drafting style flow layout",
    blocks: {
      room: { x: 758, y: 78 },
      controller: { x: 422, y: 280 },
      dat: { x: 708, y: 52 },
      cooling: { x: 814, y: 236 },
      heat: { x: 650, y: 244 },
      pressure: { x: 566, y: 280 },
      economizer: { x: 92, y: 280 },
      returnFan: { x: 262, y: 280 },
      safety: { x: 248, y: 52 },
    },
  },
  uh: {
    footer: "UH - drafting style flow layout",
    blocks: {
      room: { x: 716, y: 86 },
      controller: { x: 404, y: 246 },
      dat: { x: 608, y: 84 },
      heating: { x: 706, y: 210 },
      fan: { x: 228, y: 244 },
      water: { x: 574, y: 244 },
    },
  },
  dx: {
    footer: "DX / HP - drafting style flow layout",
    blocks: {
      room: { x: 746, y: 84 },
      controller: { x: 368, y: 246 },
      dat: { x: 598, y: 84 },
      outdoor: { x: 742, y: 208 },
      heatpump: { x: 626, y: 246 },
      aux: { x: 498, y: 246 },
      safety: { x: 242, y: 78 },
    },
  },
  vrf: {
    footer: "VRF - drafting style flow layout",
    blocks: {
      room: { x: 742, y: 84 },
      indoor: { x: 334, y: 248 },
      gateway: { x: 176, y: 248 },
      dat: { x: 588, y: 84 },
      outdoor: { x: 818, y: 84 },
      branch: { x: 540, y: 246 },
      safety: { x: 648, y: 246 },
    },
  },
};

export function UnitaryFlowDiagram({ kind, selected, onToggle }) {
  const cfg = UNITARY_CONFIG[kind] || UNITARY_CONFIG.rtu;
  const drag = useDraggableBlocks(cfg.blocks);
  const isDragging = Boolean(drag.draggingId);
  const isOn = (id) => selected.some((item) => item.id === id);
  const line = "#111827";
  const muted = "#6B7280";
  const ductY = 150;
  const ductStartX = 122;
  const ductEndX = 666;

  const show = {
    rtu: {
      room: false,
      controller: isOn("rtu-ddc"),
      dat: isOn("rtu-sa-t"),
      cooling: isOn("rtu-cond") || isOn("rtu-dx2") || isOn("rtu-dx4"),
      heat: isOn("rtu-hw-vlv") || isOn("rtu-htg2") || isOn("rtu-htg3"),
      pressure: isOn("rtu-sa-sp"),
      economizer: isOn("rtu-oa-d") || isOn("rtu-ma-t"),
      returnFan: isOn("rtu-vfd-rf"),
      safety: isOn("rtu-freeze") || isOn("rtu-smoke") || isOn("rtu-filter"),
    },
    uh: {
      room: isOn("uh-rm-t"),
      controller: isOn("uh-ctrl"),
      dat: false,
      heating: isOn("uh-hw-vlv") || isOn("uh-htg2") || isOn("uh-htg3"),
      fan: isOn("uh-fan-cs"),
      water: isOn("uh-sp-t"),
    },
    dx: {
      room: isOn("dx-zone"),
      controller: isOn("dx-ddc"),
      dat: isOn("dx-dat"),
      outdoor: isOn("dx-cond"),
      heatpump: isOn("dx-heatpump"),
      aux: isOn("dx-aux-heat"),
      safety: isOn("dx-float") || isOn("dx-filter") || isOn("dx-smoke"),
    },
    vrf: {
      room: isOn("vrf-zone"),
      indoor: isOn("vrf-indoor"),
      gateway: isOn("vrf-gateway") || isOn("vrf-bacnet") || isOn("vrf-comm"),
      dat: isOn("vrf-dat"),
      outdoor: isOn("vrf-cond"),
      branch: isOn("vrf-branch"),
      safety: isOn("vrf-float") || isOn("vrf-leak"),
    },
  }[kind] || {};

  return (
    <FlowSvg svgRef={drag.svgRef} onMouseMove={drag.onMouseMove} endDrag={drag.endDrag}>
      <line x1={ductStartX - 40} y1={ductY} x2={ductStartX} y2={ductY} stroke="#000" strokeWidth="8" markerEnd="url(#flowArrowRight)" />
      <line x1={ductStartX} y1={ductY} x2={ductEndX} y2={ductY} stroke="#000" strokeWidth="8" strokeLinecap="square" />
      <line x1={ductEndX} y1={ductY} x2={ductEndX + 40} y2={ductY} stroke="#000" strokeWidth="8" markerEnd="url(#flowArrowRight)" />

      {kind === "rtu" && (
        <>
          <rect x="172" y="112" width="292" height="76" fill="#FFF" stroke={line} strokeWidth="1.6" />
          <line x1="224" y1="112" x2="224" y2="188" stroke={line} strokeWidth="1.2" />
          <line x1="278" y1="112" x2="278" y2="188" stroke={line} strokeWidth="1.2" />
          <line x1="348" y1="112" x2="348" y2="188" stroke={line} strokeWidth="1.2" />
          <line x1="408" y1="112" x2="408" y2="188" stroke={line} strokeWidth="1.2" />
          <text x="198" y="206" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>OA</text>
          <text x="250" y="206" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>FLT</text>
          <text x="312" y="206" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>MIX</text>
          <BlowerSymbol cx={378} cy={150} color={line} />
          <text x="378" y="206" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>SF</text>
          <path d="M 438 118 Q 448 150 438 182" fill="none" stroke={line} strokeWidth="1.5" />
          <path d="M 452 118 Q 462 150 452 182" fill="none" stroke={line} strokeWidth="1.5" />
          <text x="446" y="206" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>DX</text>
          {show.returnFan && (
            <>
              <line x1="248" y1="188" x2="248" y2="224" stroke={line} strokeWidth="5" />
              <line x1="248" y1="224" x2="336" y2="224" stroke={line} strokeWidth="5" />
              <BlowerSymbol cx={300} cy={224} color={line} />
            </>
          )}
          {show.heat && (
            <>
              <line x1="464" y1="188" x2="464" y2="224" stroke={line} strokeWidth="5" />
              <line x1="464" y1="224" x2="566" y2="224" stroke={line} strokeWidth="5" />
            </>
          )}
        </>
      )}

      {kind === "uh" && (
        <>
          <rect x="226" y="114" width="260" height="72" fill="#FFF" stroke={line} strokeWidth="1.6" />
          <line x1="300" y1="114" x2="300" y2="186" stroke={line} strokeWidth="1.2" />
          <BlowerSymbol cx={264} cy={150} color={line} />
          <text x="264" y="204" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>FAN</text>
          <path d="M 338 120 Q 348 150 338 180" fill="none" stroke={line} strokeWidth="1.5" />
          <path d="M 352 120 Q 362 150 352 180" fill="none" stroke={line} strokeWidth="1.5" />
          <text x="346" y="204" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>HEAT</text>
          <line x1="390" y1="186" x2="390" y2="224" stroke={line} strokeWidth="5" />
          <line x1="390" y1="224" x2="520" y2="224" stroke={line} strokeWidth="5" />
        </>
      )}

      {kind === "dx" && (
        <>
          <rect x="228" y="110" width="244" height="80" fill="#FFF" stroke={line} strokeWidth="1.6" />
          <line x1="294" y1="110" x2="294" y2="190" stroke={line} strokeWidth="1.2" />
          <BlowerSymbol cx={260} cy={150} color={line} />
          <text x="260" y="208" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>FAN</text>
          <path d="M 334 118 Q 344 150 334 182" fill="none" stroke={line} strokeWidth="1.5" />
          <path d="M 348 118 Q 358 150 348 182" fill="none" stroke={line} strokeWidth="1.5" />
          <text x="344" y="208" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>DX COIL</text>
          <line x1="470" y1="150" x2="612" y2="150" stroke={line} strokeWidth="2" strokeDasharray="8 5" />
          <rect x="618" y="120" width="88" height="60" rx="4" fill="#FFF" stroke={line} strokeWidth="1.5" />
          <text x="662" y="145" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>OUTDOOR</text>
          <text x="662" y="160" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>UNIT</text>
          <text x="662" y="175" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>CONDENSER</text>
        </>
      )}

      {kind === "vrf" && (
        <>
          <rect x="214" y="112" width="220" height="76" fill="#FFF" stroke={line} strokeWidth="1.6" />
          <line x1="282" y1="112" x2="282" y2="188" stroke={line} strokeWidth="1.2" />
          <BlowerSymbol cx={248} cy={150} color={line} />
          <text x="248" y="206" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>INDOOR</text>
          <path d="M 324 118 Q 334 150 324 182" fill="none" stroke={line} strokeWidth="1.5" />
          <path d="M 338 118 Q 348 150 338 182" fill="none" stroke={line} strokeWidth="1.5" />
          <text x="334" y="206" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>COIL</text>
          <line x1="438" y1="132" x2="596" y2="132" stroke={line} strokeWidth="2" strokeDasharray="8 5" />
          <line x1="438" y1="168" x2="596" y2="168" stroke={line} strokeWidth="2" strokeDasharray="8 5" />
          <line x1="596" y1="150" x2="684" y2="86" stroke={line} strokeWidth="1.8" strokeDasharray="8 5" />
          <rect x="684" y="54" width="92" height="64" rx="4" fill="#FFF" stroke={line} strokeWidth="1.5" />
          <text x="730" y="78" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>OUTDOOR</text>
          <text x="730" y="93" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>VRF</text>
          <text x="730" y="108" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>CONDENSER</text>
        </>
      )}

      {kind === "rtu" && (
        <>
          <DraggableCallout drag={drag} id="controller" anchor={{ x: 492, y: 150 }} width={126} height={42} lines={["DDC PANEL"]} active={show.controller} onClick={() => onToggle("rtu-ddc")} tooltipDescription="Main digital controller for this system" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="dat" anchor={{ x: 594, y: 150 }} width={124} height={42} lines={["SUPPLY AIR", "TEMP"]} active={show.dat} onClick={() => onToggle("rtu-sa-t")} tooltipDescription="Duct sensor measuring discharge air temperature" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="cooling" anchor={{ x: 662, y: 150 }} width={132} height={42} lines={["CONDENSING", "UNIT I/O"]} active={show.cooling} onClick={() => onToggle(isOn("rtu-cond") ? "rtu-cond" : "rtu-dx4")} tooltipDescription="Compressor and condenser unit status and commands" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="heat" anchor={{ x: 566, y: 224 }} width={116} height={42} lines={isOn("rtu-hw-vlv") ? ["HW HEAT", "VALVE"] : ["ELEC HEAT"]} active={show.heat} onClick={() => onToggle(isOn("rtu-hw-vlv") ? "rtu-hw-vlv" : "rtu-htg3")} tooltipDescription="Heating output stage or hot water valve control" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="pressure" anchor={{ x: 520, y: 150 }} width={128} height={42} lines={["SUPPLY STATIC"]} active={show.pressure} onClick={() => onToggle("rtu-sa-sp")} tooltipDescription="Static pressure sensor for supply duct control" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="economizer" anchor={{ x: 188, y: 150 }} width={128} height={42} lines={["OA DAMPER", "ECONOMIZER"]} active={show.economizer} onClick={() => onToggle(isOn("rtu-oa-d") ? "rtu-oa-d" : "rtu-ma-t")} tooltipDescription="Outside air damper and economizer control" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="returnFan" anchor={{ x: 300, y: 224 }} width={118} height={42} lines={["RETURN FAN", "VFD"]} active={show.returnFan} onClick={() => onToggle("rtu-vfd-rf")} tooltipDescription="Return fan variable frequency drive" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="safety" anchor={{ x: 250, y: 150 }} width={124} height={48} lines={["FILTER /", "SAFETIES"]} active={show.safety} onClick={() => onToggle(isOn("rtu-filter") ? "rtu-filter" : isOn("rtu-freeze") ? "rtu-freeze" : "rtu-smoke")} tooltipDescription="Filter differential pressure and system safeties" isDragging={isDragging} />
        </>
      )}

      {kind === "uh" && (
        <>
          <DraggableCallout drag={drag} id="room" anchor={{ x: 694, y: 150 }} width={132} height={42} lines={["ROOM TEMP"]} active={show.room} onClick={() => onToggle("uh-rm-t")} tooltipDescription="Space sensor controlling room temperature" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="controller" anchor={{ x: 428, y: 150 }} width={148} height={42} lines={["UH", "CONTROLLER"]} active={show.controller} onClick={() => onToggle("uh-ctrl")} tooltipDescription="Unit heater controller and output logic" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="heating" anchor={{ x: 520, y: 224 }} width={138} height={42} lines={isOn("uh-hw-vlv") ? ["HW VALVE", "ACTUATOR"] : ["ELEC HEAT"]} active={show.heating} onClick={() => onToggle(isOn("uh-hw-vlv") ? "uh-hw-vlv" : "uh-htg2")} tooltipDescription="Heating valve actuator or electric heat stage" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="fan" anchor={{ x: 264, y: 150 }} width={136} height={42} lines={["FAN STATUS"]} active={show.fan} onClick={() => onToggle("uh-fan-cs")} tooltipDescription="Fan proof or current switch status" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="water" anchor={{ x: 390, y: 224 }} width={138} height={42} lines={["HW SUPPLY", "TEMP"]} active={show.water} onClick={() => onToggle("uh-sp-t")} tooltipDescription="Hot water supply temperature sensor" isDragging={isDragging} />
        </>
      )}

      {kind === "dx" && (
        <>
          <DraggableCallout drag={drag} id="room" anchor={{ x: 724, y: 150 }} width={132} height={42} lines={["ZONE TEMP"]} active={show.room} onClick={() => onToggle("dx-zone")} tooltipDescription="Zone sensor reading occupied space temperature" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="controller" anchor={{ x: 404, y: 150 }} width={148} height={42} lines={["DX UNIT", "CONTROLLER"]} active={show.controller} onClick={() => onToggle("dx-ddc")} tooltipDescription="Main controller for the DX air handler" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="dat" anchor={{ x: 530, y: 150 }} width={128} height={42} lines={["DISCH AIR", "TEMP"]} active={show.dat} onClick={() => onToggle("dx-dat")} tooltipDescription="Discharge air temperature sensor in supply duct" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="outdoor" anchor={{ x: 662, y: 150 }} width={144} height={42} lines={["OUTDOOR", "UNIT I/O"]} active={show.outdoor} onClick={() => onToggle("dx-cond")} tooltipDescription="Outdoor condensing unit commands and status" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="heatpump" anchor={{ x: 612, y: 150 }} width={146} height={42} lines={["HEAT PUMP", "CHANGEOVER"]} active={show.heatpump} onClick={() => onToggle("dx-heatpump")} tooltipDescription="Reversing valve and heat pump switchover" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="aux" anchor={{ x: 438, y: 188 }} width={138} height={42} lines={["AUX HEAT"]} active={show.aux} onClick={() => onToggle("dx-aux-heat")} tooltipDescription="Auxiliary heat stage or backup heating output" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="safety" anchor={{ x: 260, y: 150 }} width={142} height={48} lines={["FLOAT / FILTER", "SAFETY"]} active={show.safety} onClick={() => onToggle(isOn("dx-float") ? "dx-float" : isOn("dx-filter") ? "dx-filter" : "dx-smoke")} tooltipDescription="Condensate, filter, and smoke safety interlocks" isDragging={isDragging} />
        </>
      )}

      {kind === "vrf" && (
        <>
          <DraggableCallout drag={drag} id="room" anchor={{ x: 724, y: 150 }} width={132} height={42} lines={["ZONE TEMP"]} active={show.room} onClick={() => onToggle("vrf-zone")} tooltipDescription="Space sensor tied to VRF zone control" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="indoor" anchor={{ x: 392, y: 150 }} width={146} height={42} lines={["INDOOR UNIT", "CONTROLLER"]} active={show.indoor} onClick={() => onToggle("vrf-indoor")} tooltipDescription="Indoor unit controller and local equipment I/O" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="gateway" anchor={{ x: 180, y: 150 }} width={150} height={48} lines={["GATEWAY /", "BACNET BUS"]} active={show.gateway} onClick={() => onToggle(isOn("vrf-gateway") ? "vrf-gateway" : isOn("vrf-bacnet") ? "vrf-bacnet" : "vrf-comm")} tooltipDescription="Gateway linking VRF controls to BAS network" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="dat" anchor={{ x: 522, y: 150 }} width={128} height={42} lines={["SUPPLY AIR", "TEMP"]} active={show.dat} onClick={() => onToggle("vrf-dat")} tooltipDescription="Supply air temperature sensor at indoor discharge" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="outdoor" anchor={{ x: 730, y: 54 }} width={148} height={42} lines={["OUTDOOR", "CONDENSER I/O"]} active={show.outdoor} onClick={() => onToggle("vrf-cond")} tooltipDescription="Outdoor condenser status, alarms, and commands" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="branch" anchor={{ x: 542, y: 132 }} width={146} height={42} lines={["BRANCH", "SELECTOR"]} active={show.branch} onClick={() => onToggle("vrf-branch")} tooltipDescription="Branch selector box directing refrigerant flow" isDragging={isDragging} />
          <DraggableCallout drag={drag} id="safety" anchor={{ x: 430, y: 188 }} width={146} height={48} lines={["FLOAT / LEAK", "SAFETY"]} active={show.safety} onClick={() => onToggle(isOn("vrf-float") ? "vrf-float" : "vrf-leak")} tooltipDescription="Float switches and refrigerant leak safety inputs" isDragging={isDragging} />
        </>
      )}

      <text x="220" y="286" fontSize="9" fontFamily={T.mono} fill={muted}>
        {cfg.footer}
      </text>
    </FlowSvg>
  );
}

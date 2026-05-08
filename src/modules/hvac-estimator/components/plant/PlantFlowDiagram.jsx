import { T } from "../../shared/tokens.js";
import { BlowerSymbol, DraggableCallout, FlowSvg, useDraggableBlocks } from "../../shared/diagramUtils.js";

export function PlantFlowDiagram({ plantType, selected, onToggle }) {
  const drag = useDraggableBlocks({
    left: { x: 176, y: 74 },
    right: { x: 674, y: 74 },
    lower: { x: 524, y: 236 },
    panel: { x: 272, y: 236 },
  });
  const line = "#111827";
  const muted = "#6B7280";
  const compIds = selected.map((item) => item.id);
  const isPumping = plantType?.startsWith("pumping");
  const isTower = plantType === "cooling-tower";
  const isBoiler = plantType?.startsWith("boiler");
  const label = isTower ? "COOLING TOWER" : isBoiler ? "BOILER" : isPumping ? "PUMP SKID" : "CHILLER";
  const leftSensor = compIds.find((id) => id.includes("sup")) || compIds.find((id) => id.includes("press")) || compIds[0];
  const rightSensor = compIds.find((id) => id.includes("ret")) || compIds.find((id) => id.includes("flow")) || compIds[1];
  const lowerSensor = compIds.find((id) => id.includes("vfd")) || compIds.find((id) => id.includes("iso")) || compIds.find((id) => id.includes("byp")) || compIds[2];
  const panelSensor = compIds.find((id) => id.includes("ddc")) || compIds.find((id) => id.includes("io")) || compIds.find((id) => id.includes("burner")) || compIds[3];

  return (
    <FlowSvg svgRef={drag.svgRef} onMouseMove={drag.onMouseMove} endDrag={drag.endDrag}>
      <line x1="108" y1="150" x2="696" y2="150" stroke="#000" strokeWidth="8" strokeLinecap="square" />
      <line x1="68" y1="150" x2="108" y2="150" stroke="#000" strokeWidth="8" markerEnd="url(#flowArrowRight)" />
      <line x1="696" y1="150" x2="736" y2="150" stroke="#000" strokeWidth="8" markerEnd="url(#flowArrowRight)" />

      {isTower ? (
        <>
          <rect x="286" y="102" width="188" height="96" fill="#FFF" stroke={line} strokeWidth="1.6" />
          <path d="M 314 178 L 446 178 L 418 112 L 342 112 Z" fill="none" stroke={line} strokeWidth="1.5" />
          <BlowerSymbol cx={380} cy={132} color={line} />
          <text x="380" y="216" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>TOWER FAN</text>
        </>
      ) : isPumping ? (
        <>
          <circle cx="332" cy="150" r="26" fill="#FFF" stroke={line} strokeWidth="1.6" />
          <circle cx="452" cy="150" r="26" fill="#FFF" stroke={line} strokeWidth="1.6" />
          <path d="M 318 150 L 344 150" stroke={line} strokeWidth="1.5" />
          <path d="M 438 150 L 466 150" stroke={line} strokeWidth="1.5" />
          <text x="332" y="194" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>P-1</text>
          <text x="452" y="194" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>P-2</text>
        </>
      ) : (
        <>
          <rect x="278" y="108" width="210" height="84" fill="#FFF" stroke={line} strokeWidth="1.6" />
          <text x="383" y="152" textAnchor="middle" fontSize="12" fontFamily={T.mono} fill={muted}>{label}</text>
          {isBoiler && (
            <>
              <path d="M 334 168 Q 350 136 366 168" fill="none" stroke={line} strokeWidth="1.5" />
              <path d="M 366 168 Q 382 136 398 168" fill="none" stroke={line} strokeWidth="1.5" />
              <path d="M 398 168 Q 414 136 430 168" fill="none" stroke={line} strokeWidth="1.5" />
            </>
          )}
        </>
      )}

      {compIds.find((id) => id.includes("iso") || id.includes("byp")) && (
        <>
          <line x1="520" y1="150" x2="520" y2="216" stroke={line} strokeWidth="5" />
          <line x1="520" y1="216" x2="612" y2="216" stroke={line} strokeWidth="5" />
        </>
      )}

      <DraggableCallout drag={drag} id="left" anchor={{ x: 190, y: 150 }} width={138} height={42} lines={["SUPPLY", "SENSOR"]} active={!!leftSensor} onClick={() => leftSensor && onToggle(leftSensor)} />
      <DraggableCallout drag={drag} id="right" anchor={{ x: 578, y: 150 }} width={138} height={42} lines={["RETURN", "SENSOR"]} active={!!rightSensor} onClick={() => rightSensor && onToggle(rightSensor)} />
      <DraggableCallout drag={drag} id="lower" anchor={{ x: 612, y: 216 }} width={152} height={42} lines={isPumping ? ["VFD /", "PUMP CONTROL"] : isTower ? ["BYPASS /", "FAN CTRL"] : ["VALVE /", "FLOW CTRL"]} active={!!lowerSensor} onClick={() => lowerSensor && onToggle(lowerSensor)} />
      <DraggableCallout drag={drag} id="panel" anchor={{ x: 382, y: 192 }} width={144} height={42} lines={["PLANT DDC", "CONTROL"]} active={!!panelSensor} onClick={() => panelSensor && onToggle(panelSensor)} />

      <text x="210" y="286" fontSize="9" fontFamily={T.mono} fill={muted}>
        {plantType ? `${plantType} - drafting style flow layout` : "Plant - drafting style flow layout"}
      </text>
    </FlowSvg>
  );
}

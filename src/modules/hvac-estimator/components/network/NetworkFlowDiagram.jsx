import { T } from "../../shared/tokens.js";
import { DraggableCallout, FlowSvg, useDraggableBlocks } from "../../shared/diagramUtils.js";

export function NetworkFlowDiagram({ selected, onToggle }) {
  const drag = useDraggableBlocks({
    panel: { x: 160, y: 74 },
    cable: { x: 360, y: 244 },
    wireless: { x: 560, y: 74 },
    right: { x: 732, y: 74 },
  });
  const isOn = (id) => selected.some((item) => item.id === id);
  const line = "#111827";
  const muted = "#6B7280";
  const cableId = isOn("net-cat6") ? "net-cat6" : isOn("net-cat6a") ? "net-cat6a" : isOn("net-cat5") ? "net-cat5" : isOn("net-fiber-2mm") ? "net-fiber-2mm" : isOn("net-fiber-4mm") ? "net-fiber-4mm" : null;
  const panelId = isOn("net-panel-emt") ? "net-panel-emt" : isOn("net-panel-pln") ? "net-panel-pln" : isOn("net-panel-only") ? "net-panel-only" : null;
  const wirelessId = isOn("net-wireless") ? "net-wireless" : isOn("net-rcvr-ctrl") ? "net-rcvr-ctrl" : isOn("net-rcvr-rem") ? "net-rcvr-rem" : isOn("net-wall-stat") ? "net-wall-stat" : null;
  const edgeId = isOn("net-fiber-term") ? "net-fiber-term" : isOn("net-ef") ? "net-ef" : cableId;

  return (
    <FlowSvg svgRef={drag.svgRef} onMouseMove={drag.onMouseMove} endDrag={drag.endDrag}>
      <rect x="86" y="114" width="110" height="72" rx="4" fill="#FFF" stroke={line} strokeWidth="1.6" />
      <text x="141" y="143" textAnchor="middle" fontSize="10" fontFamily={T.mono} fill={muted}>NETWORK</text>
      <text x="141" y="159" textAnchor="middle" fontSize="10" fontFamily={T.mono} fill={muted}>PANEL</text>
      <line x1="196" y1="150" x2="688" y2="150" stroke="#000" strokeWidth="5" strokeDasharray="10 6" />
      <line x1="688" y1="150" x2="742" y2="150" stroke="#000" strokeWidth="5" markerEnd="url(#flowArrowRight)" />

      <circle cx="324" cy="150" r="14" fill="#FFF" stroke={line} strokeWidth="1.5" />
      <circle cx="470" cy="150" r="14" fill="#FFF" stroke={line} strokeWidth="1.5" />
      <circle cx="614" cy="150" r="14" fill="#FFF" stroke={line} strokeWidth="1.5" />
      <line x1="614" y1="150" x2="614" y2="206" stroke={line} strokeWidth="3" />
      <line x1="614" y1="206" x2="714" y2="206" stroke={line} strokeWidth="3" />
      <rect x="714" y="180" width="70" height="52" rx="4" fill="#FFF" stroke={line} strokeWidth="1.5" />
      <text x="749" y="202" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>EDGE</text>
      <text x="749" y="217" textAnchor="middle" fontSize="9" fontFamily={T.mono} fill={muted}>DEVICE</text>

      <DraggableCallout drag={drag} id="panel" anchor={{ x: 141, y: 150 }} width={144} height={42} lines={["NETWORK", "PANEL"]} active={!!panelId} onClick={() => panelId && onToggle(panelId)} />
      <DraggableCallout drag={drag} id="cable" anchor={{ x: 394, y: 150 }} width={148} height={42} lines={cableId && cableId.includes("fiber") ? ["BACKBONE", "FIBER"] : ["ETHERNET", "BACKBONE"]} active={!!cableId} onClick={() => cableId && onToggle(cableId)} />
      <DraggableCallout drag={drag} id="wireless" anchor={{ x: 614, y: 150 }} width={150} height={48} lines={["WIRELESS /", "REMOTE BUS"]} active={!!wirelessId} onClick={() => wirelessId && onToggle(wirelessId)} />
      <DraggableCallout drag={drag} id="right" anchor={{ x: 749, y: 206 }} width={142} height={42} lines={edgeId === "net-ef" ? ["EXHAUST FAN", "INTERFACE"] : ["FIELD", "TERMINATION"]} active={!!edgeId} onClick={() => edgeId && onToggle(edgeId)} />

      <text x="236" y="286" fontSize="9" fontFamily={T.mono} fill={muted}>
        Network - drafting style layout
      </text>
    </FlowSvg>
  );
}

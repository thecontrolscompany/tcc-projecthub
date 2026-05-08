import { useRef, useState } from "react";
import { DiagramTooltip } from "./DiagramTooltip.jsx";
import { T } from "./tokens.js";
import { useDiagramTooltip } from "./useDiagramTooltip.js";

const VIEW_W = 980;
const VIEW_H = 360;
const CONTENT_OFFSET_X = 60;
const CONTENT_OFFSET_Y = 30;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function useDraggableBlocks(initial) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [blockPos, setBlockPos] = useState(initial);
  const [draggingId, setDraggingId] = useState(null);

  const toSvgPoint = (event) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEW_W,
      y: ((event.clientY - rect.top) / rect.height) * VIEW_H,
    };
  };

  const startDrag = (event, id, onClick) => {
    event.preventDefault();
    event.stopPropagation();
    const pt = toSvgPoint(event);
    if (!pt) return;
    dragRef.current = {
      id,
      onClick,
      moved: false,
      offsetX: pt.x - blockPos[id].x,
      offsetY: pt.y - blockPos[id].y,
    };
    setDraggingId(id);
  };

  const onMouseMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pt = toSvgPoint(event);
    if (!pt) return;
    drag.moved = true;
    setBlockPos((current) => ({
      ...current,
      [drag.id]: {
        x: clamp(pt.x - drag.offsetX, 70, VIEW_W - 70),
        y: clamp(pt.y - drag.offsetY, 34, VIEW_H - 34),
      },
    }));
  };

  const endDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved && drag.onClick) drag.onClick();
    dragRef.current = null;
    setDraggingId(null);
  };

  return { svgRef, blockPos, draggingId, startDrag, onMouseMove, endDrag };
}

function GridBackdrop() {
  return (
    <>
      <rect width={VIEW_W} height={VIEW_H} fill="#F7F7F7" />
      {Array.from({ length: Math.ceil(VIEW_W / 20) + 1 }).map((_, index) => (
        <line key={`v${index}`} x1={index * 20} y1="0" x2={index * 20} y2={VIEW_H} stroke="#D1D5DB" strokeWidth="0.8" />
      ))}
      {Array.from({ length: Math.ceil(VIEW_H / 20) + 1 }).map((_, index) => (
        <line key={`h${index}`} x1="0" y1={index * 20} x2={VIEW_W} y2={index * 20} stroke="#D1D5DB" strokeWidth="0.8" />
      ))}
    </>
  );
}

function ArrowDefs() {
  return (
    <defs>
      <marker id="flowArrowRight" markerWidth="11" markerHeight="11" refX="10" refY="5.5" orient="auto">
        <polygon points="0,0 11,5.5 0,11" fill="#000" />
      </marker>
      <marker id="flowArrowLeft" markerWidth="11" markerHeight="11" refX="1" refY="5.5" orient="auto">
        <polygon points="11,0 0,5.5 11,11" fill="#000" />
      </marker>
    </defs>
  );
}

export function BlowerSymbol({ cx, cy, color = "#111827" }) {
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

export function DraggableCallout({
  drag,
  id,
  anchor,
  width,
  height,
  lines,
  active = true,
  onClick,
  tooltipName,
  tooltipDescription = "",
  isDragging = false,
}) {
  const pos = drag.blockPos[id];
  const { tooltipProps, hoverHandlers } = useDiagramTooltip({
    name: tooltipName || lines.join(" "),
    description: tooltipDescription,
    selected: active,
    isDragging,
  });

  if (!pos) return null;
  return (
    <>
      <g
        style={{ cursor: "move" }}
        onMouseDown={(event) => drag.startDrag(event, id, onClick)}
        opacity={active ? 1 : 0.42}
        {...hoverHandlers}
      >
        <polyline
          points={`${anchor.x},${anchor.y} ${anchor.x},${pos.y} ${pos.x},${pos.y}`}
          fill="none"
          stroke="#111827"
          strokeWidth="1.2"
        />
        <rect
          x={pos.x - width / 2}
          y={pos.y - height / 2}
          width={width}
          height={height}
          rx="8"
          fill="#F3F4F6"
          stroke="#111827"
          strokeWidth="1.2"
        />
        {lines.map((line, index) => (
          <text
            key={index}
            x={pos.x}
            y={pos.y - ((lines.length - 1) * 7) + index * 15 + 4}
            textAnchor="middle"
            fontSize="10"
            fontFamily={T.mono}
            fill="#000"
          >
            {line}
          </text>
        ))}
      </g>
      <DiagramTooltip {...tooltipProps} />
    </>
  );
}

export function FlowSvg({ svgRef, onMouseMove, endDrag, children }) {
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <GridBackdrop />
      <ArrowDefs />
      <g transform={`translate(${CONTENT_OFFSET_X} ${CONTENT_OFFSET_Y})`}>
        {children}
      </g>
    </svg>
  );
}

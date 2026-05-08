import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { T } from "./tokens.js";

const VIEWPORT_MARGIN = 8;
const POINTER_OFFSET = 12;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function DiagramTooltip({
  visible,
  x,
  y,
  name,
  description = "",
  selected,
}) {
  const ref = useRef(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    if (!visible || !ref.current || typeof window === "undefined") return;

    const { offsetWidth, offsetHeight } = ref.current;
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - offsetWidth - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - offsetHeight - VIEWPORT_MARGIN);
    const nextLeft = clamp(x - offsetWidth / 2, VIEWPORT_MARGIN, maxLeft);
    const nextTop = clamp(y - offsetHeight - POINTER_OFFSET, VIEWPORT_MARGIN, maxTop);

    setPosition({ left: nextLeft, top: nextTop });
  }, [visible, x, y, name, description, selected]);

  if (!visible || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        zIndex: 1000,
        pointerEvents: "none",
        minWidth: 180,
        maxWidth: 260,
        borderRadius: 10,
        border: `1px solid ${T.border2}`,
        background: T.surface,
        boxShadow: `0 16px 34px color-mix(in srgb, ${T.text} 18%, transparent)`,
        padding: "10px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div
          style={{
            color: T.text,
            fontFamily: T.sans,
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          {name}
        </div>
        <span
          style={{
            borderRadius: 999,
            padding: "3px 8px",
            background: selected ? T.teal : T.panel,
            color: selected ? T.surface : T.muted,
            fontFamily: T.mono,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {selected ? "Selected" : "Not Selected"}
        </span>
      </div>
      {description ? (
        <div
          style={{
            marginTop: 6,
            color: T.muted,
            fontFamily: T.sans,
            fontSize: 11,
            lineHeight: 1.35,
          }}
        >
          {description}
        </div>
      ) : null}
    </div>,
    document.body
  );
}

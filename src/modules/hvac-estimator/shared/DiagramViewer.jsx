import { useState, useEffect, useRef, useCallback } from "react";
import { T } from "./tokens.js";

export function DiagramViewer({ svgPath, selectedIds = [], allIds = [], fallback = null }) {
  const [svgText, setSvgText] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const containerRef = useRef(null);
  const innerRef = useRef(null);
  const previousSelectedRef = useRef(new Set());

  // Pan/zoom via refs to avoid re-renders during drag
  const xform = useRef({ scale: 1, x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let active = true;
    fetch(svgPath)
      .then(r => {
        if (!active) return null;
        if (!r.ok) { setNotFound(true); setSvgText(null); return null; }
        setNotFound(false);
        return r.text();
      })
      .then(txt => { if (active && txt !== null) setSvgText(txt); })
      .catch(() => { if (active) { setNotFound(true); setSvgText(null); } });
    return () => { active = false; };
  }, [svgPath]);

  // Fit SVG to container on initial load — "meet" shows entire diagram
  useEffect(() => {
    if (!svgText || !innerRef.current) return;
    const svgEl = innerRef.current.querySelector("svg");
    if (svgEl) {
      svgEl.style.width = "100%";
      svgEl.style.height = "100%";
      svgEl.style.display = "block";
      svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }
  }, [svgText]);

  // Dim all, highlight selected
  useEffect(() => {
    if (!svgText || !innerRef.current) return;
    allIds.forEach(id => {
      const el = innerRef.current.querySelector("#" + CSS.escape(id));
      if (el) el.style.opacity = "0.15";
    });
    selectedIds.forEach(id => {
      const el = innerRef.current.querySelector("#" + CSS.escape(id));
      if (el) el.style.opacity = "1";
    });
  }, [svgText, selectedIds, allIds]);

  // Yellow pulse on newly toggled elements
  useEffect(() => {
    if (!svgText || !innerRef.current) return;
    const prev = previousSelectedRef.current;
    const next = new Set(selectedIds);
    const changed = [...new Set([...prev, ...next])].filter(id => prev.has(id) !== next.has(id));
    const esc = v => (window.CSS?.escape ? window.CSS.escape(v) : v.replace(/[^a-zA-Z0-9_-]/g, "\\$&"));
    changed.forEach(id => {
      const el = innerRef.current?.querySelector("#" + esc(id));
      if (!el || typeof el.animate !== "function") return;
      el.animate([
        { filter: "drop-shadow(0 0 0px rgba(250,204,21,0))",    transform: "scale(1)" },
        { filter: "drop-shadow(0 0 8px rgba(250,204,21,0.95))", transform: "scale(1.03)" },
        { filter: "drop-shadow(0 0 0px rgba(250,204,21,0))",    transform: "scale(1)" },
      ], { duration: 500, easing: "ease-out" });
    });
    previousSelectedRef.current = next;
  }, [svgText, selectedIds]);

  const applyTransform = useCallback(() => {
    if (!innerRef.current) return;
    const { scale, x, y } = xform.current;
    innerRef.current.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
  }, []);

  const resetView = useCallback(() => {
    xform.current = { scale: 1, x: 0, y: 0 };
    applyTransform();
  }, [applyTransform]);

  // Wheel zoom toward cursor
  const onWheel = useCallback(e => {
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const t = xform.current;
    const ns = Math.max(0.15, Math.min(12, t.scale * factor));
    const ratio = ns / t.scale;
    xform.current = { scale: ns, x: mx - ratio * (mx - t.x), y: my - ratio * (my - t.y) };
    applyTransform();
  }, [applyTransform]);

  const onMouseDown = useCallback(e => {
    if (e.button !== 0) return;
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    containerRef.current.style.cursor = "grabbing";
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback(e => {
    if (!isDragging.current) return;
    xform.current.x += e.clientX - lastMouse.current.x;
    xform.current.y += e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    applyTransform();
  }, [applyTransform]);

  const stopDrag = useCallback(() => {
    isDragging.current = false;
    if (containerRef.current) containerRef.current.style.cursor = "grab";
  }, []);

  const zoomBy = useCallback((factor) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const t = xform.current;
    const ns = Math.max(0.15, Math.min(12, t.scale * factor));
    const ratio = ns / t.scale;
    xform.current = { scale: ns, x: cx - ratio * (cx - t.x), y: cy - ratio * (cy - t.y) };
    applyTransform();
  }, [applyTransform]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  if (notFound) return fallback;
  if (!svgText) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
      height:"100%", color:T.dim, fontSize:13, fontFamily:T.mono }}>
      Loading…
    </div>
  );

  return (
    <div ref={containerRef}
      style={{ width:"100%", height:"100%", overflow:"hidden", position:"relative",
               cursor:"grab", userSelect:"none" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
      onDoubleClick={resetView}
    >
      <div ref={innerRef}
        style={{ width:"100%", height:"100%", transformOrigin:"0 0" }}
        dangerouslySetInnerHTML={{ __html: svgText }}
      />
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{ position:"absolute", bottom:10, right:10, display:"flex", gap:4, opacity:0.85 }}
      >
        {[
          { label:"+", title:"Zoom in",  onClick:() => zoomBy(1.25) },
          { label:"−", title:"Zoom out", onClick:() => zoomBy(1/1.25) },
          { label:"⊡", title:"Reset zoom (double-click diagram)", onClick:resetView },
        ].map(({ label, title, onClick }) => (
          <button key={label} title={title} onClick={onClick}
            style={{ width:28, height:28, border:"1px solid "+T.border2, borderRadius:4,
                     background:T.surface, color:T.muted, fontSize:15, lineHeight:1,
                     cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

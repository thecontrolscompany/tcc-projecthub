import { useState, useEffect, useRef } from "react";
import { T } from "./tokens.js";

export function DiagramViewer({ svgPath, selectedIds = [], allIds = [], fallback = null }) {
  const [svgText, setSvgText] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const divRef = useRef(null);
  const previousSelectedRef = useRef(new Set());

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

  useEffect(() => {
    if (!svgText || !divRef.current) return;
    allIds.forEach(id => {
      const el = divRef.current.querySelector("#" + CSS.escape(id));
      if (el) el.style.opacity = "0.15";
    });
    selectedIds.forEach(id => {
      const el = divRef.current.querySelector("#" + CSS.escape(id));
      if (el) el.style.opacity = "1";
    });
  }, [svgText, selectedIds, allIds]);

  useEffect(() => {
    if (!svgText || !divRef.current) return;
    const prev = previousSelectedRef.current;
    const next = new Set(selectedIds);
    const changed = [...new Set([...prev, ...next])].filter(id => prev.has(id) !== next.has(id));
    const escapeId = value => (window.CSS?.escape ? window.CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&"));

    changed.forEach(id => {
      const el = divRef.current?.querySelector("#" + escapeId(id));
      if (!el || typeof el.animate !== "function") return;
      el.animate([
        { filter: "drop-shadow(0 0 0px rgba(250, 204, 21, 0))", transform: "scale(1)" },
        { filter: "drop-shadow(0 0 8px rgba(250, 204, 21, 0.95))", transform: "scale(1.03)" },
        { filter: "drop-shadow(0 0 0px rgba(250, 204, 21, 0))", transform: "scale(1)" },
      ], {
        duration: 500,
        easing: "ease-out",
      });
    });

    previousSelectedRef.current = next;
  }, [svgText, selectedIds]);

  if (notFound) return fallback;
  if (!svgText) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
      height:"100%", color:T.dim, fontSize:13, fontFamily:T.mono }}>
      Loading…
    </div>
  );

  return (
    <div ref={divRef}
      style={{ width:"100%", height:"100%", overflow:"auto" }}
      dangerouslySetInnerHTML={{ __html: svgText }}
    />
  );
}

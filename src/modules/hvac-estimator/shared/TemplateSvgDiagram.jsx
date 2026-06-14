import { useEffect, useMemo, useRef, useState } from "react";

// Module-level cache: SVG text is fetched once per session per path.
// Subsequent mounts read from memory — no round-trip, no loading flash.
const _svgCache = new Map();

function applyVisibility(svgText, visibility = {}) {
  if (typeof window === "undefined" || !window.DOMParser) {
    return svgText;
  }

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const root = doc.documentElement;

  if (!root || root.nodeName === "parsererror") {
    return svgText;
  }

  root.setAttribute("width", "100%");
  root.setAttribute("height", "100%");
  root.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const allNodes = Array.from(doc.querySelectorAll("*"));

  const findNode = key => {
    const byId = doc.getElementById(key);
    if (byId) return byId;
    return allNodes.find(node =>
      node.getAttribute("inkscape:label") === key ||
      node.getAttribute("label") === key
    );
  };

  Object.entries(visibility).forEach(([id, isVisible]) => {
    const node = findNode(id);
    if (!node) return;
    const existingStyle = node.getAttribute("style") || "";
    const cleanedStyle = existingStyle
      .split(";")
      .map(part => part.trim())
      .filter(part => part && !part.startsWith("display:"))
      .join("; ");
    const nextStyle = `${cleanedStyle}${cleanedStyle ? "; " : ""}display:${isVisible ? "inline" : "none"}`;
    node.setAttribute("style", nextStyle);
  });

  return root.outerHTML;
}

export function TemplateSvgDiagram({
  svgPath,
  visibility,
  fallback,
}) {
  const [svgText, setSvgText] = useState(() => _svgCache.get(svgPath) ?? null);
  const [missing, setMissing] = useState(false);
  const containerRef = useRef(null);
  const previousVisibilityRef = useRef({});

  // Fetch the raw SVG once per path. Already-cached paths resolve immediately
  // from the useState initializer above — no async, no flash on re-open.
  useEffect(() => {
    if (_svgCache.has(svgPath)) {
      setSvgText(_svgCache.get(svgPath));
      setMissing(false);
      return;
    }

    let cancelled = false;

    fetch(svgPath, { cache: "no-store" })
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(text => {
        if (!cancelled) {
          _svgCache.set(svgPath, text);
          setSvgText(text);
        }
      })
      .catch(() => { if (!cancelled) setMissing(true); });

    return () => { cancelled = true; };
  }, [svgPath]);

  // Stable key so applyVisibility only re-runs when visibility actually changes,
  // not on every parent render that passes a new object reference
  const visibilityKey = JSON.stringify(visibility || {});

  // Apply visibility synchronously whenever selections change — no fetch, no flash
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const markup = useMemo(
    () => svgText ? applyVisibility(svgText, JSON.parse(visibilityKey)) : null,
    [svgText, visibilityKey]
  );

  useEffect(() => {
    if (!containerRef.current || !svgText) return;
    const current = JSON.parse(visibilityKey || "{}");
    const previous = previousVisibilityRef.current || {};
    const changedIds = new Set([
      ...Object.keys(previous),
      ...Object.keys(current),
    ].filter((id) => Boolean(previous[id]) !== Boolean(current[id])));

    const escapeId = (value) => (window.CSS?.escape ? window.CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&"));

    changedIds.forEach((id) => {
      const el = containerRef.current?.querySelector("#" + escapeId(id));
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

    previousVisibilityRef.current = current;
  }, [svgText, visibilityKey]);

  if (missing || !markup) {
    return fallback;
  }

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%" }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

import { useState, useCallback, useRef, useEffect } from "react";

const MIN_W = 210;
const MAX_W = 560;
const DEFAULT_W = 268;
const LS_KEY = "tcc_sidebar_width";

export function useSidebarWidth(pageKey = "default") {
  const [width, setWidth] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      const w = stored[pageKey];
      return (w && w >= MIN_W && w <= MAX_W) ? w : DEFAULT_W;
    } catch { return DEFAULT_W; }
  });

  const persist = useCallback((w) => {
    try {
      const stored = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      localStorage.setItem(LS_KEY, JSON.stringify({ ...stored, [pageKey]: w }));
    } catch { /* ignore localStorage errors */ }
  }, [pageKey]);

  const isDragging = useRef(false);
  const startX     = useRef(0);
  const startW     = useRef(0);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return;
      // With the sidebar on the left, dragging right should make it bigger.
      const delta = e.clientX - startX.current;
      const newW  = Math.max(MIN_W, Math.min(MAX_W, startW.current + delta));
      setWidth(newW);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Persist on mouse-up
      setWidth(w => { persist(w); return w; });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [persist]);

  return { width, onMouseDown };
}

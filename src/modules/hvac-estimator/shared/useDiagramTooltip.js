import { useEffect, useMemo, useRef, useState } from "react";

function distanceBetween(pointA, pointB) {
  const dx = pointA.x - pointB.x;
  const dy = pointA.y - pointB.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function useDiagramTooltip({
  name,
  description = "",
  selected,
  delay = 900,
  threshold = 6,
  isDragging = false,
}) {
  const timerRef = useRef(null);
  const anchorRef = useRef(null);
  const pointerRef = useRef(null);
  const [tooltipState, setTooltipState] = useState({
    visible: false,
    x: 0,
    y: 0,
  });

  const clearHoverTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const showTooltip = () => {
    if (!pointerRef.current || isDragging) return;
    setTooltipState({
      visible: true,
      x: pointerRef.current.x,
      y: pointerRef.current.y,
    });
  };

  const startHoverTimer = () => {
    clearHoverTimer();
    if (!anchorRef.current || isDragging) return;
    timerRef.current = window.setTimeout(showTooltip, delay);
  };

  const hideTooltip = () => {
    clearHoverTimer();
    setTooltipState((current) => (current.visible ? { ...current, visible: false } : current));
  };

  useEffect(() => {
    if (!isDragging) return;
    hideTooltip();
  }, [isDragging]);

  useEffect(() => () => clearHoverTimer(), []);

  const hoverHandlers = useMemo(
    () => ({
      onMouseEnter(event) {
        if (isDragging) return;
        const point = { x: event.clientX, y: event.clientY };
        anchorRef.current = point;
        pointerRef.current = point;
        startHoverTimer();
      },
      onMouseMove(event) {
        if (isDragging) {
          hideTooltip();
          return;
        }

        const point = { x: event.clientX, y: event.clientY };
        pointerRef.current = point;

        if (!anchorRef.current) {
          anchorRef.current = point;
          startHoverTimer();
          return;
        }

        if (distanceBetween(point, anchorRef.current) > threshold) {
          anchorRef.current = point;
          hideTooltip();
          startHoverTimer();
          return;
        }

        setTooltipState((current) =>
          current.visible
            ? {
                ...current,
                x: point.x,
                y: point.y,
              }
            : current
        );
      },
      onMouseLeave() {
        anchorRef.current = null;
        pointerRef.current = null;
        hideTooltip();
      },
    }),
    [isDragging, threshold]
  );

  return {
    tooltipProps: {
      visible: tooltipState.visible && !isDragging,
      x: tooltipState.x,
      y: tooltipState.y,
      name,
      description,
      selected,
    },
    hoverHandlers,
  };
}

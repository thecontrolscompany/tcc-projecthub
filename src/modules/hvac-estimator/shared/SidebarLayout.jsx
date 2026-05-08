import { useState } from "react";
import { T } from "./tokens.js";
import { useSidebarWidth } from "./useSidebarWidth.js";
import { useIsMobile } from "./useIsMobile.js";

/**
 * SidebarLayout
 *
 * Wraps a schematic page's two-panel layout (main content + right sidebar)
 * with a draggable resize handle between them.
 *
 * Props:
 *   pageKey   — string key for localStorage persistence (e.g. "vav", "ahu")
 *   main      — JSX for the left/main area
 *   sidebar   — JSX for the right panel content (receives width as a style prop)
 */
export function SidebarLayout({ pageKey, main, sidebar, mobileBadge }) {
  const { width, onMouseDown } = useSidebarWidth(pageKey);
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isMobile) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {/* Main content full width */}
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          {main}
        </div>

        {/* Floating toggle button */}
        <button
          onClick={() => setSheetOpen(s => !s)}
          style={{
            position: "fixed", bottom: 20, right: 20, zIndex: 50,
            background: sheetOpen ? T.steel : T.blue,
            color: "#fff", border: "none", borderRadius: 8,
            padding: "11px 18px", fontSize: 13, fontFamily: T.mono,
            cursor: "pointer", fontWeight: 700,
            boxShadow: "0 4px 16px rgba(0,0,0,0.28)",
          }}
        >
          {sheetOpen ? "✕ Close" : ("☰ Components" + (mobileBadge ? " · " + mobileBadge : ""))}
        </button>

        {/* Bottom sheet backdrop */}
        {sheetOpen && (
          <div
            onClick={() => setSheetOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.35)" }}
          />
        )}

        {/* Bottom sheet */}
        {sheetOpen && (
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 41,
            height: "72vh", background: T.surface,
            borderTop: "2px solid " + T.border,
            borderRadius: "12px 12px 0 0",
            display: "flex", flexDirection: "column", overflow: "hidden",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
          }}>
            {/* Drag handle pill */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border2 }} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {sidebar}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

      {/* Sidebar */}
      <div style={{
        width,
        minWidth: width,
        maxWidth: width,
        background: T.surface,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        {sidebar}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        title="Drag to resize"
        style={{
          width: 6,
          flexShrink: 0,
          background: "transparent",
          borderRight: "1px solid " + T.border,
          cursor: "col-resize",
          position: "relative",
          zIndex: 10,
          transition: "background 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = T.blueMidA60}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        {/* Visual grip dots */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          gap: 3,
          pointerEvents: "none",
        }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              width: 3,
              height: 3,
              borderRadius: "50%",
              background: T.border2,
            }}/>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        {main}
      </div>
    </div>
  );
}

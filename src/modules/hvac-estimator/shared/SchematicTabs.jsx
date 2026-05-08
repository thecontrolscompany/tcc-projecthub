import { useState } from "react";
import { T } from "./tokens.js";

const DEFAULT_TABS = [
  { id: "flow",   label: "Flow Diagram" },
  { id: "elec",   label: "Electrical" },
  { id: "points", label: "Points List" },
];

export function SchematicTabs({ tabs = DEFAULT_TABS, children }) {
  const [active, setActive] = useState(tabs[0].id);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ display:"flex", borderBottom:"1px solid "+T.border, flexShrink:0, background:T.surface }}>
        {tabs.map(tab => {
          const isActive = active === tab.id;
          return (
            <button key={tab.id} onClick={() => setActive(tab.id)} style={{
              padding: "7px 16px",
              border: "none",
              borderBottom: "2px solid " + (isActive ? T.blue : "transparent"),
              background: "none",
              color: isActive ? T.blue : T.muted,
              fontFamily: T.mono,
              fontSize: 11,
              fontWeight: isActive ? 700 : 400,
              cursor: "pointer",
              letterSpacing: 0.5,
              marginBottom: -1,
              outline: "none",
            }}>
              {tab.label}
            </button>
          );
        })}
      </div>
      <div style={{ flex:1, overflow:"hidden", minHeight:0 }}>
        {children[active]}
      </div>
    </div>
  );
}

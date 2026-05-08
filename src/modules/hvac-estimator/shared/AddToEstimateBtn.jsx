import { useState } from "react";
import { T } from "./tokens.js";
import { useEstimate } from "./EstimateContext.jsx";

export function AddToEstimateBtn({ type, tag, location, cfg, selected, custom, qty, installType }) {
  const { activeId, activeEstimate, addItem, updateItem, editingItem } = useEstimate();
  const [flash, setFlash] = useState(false);

  const isEditing = !!editingItem;

  const handle = () => {
    if (!activeId) return;
    let ok;
    if (isEditing) {
      ok = updateItem(editingItem.id, type, tag, location, cfg, selected, custom, qty, installType);
    } else {
      ok = addItem(type, tag, location, cfg, selected, custom, qty, installType);
    }
    if (ok) {
      setFlash(true);
      setTimeout(() => setFlash(false), 1800);
    }
  };

  if (!activeId) return (
    <div style={{ fontSize:11, color:T.dim, fontFamily:T.mono,
      padding:"5px 10px", background:T.panel, borderRadius:4,
      border:"1px solid "+T.border }}>
      No active estimate
    </div>
  );

  return (
    <button onClick={handle} style={{
      padding:"6px 14px", border:"none", borderRadius:5, cursor:"pointer",
      background: flash ? "#16A34A" : isEditing ? "#7C3AED" : T.blue,
      color:"#fff", fontSize:12, fontFamily:T.mono, fontWeight:700,
      transition:"background 0.2s", whiteSpace:"nowrap" }}>
      {flash
        ? (isEditing ? "✓ Saved!" : "✓ Added!")
        : isEditing
          ? `Save Changes`
          : `+ Add to ${activeEstimate?.name || "Estimate"}`}
    </button>
  );
}
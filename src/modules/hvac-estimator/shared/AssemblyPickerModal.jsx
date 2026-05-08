import { useState } from "react";
import { T } from "./tokens.js";
import { fmt$, fmtHr, uid } from "./utils.js";
import { calcAssembly } from "./assemblyData.js";
import { getAssemblyAid, toAllAssemblyOptions } from "./assemblyPicker.js";

export function AssemblyPickerModal({
  title = "Add Assembly",
  emptyText = "No assemblies match that search.",
  category = "Assembly",
  installType,
  options,
  onAdd,
  onClose,
}) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [mtlAmt, setMtlAmt] = useState("");
  const [lbrAmt, setLbrAmt] = useState("");

  const activeOptions = showAll ? toAllAssemblyOptions(installType) : (options || []);
  const filtered = activeOptions.filter(asm =>
    !query.trim() || asm.label.toLowerCase().includes(query.trim().toLowerCase())
  );
  const selectedAsm = filtered[selectedIdx] || filtered[0] || null;
  const selectedCost = selectedAsm
    ? calcAssembly(getAssemblyAid(selectedAsm, installType))
    : { mtl: 0, lbr: 0 };

  const addMtl = () => {
    const amt = parseFloat(mtlAmt);
    if (!amt) return;
    onAdd({ id: uid(), name: "Material", cat: "Custom", category: "Custom",
      unitMtl: amt, unitLbr: 0, extraMtl: 0, extraLbr: 0, notes: "", isCustom: true });
  };

  const addLbr = () => {
    const amt = parseFloat(lbrAmt);
    if (!amt) return;
    onAdd({ id: uid(), name: "Labor", cat: "Custom", category: "Custom",
      unitMtl: 0, unitLbr: amt, extraMtl: 0, extraLbr: 0, notes: "", isCustom: true });
  };

  const inputStyle = {
    width: "100%", padding: "5px 28px 5px 8px", border: "1px solid " + T.border2,
    borderRadius: 4, fontSize: 12, fontFamily: T.mono, background: T.surface,
    color: T.text, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.4)", zIndex:500,
      display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:T.surface, border:"1px solid "+T.border, borderRadius:10,
        padding:"22px", width:520, boxShadow:"0 20px 60px rgba(0,0,0,0.15)",
        maxHeight:"90vh", display:"flex", flexDirection:"column", gap:0 }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14, flexShrink:0 }}>
          <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{title}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, color:T.muted, cursor:"pointer" }}>×</button>
        </div>

        {/* Quick add: Material + Labor */}
        <div style={{ display:"flex", gap:8, marginBottom:12, padding:"10px 12px",
          background:T.bg, border:"1px solid "+T.border, borderRadius:6, flexShrink:0 }}>
          <div style={{ flex:1, display:"flex", gap:6, alignItems:"center" }}>
            <div style={{ position:"relative", flex:1 }}>
              <input value={mtlAmt} onChange={e => setMtlAmt(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addMtl()}
                placeholder="0.00" style={inputStyle} />
              <span style={{ position:"absolute", right:7, top:"50%", transform:"translateY(-50%)",
                fontSize:9, color:T.muted, fontFamily:T.mono }}>$</span>
            </div>
            <button onClick={addMtl} disabled={!parseFloat(mtlAmt)}
              style={{ padding:"5px 10px", border:"none", borderRadius:4, whiteSpace:"nowrap",
                background:parseFloat(mtlAmt) ? T.blue : T.faint,
                color:parseFloat(mtlAmt) ? "#fff" : T.dim,
                cursor:parseFloat(mtlAmt) ? "pointer" : "default",
                fontSize:11, fontFamily:T.mono, fontWeight:600 }}>
              + Material
            </button>
          </div>
          <div style={{ flex:1, display:"flex", gap:6, alignItems:"center" }}>
            <div style={{ position:"relative", flex:1 }}>
              <input value={lbrAmt} onChange={e => setLbrAmt(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addLbr()}
                placeholder="0.00" style={inputStyle} />
              <span style={{ position:"absolute", right:7, top:"50%", transform:"translateY(-50%)",
                fontSize:9, color:T.muted, fontFamily:T.mono }}>h</span>
            </div>
            <button onClick={addLbr} disabled={!parseFloat(lbrAmt)}
              style={{ padding:"5px 10px", border:"none", borderRadius:4, whiteSpace:"nowrap",
                background:parseFloat(lbrAmt) ? T.amber : T.faint,
                color:parseFloat(lbrAmt) ? "#fff" : T.dim,
                cursor:parseFloat(lbrAmt) ? "pointer" : "default",
                fontSize:11, fontFamily:T.mono, fontWeight:600 }}>
              + Labor
            </button>
          </div>
        </div>

        {/* Divider */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexShrink:0 }}>
          <div style={{ flex:1, height:1, background:T.border }} />
          <span style={{ fontSize:10, color:T.muted, fontFamily:T.mono,
            textTransform:"uppercase", letterSpacing:1 }}>or pick an assembly</span>
          <div style={{ flex:1, height:1, background:T.border }} />
        </div>

        {/* Search + toggle */}
        <div style={{ display:"flex", gap:8, marginBottom:8, flexShrink:0 }}>
          <input value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            placeholder="Search assemblies..."
            style={{ flex:1, padding:"6px 10px", border:"1px solid "+T.border2, borderRadius:4,
              fontSize:12, fontFamily:T.mono, background:T.bg, color:T.text, outline:"none" }} />
          <button onClick={() => { setShowAll(v => !v); setSelectedIdx(0); setQuery(""); }}
            style={{ padding:"6px 10px", borderRadius:4, whiteSpace:"nowrap",
              border:"1px solid "+(showAll ? T.blue : T.border2),
              background:showAll ? T.blueFaint : "none",
              color:showAll ? T.blue : T.muted,
              cursor:"pointer", fontSize:11, fontFamily:T.mono }}>
            {showAll ? "Standard only" : "All assemblies"}
          </button>
        </div>

        {/* Assembly list */}
        <select
          size={7}
          value={selectedAsm ? String(filtered.findIndex(a => a.label === selectedAsm.label)) : "0"}
          onChange={e => setSelectedIdx(parseInt(e.target.value, 10) || 0)}
          style={{ width:"100%", padding:"6px", border:"1px solid "+T.border2, borderRadius:4,
            fontSize:12, fontFamily:T.mono, background:T.bg, color:T.text, outline:"none",
            marginBottom:10, flexShrink:0 }}>
          {filtered.map((asm, idx) => (
            <option key={`${asm.label}-${asm.emtAID || ""}-${idx}`} value={idx}>
              {asm.label}
            </option>
          ))}
        </select>
        {!filtered.length && (
          <div style={{ fontSize:12, color:T.dim, marginBottom:10, flexShrink:0 }}>{emptyText}</div>
        )}

        {/* Cost preview */}
        {selectedAsm && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8,
            marginBottom:12, flexShrink:0 }}>
            <div style={{ padding:"7px 10px", border:"1px solid "+T.border,
              borderRadius:5, background:T.bg }}>
              <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono,
                textTransform:"uppercase", letterSpacing:1 }}>Assembly</div>
              <div style={{ fontSize:12, color:T.text, fontWeight:600,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {selectedAsm.label}
              </div>
              <div style={{ fontSize:10, color:T.dim, fontFamily:T.mono }}>{installType} pricing</div>
            </div>
            <div style={{ padding:"7px 10px", border:"1px solid "+T.border,
              borderRadius:5, background:T.bg }}>
              <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono,
                textTransform:"uppercase", letterSpacing:1 }}>Cost</div>
              <div style={{ fontSize:12, fontFamily:T.mono }}>
                <span style={{ color:T.blue, fontWeight:700 }}>{fmt$(selectedCost.mtl)}</span>
                <span style={{ color:T.dim, marginLeft:10 }}>{fmtHr(selectedCost.lbr)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end", flexShrink:0 }}>
          <button onClick={onClose}
            style={{ padding:"7px 16px", border:"1px solid "+T.border2, borderRadius:5,
              background:"none", color:T.muted, cursor:"pointer", fontSize:13 }}>
            Cancel
          </button>
          <button
            onClick={() => {
              if (!selectedAsm) return;
              onAdd({
                id: uid(),
                name: selectedAsm.label,
                cat: selectedAsm.cat || "Custom",
                category,
                unitMtl: 0, unitLbr: 0,
                extraMtl: 0, extraLbr: 0,
                notes: "", isCustom: true,
                emtAID: selectedAsm.emtAID,
                plnAID: selectedAsm.plnAID,
              });
            }}
            disabled={!selectedAsm}
            style={{ padding:"7px 16px", border:"none", borderRadius:5,
              background:selectedAsm ? T.blue : T.faint,
              color:selectedAsm ? "#fff" : T.dim,
              cursor:selectedAsm ? "pointer" : "default",
              fontSize:13, fontWeight:600 }}>
            Add Assembly
          </button>
        </div>

      </div>
    </div>
  );
}

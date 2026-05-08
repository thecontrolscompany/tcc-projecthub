import { T, CAT_COLOR } from "./tokens.js";
import { fmt$, fmtHr } from "./utils.js";
import { calcAssembly } from "./assemblyData.js";

function toAbbrev(name) {
  return name.replace(/[^A-Za-z\s]/g, "").trim().split(/\s+/).map(w => w[0]).join("").toUpperCase();
}

function th(txt, right) {
  return (
    <th style={{
      padding: "6px 10px",
      fontSize: 9,
      fontFamily: T.mono,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: T.muted,
      fontWeight: 500,
      borderBottom: "2px solid " + T.border,
      textAlign: right ? "right" : "left",
      whiteSpace: "nowrap",
      background: T.panel,
    }}>
      {txt}
    </th>
  );
}

export function PointsList({ comps, selected, installType = "Plenum", tag = "" }) {
  const rows = selected.map((s, i) => {
    const comp = comps.find(c => c.id === s.id);
    if (!comp) return null;
    const aid = installType === "EMT" ? comp.emtAID : comp.plnAID;
    let mtl = comp.unitMtl ?? 0;
    let lbr = comp.unitLbr ?? 0;
    if (aid) {
      try {
        const asm = calcAssembly(String(aid));
        if (asm.mtl) mtl = asm.mtl;
        if (asm.lbr) lbr = asm.lbr;
      } catch { /* use inline fallback */ }
    }
    const qty = s.qty ?? 1;
    const abbrev = toAbbrev(comp.name);
    const pointTag = tag ? `${tag}.${abbrev}` : abbrev;
    const wire = comp.wire ?? "18/2";
    return { idx: i + 1, comp, qty, mtl, lbr, pointTag, subtotal: mtl * qty, wire };
  }).filter(Boolean);

  if (rows.length === 0) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
        height:"100%", color:T.muted, fontSize:13, fontFamily:T.mono }}>
        No components selected
      </div>
    );
  }

  const totalMtl = rows.reduce((a, r) => a + r.subtotal, 0);
  const totalLbr = rows.reduce((a, r) => a + r.lbr * r.qty, 0);

  return (
    <div style={{ height:"100%", overflow:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
        <thead>
          <tr>
            {th("#")}
            {th("Tag")}
            {th("Point Name")}
            {th("Category")}
            {th("Wire")}
            {th("Qty", true)}
            {th("Mtl $", true)}
            {th("Lbr Hrs", true)}
            {th("Subtotal $", true)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const color = CAT_COLOR[r.comp.cat] || T.steel;
            return (
              <tr key={r.comp.id} style={{ borderBottom:"1px solid "+T.border }}>
                <td style={{ padding:"5px 10px", color:T.dim, fontFamily:T.mono, fontSize:11 }}>{r.idx}</td>
                <td style={{ padding:"5px 10px", fontFamily:T.mono, fontSize:11, color:T.blue, whiteSpace:"nowrap" }}>{r.pointTag}</td>
                <td style={{ padding:"5px 10px", color:T.text, whiteSpace:"nowrap" }}>{r.comp.name}</td>
                <td style={{ padding:"5px 10px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:color, flexShrink:0 }}/>
                    <span style={{ color:T.muted, fontSize:11 }}>{r.comp.cat}</span>
                  </div>
                </td>
                <td style={{ padding:"5px 10px", fontFamily:T.mono, fontSize:11, color:r.wire === "—" ? T.dim : T.text, whiteSpace:"nowrap" }}>{r.wire}</td>
                <td style={{ padding:"5px 10px", textAlign:"right", fontFamily:T.mono, color:T.text }}>{r.qty}</td>
                <td style={{ padding:"5px 10px", textAlign:"right", fontFamily:T.mono, color:T.text }}>{fmt$(r.mtl)}</td>
                <td style={{ padding:"5px 10px", textAlign:"right", fontFamily:T.mono, color:T.text }}>{fmtHr(r.lbr)}</td>
                <td style={{ padding:"5px 10px", textAlign:"right", fontFamily:T.mono, fontWeight:700, color:T.blue }}>{fmt$(r.subtotal)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop:"2px solid "+T.border, background:T.panel }}>
            <td colSpan={5} style={{ padding:"6px 10px", fontSize:11, fontFamily:T.mono,
              color:T.muted, textTransform:"uppercase", letterSpacing:1 }}>
              Total ({rows.length} point{rows.length !== 1 ? "s" : ""})
            </td>
            <td style={{ padding:"6px 10px", textAlign:"right", fontFamily:T.mono, color:T.text }}/>
            <td style={{ padding:"6px 10px", textAlign:"right", fontFamily:T.mono, fontWeight:700, color:T.text }}>{fmt$(totalMtl)}</td>
            <td style={{ padding:"6px 10px", textAlign:"right", fontFamily:T.mono, fontWeight:700, color:T.text }}>{fmtHr(totalLbr)}</td>
            <td style={{ padding:"6px 10px", textAlign:"right", fontFamily:T.mono, fontWeight:700, color:T.blue }}>{fmt$(totalMtl)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}


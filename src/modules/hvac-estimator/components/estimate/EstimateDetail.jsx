import { Fragment, useCallback, useMemo, useState } from "react";
import { useIsMobile } from "../../shared/useIsMobile.js";
import { generateProposal } from "./export/generateProposal.js";
import { generateInternalEstimateExport } from "./export/generateInternalEstimateExport.js";
import { T } from "../../shared/tokens.js";
import { fmt$, fmtHr } from "../../shared/utils.js";
import { DEFAULT_SETTINGS, computeCosts } from "./projectSettings.js";
import { useEstimate } from "../../shared/EstimateContext.jsx";
import { getCurrentUser } from "../../shared/currentUser.js";
import { AHU_TYPES } from "../ahu/ahuData.js";
import { AddEquipButtons } from "./AddEquipButtons.jsx";
import { ProjectSettingsPanel } from "./ProjectSettingsPanel.jsx";
import {
  TYPE_META,
  buildItemsWithComps,
  calcEstimate,
  calcItem,
  fmtAuditDate,
  getItemDetails,
} from "./estimateCalc.js";
export function EstimateDetail({ estimate, onBack, onUpdate, customerMode = false }) {
  const { setSubPage, applyDefaultInstallType } = useEstimate();
  const isMobile = useIsMobile();
  const [editHeader, setEditHeader] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [name,setName]         = useState(estimate.name);
  const [number,setNumber]     = useState(estimate.number||"");
  const [customer,setCustomer] = useState(estimate.customer||"");
  const [version,setVersion]   = useState(estimate.version||"");
  const [notes,setNotes]       = useState(estimate.notes||"");
  const createdBy = estimate.createdBy?.name || estimate.createdBy?.email || "";
  const updatedBy = estimate.updatedBy?.name || estimate.updatedBy?.email || createdBy;
  const updatedOn = fmtAuditDate(estimate.updatedAt);

  // Settings live in estimate.settings, merged with defaults
  const settings = useMemo(() => {
    const stored = estimate.settings || {};
    return { ...DEFAULT_SETTINGS, ...stored };
  }, [estimate.settings]);
  const updateSettings = useCallback((patch) => {
    onUpdate({ ...estimate, updatedAt: new Date().toISOString(),
      settings: { ...settings, ...patch } });
  }, [estimate, settings, onUpdate]);

  const totals     = calcEstimate(estimate);
  const costs      = useMemo(() => computeCosts(totals.mtl, totals.lbrHrs, settings, estimate.items||[]), [totals.mtl, totals.lbrHrs, settings, estimate.items]);
  const grandTotal = costs.total;

  const saveHeader = () => {
    onUpdate({...estimate, name, number, customer, version, notes, updatedAt:new Date().toISOString()});
    setEditHeader(false);
  };

  const updateItem = (itemId, changes) =>
    onUpdate({...estimate, updatedAt:new Date().toISOString(),
      items: estimate.items.map(it => it.id===itemId ? {...it,...changes} : it)});

  const removeItem = itemId =>
    onUpdate({...estimate, updatedAt:new Date().toISOString(),
      items: estimate.items.filter(it => it.id!==itemId)});

  const moveItem = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= estimate.items.length || fromIndex === toIndex) return;
    const items = [...estimate.items];
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    onUpdate({
      ...estimate,
      updatedAt: new Date().toISOString(),
      items,
    });
  };

  const [exporting, setExporting] = useState(false);
  const exportProposal = useCallback(async () => {
    setExporting(true);
    try {
      const itemsWithComps = buildItemsWithComps(estimate);
      await generateProposal(estimate, itemsWithComps, grandTotal, costs.bond);
    } catch (err) {
      console.error("Proposal export failed:", err);
      alert("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  }, [estimate, grandTotal, costs.bond]);

  const exportInternal = useCallback(() => {
    try {
      generateInternalEstimateExport(estimate, costs, getCurrentUser());
    } catch (err) {
      console.error("Internal export failed:", err);
      alert("Internal export failed: " + err.message);
    }
  }, [estimate, costs]);

  const toggleRowDetails = useCallback((itemId) => {
    setExpandedRows(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  }, []);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

      {/* ── TOP HEADER BAR ── */}
      <div style={{ padding:"14px 24px", borderBottom:"1px solid "+T.border,
        background:T.surface, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <button onClick={onBack} style={{ background:"none", border:"1px solid "+T.border,
            borderRadius:4, color:T.muted, cursor:"pointer", fontSize:12,
            fontFamily:T.mono, padding:"4px 10px", whiteSpace:"nowrap" }}>← All Estimates</button>

          {!customerMode && <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
            <button onClick={exportProposal} disabled={exporting||!estimate.items?.length}
              title="Generate customer proposal (.html)"
              style={{ display:"flex", alignItems:"center", gap:5,
                padding:"7px 13px", border:"none", borderRadius:5,
                background:estimate.items?.length?"#01766A":T.faint,
                color:estimate.items?.length?"#fff":T.dim,
                cursor:estimate.items?.length?"pointer":"default",
                fontSize:12, fontWeight:600, fontFamily:T.mono, whiteSpace:"nowrap",
                opacity:exporting?0.7:1 }}>
              {exporting?"⏳ Generating…":"📄 Generate Proposal"}
            </button>
            <button onClick={exportInternal} disabled={!estimate.items?.length}
              title="Generate readable internal estimate report (.html)"
              style={{ display:"flex", alignItems:"center", gap:5,
                padding:"7px 13px", border:"1px solid "+T.border2, borderRadius:5,
                background:estimate.items?.length?T.surface:T.faint,
                color:estimate.items?.length?T.text:T.dim,
                cursor:estimate.items?.length?"pointer":"default",
                fontSize:12, fontWeight:600, fontFamily:T.mono, whiteSpace:"nowrap" }}>
              🗂 Internal Report
            </button>
          </div>}

          {!editHeader ? (
            <>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:2 }}>
                  <span style={{ fontSize:15, fontWeight:700, color:T.text }}>{estimate.name}</span>
                  {estimate.number && <span style={{ fontSize:11, color:T.muted, background:T.panel,
                    padding:"1px 6px", borderRadius:8, fontFamily:T.mono, border:"1px solid "+T.border }}>
                    #{estimate.number}</span>}
                  {estimate.version && <span style={{ fontSize:11, color:T.blue, background:T.blueFaint,
                    padding:"1px 6px", borderRadius:8, fontFamily:T.mono, border:"1px solid "+T.blueMid }}>
                    v{estimate.version}</span>}
                  {estimate.customer && <span style={{ fontSize:12, color:T.muted }}>· {estimate.customer}</span>}
                  <button onClick={()=>setEditHeader(true)} style={{ background:"none", border:"none",
                    color:T.dim, cursor:"pointer", fontSize:11, fontFamily:T.mono }}>✏ edit</button>
                </div>
                {estimate.notes && <div style={{ fontSize:11, color:T.muted, fontStyle:"italic" }}>{estimate.notes}</div>}
                {(createdBy || updatedBy) && (
                  <div style={{ fontSize:10, color:T.dim, fontFamily:T.mono, marginTop:3 }}>
                    {createdBy && `Created by ${createdBy}`}
                    {createdBy && updatedBy && " | "}
                    {updatedBy && `Last updated by ${updatedBy}${updatedOn ? ` on ${updatedOn}` : ""}`}
                  </div>
                )}
              </div>

              {/* 4-bucket totals pill */}
              <div style={{ display:"flex", gap:0, background:T.panel, border:"1px solid "+T.border,
                borderRadius:7, overflow:"hidden", flexShrink:0, fontSize:11, fontFamily:T.mono }}>
                {[
                  { label:"Labor",    val:costs.labor,    color:T.steel  },
                  { label:"Material", val:costs.material, color:T.blue   },
                  { label:"Overhead", val:costs.overhead, color:"#7C3AED" },
                  { label:"Profit",   val:costs.profit,   color:T.green  },
                ].map(({label,val,color}) => (
                  <div key={label} style={{ padding:"5px 12px", textAlign:"center",
                    borderRight:"1px solid "+T.border }}>
                    <div style={{ fontSize:9, color:T.muted, textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
                    <div style={{ fontWeight:700, color }}>{fmt$(val)}</div>
                  </div>
                ))}
                <div style={{ padding:"5px 12px", textAlign:"center" }}>
                  <div style={{ fontSize:9, color:T.muted, textTransform:"uppercase", letterSpacing:1 }}>Total</div>
                  <div style={{ fontWeight:700, fontSize:13, color:T.text }}>{fmt$(costs.total)}</div>
                </div>
              </div>

              {/* Add equipment + Settings */}
              <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                <AddEquipButtons
                  onAdd={type => setSubPage({type})}
                />
                {!customerMode && <button onClick={()=>setShowSettings(s=>!s)}
                  title="Project settings"
                  style={{ padding:"7px 10px", border:"1px solid "+(showSettings?T.blue:T.border2),
                    borderRadius:5, background:showSettings?T.blueFaint:"none",
                    color:showSettings?T.blue:T.muted, cursor:"pointer", fontSize:12,
                    fontFamily:T.mono, fontWeight:600 }}>
                  ⚙ Settings
                </button>}
              </div>
            </>
          ) : (
            <div style={{ flex:1, display:"flex", flexWrap:"wrap", gap:8, alignItems:"flex-end" }}>
              {[["Name",name,setName,200],["Est #",number,setNumber,100],
                ["Customer",customer,setCustomer,160],["Version",version,setVersion,80]].map(([lbl,val,fn,w])=>(
                <div key={lbl}>
                  <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>{lbl}</div>
                  <input value={val} onChange={e=>fn(e.target.value)}
                    style={{ width:w, padding:"5px 8px", border:"1px solid "+T.border2, borderRadius:4,
                      fontSize:13, color:T.text, outline:"none", background:T.bg }}/>
                </div>
              ))}
              <div style={{ flex:"1 1 100%" }}>
                <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>Notes</div>
                <input value={notes} onChange={e=>setNotes(e.target.value)}
                  style={{ width:"100%", padding:"5px 8px", border:"1px solid "+T.border2, borderRadius:4,
                    fontSize:13, color:T.text, outline:"none", background:T.bg, boxSizing:"border-box" }}/>
              </div>
              <button onClick={saveHeader} style={{ padding:"6px 16px", border:"none", borderRadius:4,
                background:T.blue, color:"#fff", cursor:"pointer", fontSize:13 }}>Save</button>
              <button onClick={()=>setEditHeader(false)} style={{ padding:"6px 12px",
                border:"1px solid "+T.border2, borderRadius:4, background:"none",
                color:T.muted, cursor:"pointer", fontSize:13 }}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* ── PROJECT SETTINGS PANEL ── */}
      {!customerMode && showSettings && (
        <ProjectSettingsPanel settings={settings} onChange={updateSettings}
          costs={costs} rawLbrHrs={totals.lbrHrs} itemCount={estimate.items?.length || 0}
          estimateId={estimate.id} onApplyDefaultInstallType={applyDefaultInstallType} />
      )}

      {/* ── LINE ITEMS TABLE ── */}
      <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
        <div style={{
          position:"sticky",
          top:0,
          zIndex:20,
          marginBottom:16,
          padding:"10px 12px",
          border:"1px solid "+T.border,
          borderRadius:10,
          background:T.surface,
          boxShadow:"0 8px 20px rgba(15,23,42,0.08)",
          opacity:0.98,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <div style={{ minWidth:150, flex:"1 1 150px" }}>
              <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono,
                textTransform:"uppercase", letterSpacing:1.3 }}>Live Estimate Summary</div>
              <div style={{ fontSize:11, color:T.dim, marginTop:2 }}>
                {estimate.items.length} line item{estimate.items.length!==1?"s":""} · {fmtHr(totals.lbrHrs)} raw labor
              </div>
            </div>
            {[
              ...(customerMode ? [] : [
                { label:"Material", val:costs.material, color:T.blue },
                { label:"Labor", val:costs.labor, color:T.steel },
                { label:"Bond", val:costs.bond, color:"#B45309" },
              ]),
              { label:"Total", val:costs.total, color:T.text, bold:true },
            ].map(({label,val,color,bold}) => (
              <div key={label} style={{
                minWidth:112,
                padding:"6px 10px",
                borderLeft:"1px solid "+T.border,
              }}>
                <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono,
                  textTransform:"uppercase", letterSpacing:1.1 }}>{label}</div>
                <div style={{ fontSize:bold?15:13, fontWeight:bold?800:700, color,
                  fontFamily:T.mono }}>{fmt$(val)}</div>
              </div>
            ))}
          </div>
        </div>
        {estimate.items.length === 0 ? (
          <div style={{ padding:"40px 24px", textAlign:"center", border:"2px dashed "+T.border,
            borderRadius:10, background:T.panel }}>
            <div style={{ fontSize:32, marginBottom:12 }}>⊞</div>
            <div style={{ fontSize:15, color:T.muted, marginBottom:8 }}>No equipment yet</div>
            <div style={{ fontSize:13, color:T.dim, marginBottom:20 }}>
              Use the buttons above to configure and add equipment to this estimate.
            </div>
            <AddEquipButtons
              onAdd={type => setSubPage({type})}
            />
          </div>
        ) : isMobile ? (
          <div style={{ display:"flex", flexDirection:"column", gap:8, paddingBottom:24 }}>
            {estimate.items.map((item, idx) => {
              const c = calcItem(item);
              const meta = TYPE_META[item.type] || { label:item.type.toUpperCase(), color:T.steel, bg:T.faint };
              return (
                <div key={item.id} style={{ background:T.surface, border:"1px solid "+T.border,
                  borderLeft:"3px solid "+meta.color, borderRadius:8, padding:"12px 14px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:11, background:meta.bg, color:meta.color,
                      padding:"2px 7px", borderRadius:10, fontFamily:T.mono, fontWeight:600 }}>
                      {meta.label}
                    </span>
                    <span style={{ fontFamily:T.mono, fontWeight:700, color:meta.color, fontSize:14 }}>{item.tag}</span>
                    <span style={{ fontSize:12, color:T.muted, marginLeft:4 }}>{item.location}</span>
                  </div>
                  <div style={{ display:"flex", gap:16, marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:9, color:T.dim, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Qty</div>
                      <input type="number" min="1" value={item.qty}
                        onChange={e=>updateItem(item.id,{qty:Math.max(1,parseInt(e.target.value)||1)})}
                        style={{ width:52, padding:"3px 5px", border:"1px solid "+T.border2,
                          borderRadius:4, fontSize:13, fontFamily:T.mono, color:T.text,
                          background:customerMode ? T.panel : T.bg, outline:"none", textAlign:"center" }}/>
                    </div>
                    <div>
                      <div style={{ fontSize:9, color:T.dim, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Install</div>
                      <div style={{ fontSize:12, color:T.muted, fontFamily:T.mono, paddingTop:4 }}>{item.installType}</div>
                    </div>
                    {!customerMode && (
                      <div style={{ marginLeft:"auto" }}>
                        <div style={{ fontSize:9, color:T.dim, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Total</div>
                        <div style={{ fontSize:14, fontWeight:700, color:T.blue, fontFamily:T.mono }}>{fmt$(c.totalMtl)}</div>
                        <div style={{ fontSize:11, color:T.muted, fontFamily:T.mono }}>{fmtHr(c.totalLbr)}</div>
                      </div>
                    )}
                  </div>
                  {!customerMode && (
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>setSubPage({type:item.type, editItemId:item.id})}
                        style={{ flex:1, padding:"7px 0", border:"1px solid "+T.blueMid,
                          borderRadius:5, background:T.blueFaint, color:T.blue,
                          cursor:"pointer", fontSize:12, fontFamily:T.mono, fontWeight:600 }}>
                        Edit
                      </button>
                      <button onClick={()=>moveItem(idx, idx-1)} disabled={idx===0}
                        style={{ padding:"7px 10px", border:"1px solid "+T.border2, borderRadius:5,
                          background:"none", color:idx===0?T.border2:T.muted, cursor:idx===0?"default":"pointer",
                          fontSize:12, fontFamily:T.mono }}>↑</button>
                      <button onClick={()=>moveItem(idx, idx+1)} disabled={idx===estimate.items.length-1}
                        style={{ padding:"7px 10px", border:"1px solid "+T.border2, borderRadius:5,
                          background:"none", color:idx===estimate.items.length-1?T.border2:T.muted,
                          cursor:idx===estimate.items.length-1?"default":"pointer",
                          fontSize:12, fontFamily:T.mono }}>↓</button>
                      <button onClick={()=>removeItem(item.id)}
                        style={{ padding:"7px 10px", border:"1px solid color-mix(in srgb, var(--t-rose) 40%, transparent)",
                          borderRadius:5, background:"none", color:T.rose,
                          cursor:"pointer", fontSize:14, fontFamily:T.mono }}>×</button>
                    </div>
                  )}
                </div>
              );
            })}
            {!customerMode && (
              <div style={{ background:T.blueFaint, border:"1px solid "+T.blueMid,
                borderRadius:8, padding:"12px 14px" }}>
                {[
                  { label:"Material", val:costs.material, color:T.blue },
                  { label:"Labor", val:costs.labor, color:T.steel },
                  { label:"Overhead ("+settings.overheadPct+"%)", val:costs.overhead, color:"#7C3AED" },
                  { label:"Profit ("+settings.profitPct+"%)", val:costs.profit, color:T.green },
                  { label:"Bond ("+settings.bondPct+"%)", val:costs.bond, color:"#B45309" },
                  { label:"TOTAL", val:costs.total, color:T.blue, bold:true },
                ].map(({label,val,color,bold}) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between",
                    padding:"4px 0", borderBottom:"1px solid "+T.blueMid }}>
                    <span style={{ fontSize:12, color:T.muted, fontFamily:T.mono }}>{label}</span>
                    <span style={{ fontSize:bold?15:13, fontWeight:bold?800:700, color, fontFamily:T.mono }}>{fmt$(val)}</span>
                  </div>
                ))}
              </div>
            )}
            {customerMode && (
              <div style={{ background:T.blueFaint, border:"1px solid "+T.blueMid,
                borderRadius:8, padding:"12px 14px", display:"flex", justifyContent:"space-between",
                alignItems:"center" }}>
                <span style={{ fontSize:13, color:T.blue, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Estimate Total</span>
                <span style={{ fontSize:16, fontWeight:800, color:T.blue, fontFamily:T.mono }}>{fmt$(costs.total)}</span>
              </div>
            )}
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:"2px solid "+T.border }}>
                {["Tag","Type","Location","Qty","Install","Unit Mtl","Unit Lbr","Total Mtl","Total Lbr","Actions"].map(h=>(
                  <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:10,
                    letterSpacing:1.5, textTransform:"uppercase", color:T.muted,
                    fontFamily:T.mono, fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estimate.items.map((item,idx) => {
                const c = calcItem(item);
                const details = getItemDetails(item);
                const isExpanded = !!expandedRows[item.id];
                const meta = TYPE_META[item.type] || { label:item.type.toUpperCase(), color:T.steel, bg:T.faint };
                const ahuLabel = item.type==="ahu" && item.cfg
                  ? AHU_TYPES.find(t=>t.id===item.cfg.ahuType)?.label : "";
                return (
                  <Fragment key={item.id}>
                  <tr className="item-row" style={{ borderBottom:isExpanded?"none":"1px solid "+T.border,
                    background: idx%2===0 ? T.surface : T.faint }}>
                    <td style={{ padding:"10px 10px" }}>
                      <span style={{ fontFamily:T.mono, fontWeight:700, color:meta.color, fontSize:13 }}>{item.tag}</span>
                    </td>
                    <td style={{ padding:"10px 10px" }}>
                      <span style={{ fontSize:11, background:meta.bg, color:meta.color,
                        padding:"2px 7px", borderRadius:10, fontFamily:T.mono, fontWeight:600 }}>
                        {meta.label}
                      </span>
                      {ahuLabel && <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>{ahuLabel}</div>}
                    </td>
                    <td style={{ padding:"10px 10px", color:T.muted, fontSize:12 }}>{item.location}</td>
                      <td style={{ padding:"10px 10px" }}>
                        <input type="number" min="1" value={item.qty}
                          onChange={e=>updateItem(item.id,{qty:Math.max(1,parseInt(e.target.value)||1)})}
                          style={{ width:52, padding:"4px 6px", border:"1px solid "+T.border2,
                            borderRadius:4, fontSize:13, fontFamily:T.mono, color:T.text,
                            background:customerMode ? T.panel : T.bg, outline:"none", textAlign:"center" }}/>
                      </td>
                    <td style={{ padding:"10px 10px" }}>
                      <span style={{ fontSize:11, color:T.muted, fontFamily:T.mono }}>{item.installType}</span>
                    </td>
                      <td style={{ padding:"10px 10px", fontFamily:T.mono }}>{customerMode ? "—" : fmt$(c.unitMtl)}</td>
                      <td style={{ padding:"10px 10px", fontFamily:T.mono, color:T.muted }}>{customerMode ? "—" : fmtHr(c.unitLbr)}</td>
                      <td style={{ padding:"10px 10px", fontFamily:T.mono, fontWeight:600, color:T.blue }}>{customerMode ? "—" : fmt$(c.totalMtl)}</td>
                      <td style={{ padding:"10px 10px", fontFamily:T.mono, color:T.muted }}>{customerMode ? "—" : fmtHr(c.totalLbr)}</td>
                    <td className="item-actions" style={{ padding:"10px 10px", whiteSpace:"nowrap" }}>
                      <button
                        onClick={() => toggleRowDetails(item.id)}
                        title={isExpanded ? "Hide details" : "Show details"}
                        style={{ background:isExpanded ? T.blueFaint : "none",
                          border:"1px solid "+(isExpanded ? T.blueMid : T.border2),
                          borderRadius:4, color:isExpanded ? T.blue : T.muted,
                          cursor:"pointer", fontSize:11, fontFamily:T.mono,
                          padding:"3px 7px", marginRight:6 }}>
                        {isExpanded ? "Hide" : "Details"}
                      </button>
                      <button
                        onClick={() => moveItem(idx, idx - 1)}
                        disabled={idx === 0}
                        title="Move up"
                        style={{ background:"none", border:"1px solid "+T.border2,
                          borderRadius:4, color:idx===0?T.border2:T.muted,
                          cursor:idx===0?"default":"pointer",
                          fontSize:11, fontFamily:T.mono, padding:"3px 6px", marginRight:4 }}>
                        ↑
                      </button>
                      <button
                        onClick={() => moveItem(idx, idx + 1)}
                        disabled={idx === estimate.items.length - 1}
                        title="Move down"
                        style={{ background:"none", border:"1px solid "+T.border2,
                          borderRadius:4, color:idx===estimate.items.length - 1?T.border2:T.muted,
                          cursor:idx===estimate.items.length - 1?"default":"pointer",
                          fontSize:11, fontFamily:T.mono, padding:"3px 6px", marginRight:6 }}>
                        ↓
                      </button>
                      <button onClick={()=>setSubPage({type:item.type, editItemId:item.id})}
                        style={{ background:"none", border:"1px solid "+T.blueMid,
                          borderRadius:4, color:T.blue, cursor:"pointer",
                          fontSize:11, fontFamily:T.mono, padding:"3px 8px", marginRight:6 }}>
                        Edit
                      </button>
                      <button onClick={()=>removeItem(item.id)} style={{ background:"none",
                        border:"none", color:T.dim, cursor:"pointer", fontSize:16 }}>×</button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ borderBottom:"1px solid "+T.border, background: idx%2===0 ? T.surface : T.faint }}>
                      <td colSpan={10} style={{ padding:"0 10px 12px 10px" }}>
                        <div style={{
                          border:"1px solid "+T.border,
                          borderRadius:8,
                          background:T.panel,
                          padding:"12px 14px",
                          display:"grid",
                          gridTemplateColumns:"minmax(260px, 1fr) minmax(220px, 1fr)",
                          gap:14,
                        }}>
                          <div>
                            <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono,
                              textTransform:"uppercase", letterSpacing:1.3, marginBottom:8 }}>
                              Selected Components ({details.selected.length})
                            </div>
                            {details.selected.length ? details.selected.map(entry => (
                              <div key={entry.id} style={{
                                display:"flex",
                                alignItems:"baseline",
                                justifyContent:"space-between",
                                gap:10,
                                padding:"5px 0",
                                borderBottom:"1px dashed "+T.border,
                              }}>
                                <div style={{ minWidth:0 }}>
                                  <div style={{ fontSize:12, color:T.text }}>{entry.label}</div>
                                  <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono }}>Qty {entry.qty}</div>
                                </div>
                                {!customerMode && (
                                  <div style={{ textAlign:"right", flexShrink:0 }}>
                                    <div style={{ fontSize:11, color:T.blue, fontFamily:T.mono }}>{fmt$(entry.mtl)}</div>
                                    <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono }}>{fmtHr(entry.lbr)}</div>
                                  </div>
                                )}
                              </div>
                            )) : (
                              <div style={{ fontSize:11, color:T.dim }}>No standard components selected.</div>
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono,
                              textTransform:"uppercase", letterSpacing:1.3, marginBottom:8 }}>
                              Custom Assemblies ({details.custom.length})
                            </div>
                            {details.custom.length ? details.custom.map(entry => (
                              <div key={entry.id} style={{
                                display:"flex",
                                alignItems:"baseline",
                                justifyContent:"space-between",
                                gap:10,
                                padding:"5px 0",
                                borderBottom:"1px dashed "+T.border,
                              }}>
                                <div style={{ minWidth:0 }}>
                                  <div style={{ fontSize:12, color:T.text }}>{entry.label}</div>
                                  <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono }}>Added manually</div>
                                </div>
                                {!customerMode && (
                                  <div style={{ textAlign:"right", flexShrink:0 }}>
                                    <div style={{ fontSize:11, color:T.blue, fontFamily:T.mono }}>{fmt$(entry.mtl)}</div>
                                    <div style={{ fontSize:10, color:T.muted, fontFamily:T.mono }}>{fmtHr(entry.lbr)}</div>
                                  </div>
                                )}
                              </div>
                            )) : (
                              <div style={{ fontSize:11, color:T.dim }}>No custom assemblies added.</div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              {!customerMode && <tr style={{ borderTop:"2px solid "+T.border, background:T.faint }}>
                <td colSpan={7} style={{ padding:"8px 10px", fontFamily:T.mono, fontSize:11,
                  color:T.muted, textTransform:"uppercase", letterSpacing:1 }}>Raw Totals</td>
                <td style={{ padding:"8px 10px", fontFamily:T.mono, fontWeight:700, color:T.blue }}>{fmt$(totals.mtl)}</td>
                <td style={{ padding:"8px 10px", fontFamily:T.mono, color:T.steel }}>{fmtHr(totals.lbrHrs)}</td>
                <td/>
              </tr>}
              {!customerMode && <tr style={{ background:T.blueFaint }}>
                <td colSpan={8} style={{ padding:0 }}>
                  <div style={{ display:"flex", gap:0 }}>
                    {[
                      { label:"Labor",    val:costs.labor,    color:T.steel   },
                      { label:"Material", val:costs.material, color:T.blue    },
                      { label:"Overhead ("+settings.overheadPct+"%)", val:costs.overhead, color:"#7C3AED" },
                      { label:"Profit ("+settings.profitPct+"%)",     val:costs.profit,   color:T.green   },
                      { label:"Bond ("+settings.bondPct+"%)",         val:costs.bond,     color:"#B45309"  },
                    ].map(({label,val,color}) => (
                      <div key={label} style={{ flex:1, padding:"6px 10px", borderRight:"1px solid "+T.blueMid }}>
                        <div style={{ fontSize:9, color:T.muted, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
                        <div style={{ fontSize:13, fontWeight:700, color, fontFamily:T.mono }}>{fmt$(val)}</div>
                      </div>
                    ))}
                    <div style={{ flex:1, padding:"6px 10px", background:T.blueA18 }}>
                      <div style={{ fontSize:9, color:T.blue, fontFamily:T.mono, textTransform:"uppercase", letterSpacing:1 }}>Total</div>
                      <div style={{ fontSize:14, fontWeight:800, color:T.blue, fontFamily:T.mono }}>{fmt$(costs.total)}</div>
                    </div>
                  </div>
                </td>
                <td/>
              </tr>}
              {customerMode && (
                <tr style={{ background:T.blueFaint }}>
                  <td colSpan={9} style={{ padding:"8px 10px", fontFamily:T.mono, fontSize:11,
                    color:T.blue, textTransform:"uppercase", letterSpacing:1 }}>
                    Estimate Total
                  </td>
                  <td style={{ padding:"8px 10px", fontFamily:T.mono, fontSize:14, fontWeight:800, color:T.blue }}>
                    {fmt$(costs.total)}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}



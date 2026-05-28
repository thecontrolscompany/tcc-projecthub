import { useEffect, useState } from "react";
import { T, CAT_COLOR } from "./tokens.js";
import { fmt$, fmtHr } from "./utils.js";
import { AddToEstimateBtn } from "./AddToEstimateBtn.jsx";
import { useEstimate } from "./EstimateContext.jsx";
import { calcAssembly, ASSEMBLIES, UNIT_ITEMS } from "./assemblyData.js";
import { SidebarLayout } from "./SidebarLayout.jsx";
import { SchematicTabs } from "./SchematicTabs.jsx";
import { DiagramViewer } from "./DiagramViewer.jsx";
import { PointsList } from "./PointsList.jsx";
import { AssemblyPickerModal } from "./AssemblyPickerModal.jsx";
import { getCustomCost, toAssemblyOptions } from "./assemblyPicker.js";
import { UnitaryFlowDiagram } from "./UnitaryFlowDiagram.jsx";
import {
  buildCableBundleFromPoints,
  CONDUIT_FILL_BUNDLE_KEY,
  CONDUIT_FILL_CONTEXT_KEY,
  findHomeRunComponentId,
} from "./conduitFill.js";

export function UnitEditorPage({
  type,
  comps,
  title,
  badge,
  accent = T.blue,
  accentBg = T.blueFaint,
  accentBorder = T.blueMid,
  defaultTag,
  defaultLocation,
  defaultInstallType = "EMT",
  pageKey,
  flowKind,
  flowNode,
  mainFooter,
  cfg = null,
  toolbarExtra,
  toolbarTail,
  buildDefaultSelected,
  toggleSelected,
  reconcileSelected,
  normalizeSelected = (selected, availableComps) => {
    const availableIds = new Set((availableComps || []).map(comp => comp.id));
    return (selected || []).filter(entry => availableIds.has(entry.id));
  },
  assemblyOptions,
  assemblyTitle,
  assemblyDescription,
  assemblyEmptyText,
  assemblyCategory,
  addAssemblyLabel = "Add assembly...",
}) {
  const { editingItem, subPage, setSubPage } = useEstimate();
  const isEditing = !!editingItem;
  const editingItemId = editingItem?.id || null;

  const [selected, setSel] = useState(() => {
    if (isEditing) return normalizeSelected(editingItem.selected, comps, cfg);
    if (buildDefaultSelected) return normalizeSelected(buildDefaultSelected(comps, cfg), comps, cfg);
    return comps.filter(comp => comp.def).map(comp => ({ id: comp.id, qty: 1 }));
  });
  const [custom, setCustom] = useState(() => (isEditing ? editingItem.custom || [] : []));
  const [installType, setIT] = useState(() => (isEditing ? editingItem.installType : defaultInstallType));
  const [qty, setQty] = useState(() => (isEditing ? editingItem.qty : 1));
  const [tag, setTag] = useState(() => (isEditing ? editingItem.tag : defaultTag));
  const [loc, setLoc] = useState(() => (isEditing ? editingItem.location : defaultLocation));
  const [filterCat, setFC] = useState("All");
  const [search, setSrch] = useState("");
  const [expanded, setExp] = useState(null);
  const [showModal, setModal] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    setSel(normalizeSelected(editingItem.selected, comps, cfg));
    setCustom(editingItem.custom || []);
    setIT(editingItem.installType || defaultInstallType);
    setQty(editingItem.qty || 1);
    setTag(editingItem.tag || defaultTag);
    setLoc(editingItem.location || defaultLocation);
  }, [editingItemId]);

  useEffect(() => {
    const draft = subPage?.conduitFillDraft;
    if (!draft || subPage?.type !== type) return;
    if (draft.selected) setSel(draft.selected);
    if (draft.custom) setCustom(draft.custom);
    if (draft.installType) setIT(draft.installType);
    if (Number.isFinite(Number(draft.qty))) setQty(Math.max(1, Number(draft.qty) || 1));
    if (typeof draft.tag === "string") setTag(draft.tag);
    if (typeof draft.location === "string") setLoc(draft.location);
  }, [editingItem?.id, subPage, type]);

  useEffect(() => {
    if (!reconcileSelected) return;
    setSel(list => reconcileSelected(list, comps, cfg));
  }, [cfg, comps]);

  const isOn = id => selected.some(entry => entry.id === id);
  const getQtyFor = id => selected.find(entry => entry.id === id)?.qty ?? 1;
  const selectAll = () => setSel(sel => {
    const next = [...sel];
    for (const comp of visible) {
      if (!next.some(s => s.id === comp.id)) next.push({ id: comp.id, qty: 1 });
    }
    return next;
  });
  const deselectAll = () => setSel(sel => sel.filter(s => !visible.some(c => c.id === s.id)));
  const toggle = id => setSel(list => {
    if (toggleSelected) {
      return toggleSelected(list, id, comps, cfg);
    }
    const itemIsOn = list.some(entry => entry.id === id);
    return itemIsOn ? list.filter(entry => entry.id !== id) : [...list, { id, qty: 1 }];
  });
  const setCompQty = (id, next) => setSel(list => list.map(entry => (entry.id === id ? { ...entry, qty: Math.max(1, next) } : entry)));

  const getAsmCost = comp => {
    const aid = String(installType === "EMT" ? comp.emtAID : comp.plnAID);
    if (!aid || aid === "undefined") return { mtl: comp.unitMtl || 0, lbr: comp.unitLbr || 0, items: [] };
    const result = calcAssembly(aid);
    return { ...result, items: ASSEMBLIES[aid]?.items || [] };
  };

  const divFor = per => (per === "C" ? 100 : per === "M" ? 1000 : 1);
  const pickerOptions = assemblyOptions || toAssemblyOptions(comps);

  const allComps = [...comps, ...custom];
  const custMtl = custom.reduce((sum, comp) => sum + getCustomCost(comp, installType).mtl, 0);
  const custLbr = custom.reduce((sum, comp) => sum + getCustomCost(comp, installType).lbr, 0);
  const unitMtl = comps.filter(comp => isOn(comp.id)).reduce((sum, comp) => sum + getAsmCost(comp).mtl * getQtyFor(comp.id), 0) + custMtl;
  const unitLbr = comps.filter(comp => isOn(comp.id)).reduce((sum, comp) => sum + getAsmCost(comp).lbr * getQtyFor(comp.id), 0) + custLbr;

  const cats = ["All", ...Object.keys(CAT_COLOR)];
  const visible = (filterCat === "All" ? allComps : allComps.filter(comp => comp.cat === filterCat))
    .filter(comp => !search || comp.name.toLowerCase().includes(search.toLowerCase()));

  const flowTab = flowNode
    ? flowNode(selected, toggle)
    : flowKind
      ? <UnitaryFlowDiagram kind={flowKind} selected={selected} onToggle={toggle} />
      : (
        <DiagramViewer
          svgPath={`/diagrams/${pageKey}-flow.svg`}
          selectedIds={selected.map(entry => entry.id)}
          allIds={comps.map(comp => comp.id)}
          fallback={(
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <span style={{ color: T.muted, fontFamily: T.mono, fontSize: 13 }}>
                {`Drop ${pageKey}-flow.svg into public/diagrams/`}
              </span>
            </div>
          )}
        />
      );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)", overflow: "hidden" }}>
      {showModal && (
        <AssemblyPickerModal
          title={assemblyTitle || `Add ${badge} Assembly`}
          description={assemblyDescription || `Select from the available ${title} assemblies.`}
          emptyText={assemblyEmptyText || `No ${badge} assemblies match that search.`}
          category={assemblyCategory || `${badge} Assembly`}
          installType={installType}
          options={pickerOptions}
          onAdd={comp => {
            setCustom(list => [...list, comp]);
            setModal(false);
          }}
          onClose={() => setModal(false)}
        />
      )}

      <div style={{
        padding: "10px 12px",
        borderBottom: `1px solid ${T.border}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: T.surface,
        flexShrink: 0,
        flexWrap: "wrap",
      }}>
        <button
          type="button"
          onClick={() => setSubPage(null)}
          title="Return to this estimate without adding a system"
          style={{
            padding: "4px 10px",
            border: `1px solid ${T.border2}`,
            borderRadius: 4,
            background: T.surface,
            color: T.muted,
            cursor: "pointer",
            fontSize: 11,
            fontFamily: T.mono,
            whiteSpace: "nowrap",
          }}
        >
          ← Estimate
        </button>
        <div style={{ padding: "3px 10px", background: accentBg, border: `1px solid ${accentBorder}`, borderRadius: 4 }}>
          <span style={{ fontSize: 11, color: accent, fontFamily: T.mono, fontWeight: 700, letterSpacing: 1 }}>{badge}</span>
        </div>
        {toolbarExtra}
        <input
          value={tag}
          onChange={event => setTag(event.target.value)}
          style={{
            background: accentBg,
            border: `1px solid ${accentBorder}`,
            borderRadius: 4,
            color: accent,
            fontFamily: T.mono,
            fontSize: 13,
            padding: "4px 8px",
            width: 100,
            outline: "none",
            fontWeight: 700,
          }}
        />
        {qty > 1 && <span style={{ fontSize: 13, color: accent, fontFamily: T.mono }}>x {qty} typical</span>}
        <AddToEstimateBtn type={type} tag={tag} location={loc} cfg={cfg} selected={selected} custom={custom} qty={qty} installType={installType} />
        <input
          value={loc}
          onChange={event => setLoc(event.target.value)}
          style={{
            background: T.panel,
            border: `1px solid ${T.border}`,
            borderRadius: 4,
            color: T.steel,
            fontFamily: T.mono,
            fontSize: 12,
            padding: "4px 8px",
            flex: "1 1 120px",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 14, padding: "5px 14px", background: accentBg, borderRadius: 6, border: `1px solid ${accentBorder}`, marginLeft: "auto" }}>
          <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>
            Unit <span style={{ color: accent, fontWeight: 700 }}>{fmt$(unitMtl)}</span>
          </span>
          {qty > 1 && (
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>
              Total <span style={{ color: accent, fontWeight: 700 }}>{fmt$(unitMtl * qty)}</span>
            </span>
          )}
        </div>
        {toolbarTail}
      </div>

      <SidebarLayout
        pageKey={pageKey}
        mobileBadge={fmt$(unitMtl)}
        main={(
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", height: "100%" }}>
            <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ flex: 1, background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`, overflow: "hidden", minHeight: 0 }}>
                <SchematicTabs>{{
                  flow: flowTab,
                  elec: (
                    <DiagramViewer
                      svgPath={`/diagrams/${pageKey}-elec.svg`}
                      selectedIds={selected.map(entry => entry.id)}
                      allIds={comps.map(comp => comp.id)}
                      fallback={(
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                          <span style={{ color: T.muted, fontFamily: T.mono, fontSize: 13 }}>
                            {`Drop ${pageKey}-elec.svg into public/diagrams/`}
                          </span>
                        </div>
                      )}
                    />
                  ),
                  points: <PointsList comps={comps} selected={selected} installType={installType} tag={tag} />,
                }}</SchematicTabs>
              </div>
              <div style={{ margin:"8px 20px 0", padding:"10px 14px", border:"1px dashed "+T.blueL,
                borderRadius:5, display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:15, color:T.blueL }}>⊕</span>
                <div style={{ flex:1, fontSize:12, color:T.blue, fontWeight:500 }}>
                  Conduit Fill Calculator
                  <span style={{ fontWeight:400, color:T.blueL, marginLeft:8, fontSize:11 }}>
                    — home run conduit count from cable ODs
                  </span>
                </div>
                <button
                  onClick={() => {
                    const bundle = buildCableBundleFromPoints(comps, selected);
                    if (!bundle.length) return;
                    sessionStorage.setItem(CONDUIT_FILL_BUNDLE_KEY, JSON.stringify(bundle));
                    sessionStorage.setItem(CONDUIT_FILL_CONTEXT_KEY, JSON.stringify({
                      returnSubPage: editingItem ? { type, editItemId: editingItem.id } : { type },
                      homerunId: findHomeRunComponentId(comps),
                      draft: {
                        cfg,
                        selected,
                        custom,
                        installType,
                        qty,
                        tag,
                        location: loc,
                      },
                    }));
                    window.dispatchEvent(new CustomEvent("open-conduit-fill"));
                  }}
                  style={{ padding:"4px 10px", border:"1px solid "+T.blueL, borderRadius:4,
                    background:"none", color:T.blue, fontSize:11, cursor:"pointer", fontFamily:T.mono }}>
                  Configure →
                </button>
              </div>
            </div>
            {mainFooter && mainFooter(selected, toggle, allComps)}
          </div>
        )}
        sidebar={(
          <>
            <div style={{ padding: "12px 14px 10px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>System</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8 }}>{title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "6px 10px", background: accentBg, borderRadius: 5, border: `1px solid ${accentBorder}` }}>
                <span style={{ fontSize: 11, color: accent, fontFamily: T.mono, letterSpacing: 1, textTransform: "uppercase" }}>Typical x</span>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={event => setQty(Math.max(1, parseInt(event.target.value, 10) || 1))}
                  style={{
                    width: 52,
                    padding: "4px 6px",
                    border: `1px solid ${accentBorder}`,
                    borderRadius: 4,
                    fontSize: 14,
                    fontFamily: T.mono,
                    background: T.surface,
                    color: accent,
                    fontWeight: 700,
                    outline: "none",
                    textAlign: "center",
                  }}
                />
                <span style={{ fontSize: 11, color: T.muted }}>{qty === 1 ? "unit" : "units"}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["EMT", "Plenum"].map(mode => (
                  <button
                    key={mode}
                    onClick={() => setIT(mode)}
                    style={{
                      flex: 1,
                      padding: "4px 0",
                      borderRadius: 4,
                      border: `1px solid ${installType === mode ? accent : T.border2}`,
                      background: installType === mode ? accentBg : "transparent",
                      color: installType === mode ? accent : T.muted,
                      fontSize: 11,
                      fontFamily: T.mono,
                      cursor: "pointer",
                      fontWeight: installType === mode ? 700 : 400,
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: "6px 8px", borderBottom: `1px solid ${T.border}` }}>
              <input
                value={search}
                onChange={event => setSrch(event.target.value)}
                placeholder="Search components..."
                style={{
                  width: "100%",
                  padding: "5px 8px",
                  border: `1px solid ${T.border2}`,
                  borderRadius: 5,
                  fontSize: 12,
                  fontFamily: T.mono,
                  color: T.text,
                  background: T.bg,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
              {cats.map(cat => {
                const color = CAT_COLOR[cat] || T.steel;
                const active = filterCat === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setFC(cat)}
                    style={{
                      padding: "2px 7px",
                      borderRadius: 10,
                      fontSize: 9.5,
                      fontFamily: T.mono,
                      cursor: "pointer",
                      border: `1px solid ${active ? color : T.border}`,
                      background: active ? `${color}14` : "transparent",
                      color: active ? color : T.muted,
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
              <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                <button onClick={selectAll} style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9.5, fontFamily: T.mono, cursor: "pointer", border: `1px solid ${T.border}`, background: "transparent", color: T.muted }}>All</button>
                <button onClick={deselectAll} style={{ padding: "2px 7px", borderRadius: 10, fontSize: 9.5, fontFamily: T.mono, cursor: "pointer", border: `1px solid ${T.border}`, background: "transparent", color: T.muted }}>None</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {visible.map(comp => {
                const isActive = selected.some(entry => entry.id === comp.id);
                const compQty = selected.find(entry => entry.id === comp.id)?.qty ?? 1;
                const isExp = expanded === comp.id;
                const color = CAT_COLOR[comp.cat] || T.steel;
                const cost = getAsmCost(comp);

                return (
                  <div
                    key={comp.id}
                    style={{
                      borderBottom: `1px solid ${T.border}`,
                      borderLeft: `3px solid ${isActive ? color : "transparent"}`,
                      background: isActive ? `${color}08` : T.surface,
                    }}
                  >
                    <div style={{ padding: "8px 13px", cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }} onClick={() => toggle(comp.id)}>
                      <div style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        flexShrink: 0,
                        background: isActive ? color : "transparent",
                        border: `2px solid ${isActive ? color : T.border2}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        {isActive && <span style={{ color: "#fff", fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: isActive ? T.text : T.muted, fontWeight: isActive ? 600 : 400 }}>{comp.name}</div>
                        <div style={{ fontSize: 10, color: isActive ? color : T.dim, fontFamily: T.mono, marginTop: 1 }}>{comp.cat}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 11, color: isActive ? T.text : T.muted, fontFamily: T.mono }}>{fmt$(cost.mtl * compQty)}</div>
                        <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono }}>{fmtHr(cost.lbr * compQty)}</div>
                      </div>
                      {isActive && (
                        <input
                          type="number"
                          min="1"
                          value={compQty}
                          onClick={event => event.stopPropagation()}
                          onChange={event => setCompQty(comp.id, parseInt(event.target.value, 10) || 1)}
                          style={{
                            width: 36,
                            padding: "2px 4px",
                            border: `1px solid ${accentBorder}`,
                            borderRadius: 3,
                            fontSize: 11,
                            fontFamily: T.mono,
                            background: accentBg,
                            color: accent,
                            fontWeight: 700,
                            outline: "none",
                            textAlign: "center",
                          }}
                        />
                      )}
                      {isActive && (
                        <button
                          onClick={event => {
                            event.stopPropagation();
                            setExp(isExp ? null : comp.id);
                          }}
                          style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 11, padding: "0 2px", lineHeight: 1, marginLeft: 2 }}
                        >
                          {isExp ? "▲" : "▼"}
                        </button>
                      )}
                    </div>
                    {isActive && isExp && cost.items.length > 0 && (
                      <div style={{ background: `${color}06`, borderTop: `1px solid ${color}20`, padding: "4px 8px 8px" }}>
                        <div style={{ fontSize: 9, color, fontFamily: T.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4, paddingLeft: 4 }}>Parts</div>
                        {cost.items.map((it, idx) => {
                          const itemMtl = (it.qty * it.mtlUnit) / divFor(it.mtlPer);
                          const itemHrs = (it.qty * it.hrsUnit) / divFor(it.hrsPer);
                          return (
                            <div key={idx} style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "2px 4px", borderRadius: 3, background: idx % 2 === 0 ? "transparent" : T.faint }}>
                              <span style={{ fontSize: 9, color: T.dim, fontFamily: T.mono, width: 28, flexShrink: 0 }}>
                                {it.qty}{it.mtlPer === "C" ? "/C" : it.mtlPer === "M" ? "/M" : ""}
                              </span>
                              <span style={{ fontSize: 10, color: T.muted, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {UNIT_ITEMS[it.item]?.desc || it.item}
                              </span>
                              <span style={{ fontSize: 10, color: T.steel, fontFamily: T.mono, flexShrink: 0 }}>
                                {fmt$(itemMtl)} · {fmtHr(itemHrs)}
                              </span>
                            </div>
                          );
                        })}
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, paddingTop: 5, borderTop: `1px solid ${color}30` }}>
                          <span style={{ fontSize: 9, color: T.muted, fontFamily: T.mono }}>TOTAL</span>
                          <span style={{ fontSize: 11, color, fontFamily: T.mono, fontWeight: 700 }}>{fmt$(cost.mtl)} · {fmtHr(cost.lbr)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {(filterCat === "All" || filterCat === "Custom") && custom.map(comp => {
                const color = CAT_COLOR.Custom;
                const customCost = getCustomCost(comp, installType);
                return (
                  <div key={comp.id} style={{ padding: "8px 13px", background: `${color}08`, borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${color}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, background: `${color}20`, border: `2px solid ${color}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 9, color, fontWeight: 900 }}>+</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: T.text, display: "flex", alignItems: "center", gap: 4 }}>
                          {comp.name}
                          <span style={{ fontSize: 8, color, background: `${color}14`, padding: "1px 4px", borderRadius: 3, fontFamily: T.mono }}>CUSTOM</span>
                        </div>
                        <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono }}>{comp.category}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 11, fontFamily: T.mono }}>{fmt$(customCost.mtl)}</div>
                        <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono }}>{fmtHr(customCost.lbr)}</div>
                      </div>
                      <button onClick={() => setCustom(list => list.filter(entry => entry.id !== comp.id))} style={{ background: "none", border: "none", color: T.dim, cursor: "pointer", fontSize: 15, padding: "0 2px" }}>
                        ×
                      </button>
                    </div>
                    {comp.notes && <div style={{ fontSize: 10, color: T.muted, marginTop: 3, marginLeft: 21, fontStyle: "italic" }}>{comp.notes}</div>}
                  </div>
                );
              })}

              <div style={{ padding: "10px 13px" }}>
                <button
                  onClick={() => setModal(true)}
                  style={{
                    width: "100%",
                    padding: "7px",
                    border: `1px dashed ${T.border2}`,
                    borderRadius: 5,
                    background: "none",
                    color: T.muted,
                    cursor: "pointer",
                    fontSize: 11,
                    fontFamily: T.mono,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                  }}
                >
                  <span style={{ fontSize: 14, color: accent }}>+</span>{addAssemblyLabel}
                </button>
              </div>
            </div>

            <div style={{ padding: "10px 13px", borderTop: `1px solid ${T.border}`, background: T.panel }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, padding: "5px 8px", background: T.surface, borderRadius: 4, border: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1 }}>Per unit</span>
                <span style={{ fontSize: 12, fontFamily: T.mono }}>
                  <span style={{ color: accent, fontWeight: 700 }}>{fmt$(unitMtl)}</span>
                  <span style={{ color: T.dim, marginLeft: 10 }}>{fmtHr(unitLbr)}</span>
                </span>
              </div>
              {qty > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: accentBg, borderRadius: 5, border: `1px solid ${accentBorder}` }}>
                  <span style={{ fontSize: 11, color: accent, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1 }}>Total x {qty}</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 15, color: accent, fontFamily: T.mono, fontWeight: 700 }}>{fmt$(unitMtl * qty)}</div>
                    <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>{fmtHr(unitLbr * qty)}</div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      />
    </div>
  );
}

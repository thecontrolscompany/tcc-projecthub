"use client";

import { useState, useMemo } from "react";
import { T, CAT_COLOR } from "../../shared/tokens.js";
import { UNIT_ITEMS } from "../../shared/assemblyData.js";
import { loadUnitPrices, saveUnitPrices, resetUnitPrices } from "../../shared/unitPriceStore.js";
import { loadStarred, saveStarred } from "../../shared/starredItemsStore.js";

function TableHeader() {
  return (
    <thead>
      <tr style={{ borderBottom: "2px solid " + T.border }}>
        {["★", "Description", "Material", "Labor", ""].map(h => (
          <th key={h} style={{
            padding: "7px 10px", textAlign: "left", fontSize: 10,
            letterSpacing: 1.5, textTransform: "uppercase",
            color: T.muted, fontFamily: T.mono, fontWeight: 600
          }}>{h}</th>
        ))}
      </tr>
    </thead>
  );
}

export default function PriceBookPage() {
  const [overrides, setOverrides] = useState(() => loadUnitPrices());
  const [search, setSearch]       = useState("");
  const [showAll, setShowAll]     = useState(false);
  const [flash, setFlash]         = useState(null);
  const [starred, setStarred]     = useState(() => {
    try { return loadStarred(); }
    catch { return []; }
  });

  const persist = updated => {
    setOverrides(updated);
    saveUnitPrices(updated);
  };

  const toggleStar = id => {
    const updated = starred.includes(id)
      ? starred.filter(s => s !== id)
      : [...starred, id];
    setStarred(updated);
    saveStarred(updated);
  };

  const updateField = (id, field, val) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) return;
    const item = UNIT_ITEMS[id];
    if (!item) return;
    const isDefault = Math.abs(num - item[field]) < 0.000001;
    const updated = { ...overrides };
    if (isDefault) {
      if (updated[id]) {
        delete updated[id][field];
        if (!Object.keys(updated[id]).length) delete updated[id];
      }
    } else {
      updated[id] = { ...updated[id], [field]: num };
    }
    persist(updated);
    setFlash(id + field);
    setTimeout(() => setFlash(null), 1000);
  };

  const resetOne = id => {
    const updated = { ...overrides };
    delete updated[id];
    persist(updated);
  };

  const resetAll = () => {
    if (window.confirm("Reset ALL prices to factory defaults? This affects all future estimates.")) {
      resetUnitPrices();
      setOverrides({});
    }
  };

  const exportCSV = () => {
    const rows = [["Item ID", "Description", "Category", "Mtl Unit", "Mtl Per", "Hrs Unit", "Hrs Per"]];
    for (const item of Object.values(UNIT_ITEMS)) {
      const ov = overrides[item.id] || {};
      const mtl = ov.mtlUnit !== undefined ? ov.mtlUnit : item.mtlUnit;
      const lbr = ov.hrsUnit !== undefined ? ov.hrsUnit : item.hrsUnit;
      rows.push([item.id, item.desc, item.category, mtl, item.mtlPer, lbr, item.hrsPer]);
    }
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "tcc_pricebook.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const importCSV = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const lines = evt.target.result.split("\n").slice(1);
      const updated = { ...overrides };
      let count = 0;
      for (const line of lines) {
        if (!line.trim()) continue;
        const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
        const [id, , , mtl, , lbr] = cols;
        if (!id || !UNIT_ITEMS[id]) continue;
        const defMtl = UNIT_ITEMS[id].mtlUnit;
        const defLbr = UNIT_ITEMS[id].hrsUnit;
        const newMtl = parseFloat(mtl);
        const newLbr = parseFloat(lbr);
        if (isNaN(newMtl) || isNaN(newLbr)) continue;
        const hasMtlChange = Math.abs(newMtl - defMtl) > 0.000001;
        const hasLbrChange = Math.abs(newLbr - defLbr) > 0.000001;
        if (hasMtlChange || hasLbrChange) {
          updated[id] = {};
          if (hasMtlChange) updated[id].mtlUnit = newMtl;
          if (hasLbrChange) updated[id].hrsUnit = newLbr;
          count++;
        } else {
          delete updated[id];
        }
      }
      persist(updated);
      alert(`Import complete — ${count} item${count !== 1 ? "s" : ""} updated.`);
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const overrideCount = Object.keys(overrides).length;

  const starredItems = useMemo(() =>
    Object.values(UNIT_ITEMS).filter(i => starred.includes(i.id)),
    [starred]);

  const filtered = useMemo(() => {
    if (!search.trim()) return showAll ? Object.values(UNIT_ITEMS) : [];
    const q = search.toLowerCase();
    return Object.values(UNIT_ITEMS).filter(i =>
      i.desc.toLowerCase().includes(q) || i.id.includes(q)
    );
  }, [search, showAll]);

  const fmt4 = n => "$" + (n || 0).toFixed(4);

  const ItemRow = ({ item, idx }) => {
    const ov = overrides[item.id] || {};
    const hasMtl = ov.mtlUnit !== undefined;
    const hasLbr = ov.hrsUnit !== undefined;
    const hasAny = hasMtl || hasLbr;
    const curMtl = hasMtl ? ov.mtlUnit : item.mtlUnit;
    const curLbr = hasLbr ? ov.hrsUnit : item.hrsUnit;
    const color = CAT_COLOR[item.category] || T.steel;
    const isStarred = starred.includes(item.id);
    const perLabel = item.mtlPer === 'C' ? '/100' : item.mtlPer === 'M' ? '/1000' : '/ea';
    const lbrLabel = item.hrsPer === 'C' ? '/100' : item.hrsPer === 'M' ? '/1000' : '/ea';

    return (
      <tr style={{
        borderBottom: "1px solid " + T.border,
        background: hasAny ? color + "06" : idx % 2 === 0 ? T.surface : T.faint
      }}>
        <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
          <button onClick={() => toggleStar(item.id)} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 14, color: isStarred ? T.amber : T.border2,
            padding: "0 4px", lineHeight: 1, marginRight: 4
          }}>★</button>
          <span style={{ fontSize: 10, color: T.dim, fontFamily: T.mono }}>{item.id}</span>
        </td>
        <td style={{ padding: "7px 10px", maxWidth: 280 }}>
          <div style={{ fontSize: 13, color: T.text, fontWeight: hasAny ? 600 : 400 }}>{item.desc}</div>
          <div style={{ fontSize: 10, color: color, fontFamily: T.mono }}>{item.category}</div>
        </td>
        <td style={{ padding: "7px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 11, color: T.dim }}>$</span>
            <input
              type="number" min="0" step="0.001"
              defaultValue={curMtl}
              key={item.id + "m" + curMtl}
              onBlur={e => updateField(item.id, "mtlUnit", e.target.value)}
              style={{
                width: 88, padding: "3px 6px",
                border: "1px solid " + (flash === item.id + "mtlUnit" ? T.blue : hasMtl ? color : T.border2),
                borderRadius: 4, fontSize: 12, fontFamily: T.mono,
                background: hasMtl ? color + "10" : T.bg,
                color: T.text, outline: "none", textAlign: "right"
              }} />
            <span style={{ fontSize: 10, color: T.dim, fontFamily: T.mono }}>{perLabel}</span>
          </div>
          {hasMtl && (
            <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, marginTop: 2 }}>
              default: {fmt4(item.mtlUnit)}
            </div>
          )}
        </td>
        <td style={{ padding: "7px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <input
              type="number" min="0" step="0.001"
              defaultValue={curLbr}
              key={item.id + "l" + curLbr}
              onBlur={e => updateField(item.id, "hrsUnit", e.target.value)}
              style={{
                width: 78, padding: "3px 6px",
                border: "1px solid " + (flash === item.id + "hrsUnit" ? T.blue : hasLbr ? color : T.border2),
                borderRadius: 4, fontSize: 12, fontFamily: T.mono,
                background: hasLbr ? color + "10" : T.bg,
                color: T.text, outline: "none", textAlign: "right"
              }} />
            <span style={{ fontSize: 10, color: T.dim, fontFamily: T.mono }}>h{lbrLabel}</span>
          </div>
          {hasLbr && (
            <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, marginTop: 2 }}>
              default: {item.hrsUnit}h
            </div>
          )}
        </td>
        <td style={{ padding: "7px 10px" }}>
          {hasAny && (
            <button onClick={() => resetOne(item.id)} style={{
              background: "none", border: "1px solid " + T.border2,
              borderRadius: 4, color: T.muted, cursor: "pointer",
              fontSize: 11, fontFamily: T.mono, padding: "2px 7px"
            }}>Reset</button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 4 }}>Price Book</div>
          <div style={{ fontSize: 13, color: T.muted }}>
            Unit prices flow through to all assemblies and estimates.
            {overrideCount > 0
              ? ` ${overrideCount} item${overrideCount > 1 ? "s" : ""} overridden.`
              : " All factory defaults."}
          </div>
          <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>
            Click ★ on any item to pin it to the top. Export CSV to edit in Excel, then reimport.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={exportCSV} style={{
            padding: "8px 16px", border: "1px solid " + T.blue,
            borderRadius: 5, background: T.blueFaint,
            color: T.blue, cursor: "pointer", fontSize: 12, fontFamily: T.mono
          }}>↓ Export CSV</button>
          <label style={{
            padding: "8px 16px", border: "1px solid " + T.border2,
            borderRadius: 5, background: "none", color: T.muted,
            cursor: "pointer", fontSize: 12, fontFamily: T.mono
          }}>
            ↑ Import CSV
            <input type="file" accept=".csv" onChange={importCSV} style={{ display: "none" }} />
          </label>
          {overrideCount > 0 && (
            <button onClick={resetAll} style={{
              padding: "8px 16px", border: "1px solid " + T.border2,
              borderRadius: 5, background: "none", color: T.muted,
              cursor: "pointer", fontSize: 12, fontFamily: T.mono
            }}>Reset All</button>
          )}
        </div>
      </div>

      {/* Starred Items */}
      {starredItems.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
            color: T.amber, fontFamily: T.mono, marginBottom: 10
          }}>★ Starred Items</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <TableHeader />
            <tbody>
              {starredItems.map((item, idx) => <ItemRow key={item.id} item={item} idx={idx} />)}
            </tbody>
          </table>
        </div>
      )}

      {starredItems.length === 0 && (
        <div style={{
          marginBottom: 24, padding: "12px 16px",
          border: "1px dashed " + T.border, borderRadius: 6,
          background: T.panel, fontSize: 12, color: T.dim
        }}>
          Click ★ on any item below to pin it here for quick access.
        </div>
      )}

      {/* Search / Browse */}
      <div style={{ borderTop: "1px solid " + T.border, paddingTop: 24 }}>
        <div style={{
          fontSize: 11, letterSpacing: 2, textTransform: "uppercase",
          color: T.muted, fontFamily: T.mono, marginBottom: 12
        }}>All 400 Items</div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{
              position: "absolute", left: 10, top: "50%",
              transform: "translateY(-50%)", fontSize: 13, color: T.dim
            }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by item # or description (e.g. '754' or 'EMT')..."
              style={{
                width: "100%", padding: "8px 10px 8px 32px",
                border: "1px solid " + T.border2, borderRadius: 5,
                fontSize: 13, background: T.bg, color: T.text,
                outline: "none", boxSizing: "border-box"
              }} />
            {search && (
              <button onClick={() => setSearch("")} style={{
                position: "absolute", right: 8, top: "50%",
                transform: "translateY(-50%)", background: "none",
                border: "none", color: T.dim, cursor: "pointer", fontSize: 16
              }}>×</button>
            )}
          </div>
          <button onClick={() => setShowAll(s => !s)} style={{
            padding: "8px 14px", border: "1px solid " + T.border2,
            borderRadius: 5, background: "none",
            color: showAll ? T.blue : T.muted,
            cursor: "pointer", fontSize: 12, fontFamily: T.mono, whiteSpace: "nowrap"
          }}>
            {showAll ? "Hide all" : "Show all"}
          </button>
        </div>

        {(filtered.length > 0 || showAll) && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <TableHeader />
            <tbody>
              {(search.trim() ? filtered : Object.values(UNIT_ITEMS)).map((item, idx) =>
                <ItemRow key={item.id} item={item} idx={idx} />
              )}
            </tbody>
          </table>
        )}

        {!search && !showAll && (
          <div style={{
            padding: "24px", textAlign: "center",
            border: "2px dashed " + T.border, borderRadius: 8, background: T.panel
          }}>
            <div style={{ fontSize: 13, color: T.muted }}>
              Search for a specific item or click "Show all" to browse all 400 items.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

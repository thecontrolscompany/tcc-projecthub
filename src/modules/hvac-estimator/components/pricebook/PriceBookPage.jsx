"use client";

import { useEffect, useMemo, useState } from "react";
import { T, CAT_COLOR } from "../../shared/tokens.js";
import { loadStarred, saveStarred } from "../../shared/starredItemsStore.js";

function TableHeader() {
  return (
    <thead>
      <tr style={{ borderBottom: "2px solid " + T.border }}>
        {["★", "Description", "Material", "Labor", ""].map((h) => (
          <th
            key={h}
            style={{
              padding: "7px 10px",
              textAlign: "left",
              fontSize: 10,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: T.muted,
              fontFamily: T.mono,
              fontWeight: 600,
            }}
          >
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function cloneCatalog(catalog) {
  return { ...(catalog ?? {}) };
}

function sortCatalogRows(catalog) {
  return Object.values(catalog ?? {}).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function escapeCsvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function parseCsvRow(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

async function patchCatalogRow({ organizationId, catalogType, id, mtlUnit, hrsUnit, partNumber, manufacturer }) {
  const body = {
    organizationId,
    mtlUnit,
    hrsUnit,
  };

  if (partNumber !== undefined) body.partNumber = partNumber;
  if (manufacturer !== undefined) body.manufacturer = manufacturer;

  const response = await fetch(`/api/estimating/catalog/${catalogType}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof json?.error === "string" ? json.error : "Unable to save price.");
  }

  return json?.row ?? null;
}

export default function PriceBookPage({ installCatalog, controlsCatalog, organizationId }) {
  const [activeTab, setActiveTab] = useState("installation");
  const [installRows, setInstallRows] = useState(() => cloneCatalog(installCatalog));
  const [controlsRows, setControlsRows] = useState(() => cloneCatalog(controlsCatalog));
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [recentKey, setRecentKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [starred, setStarred] = useState(() => {
    try {
      return loadStarred();
    } catch {
      return [];
    }
  });

  useEffect(() => {
    setInstallRows(cloneCatalog(installCatalog));
  }, [installCatalog]);

  useEffect(() => {
    setControlsRows(cloneCatalog(controlsCatalog));
  }, [controlsCatalog]);

  const activeCatalogType = activeTab === "installation" ? "install" : "controls";
  const activeCatalog = activeTab === "installation" ? installRows : controlsRows;
  const activeRows = useMemo(() => sortCatalogRows(activeCatalog), [activeCatalog]);
  const starredItems = useMemo(() => activeRows.filter((row) => starred.includes(row.id)), [activeRows, starred]);
  const filteredRows = useMemo(() => {
    if (!search.trim()) return showAll ? activeRows : [];
    const query = search.toLowerCase();
    return activeRows.filter(
      (row) => row.desc.toLowerCase().includes(query) || row.id.includes(query) || (row.category ?? "").toLowerCase().includes(query),
    );
  }, [activeRows, search, showAll]);

  const currentRows = search.trim() ? filteredRows : activeRows;
  const shouldShowTable = Boolean(search.trim()) || showAll;

  const toggleStar = (id) => {
    const updated = starred.includes(id) ? starred.filter((value) => value !== id) : [...starred, id];
    setStarred(updated);
    saveStarred(updated);
  };

  const updateCatalogRow = async (id, field, event) => {
    const input = event.target;
    const numericValue = Number.parseFloat(input.value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      input.value = String(activeCatalog[id]?.[field] ?? "");
      return;
    }

    const row = activeCatalog[id];
    if (!row) return;

    const nextValue = field === "mtlUnit" ? numericValue : numericValue;
    const key = `${id}:${field}`;
    setSavingKey(key);
    try {
      const savedRow = await patchCatalogRow({
        organizationId,
        catalogType: activeCatalogType,
        id,
        mtlUnit: field === "mtlUnit" ? nextValue : row.mtlUnit,
        hrsUnit: field === "hrsUnit" ? nextValue : row.hrsUnit,
      });

      if (!savedRow) return;

      const mappedRow = {
        id: savedRow.id,
        desc: savedRow.description,
        mtlUnit: Number(savedRow.mtl_unit ?? 0),
        mtlPer: savedRow.mtl_per ?? "E",
        hrsUnit: Number(savedRow.hrs_unit ?? 0),
        hrsPer: savedRow.hrs_per ?? "E",
        category: savedRow.category ?? null,
        freq: Boolean(savedRow.freq),
        alternateIds: Array.isArray(savedRow.alternate_ids) ? savedRow.alternate_ids : [],
        partNumber: savedRow.part_number ?? null,
        manufacturer: savedRow.manufacturer ?? null,
      };

      if (activeTab === "installation") {
        setInstallRows((current) => ({ ...current, [id]: mappedRow }));
      } else {
        setControlsRows((current) => ({ ...current, [id]: mappedRow }));
      }

      setRecentKey(key);
      window.setTimeout(() => setRecentKey(null), 900);
    } catch (error) {
      input.value = String(activeCatalog[id]?.[field] ?? "");
      window.alert(error instanceof Error ? error.message : "Unable to save price.");
    } finally {
      setSavingKey(null);
    }
  };

  const updateControlsTextRow = async (id, field, event) => {
    if (activeCatalogType !== "controls") return;

    const input = event.target;
    const row = activeCatalog[id];
    if (!row) return;

    const key = `${id}:${field}`;
    const nextValue = input.value.trim();
    setSavingKey(key);

    try {
      const savedRow = await patchCatalogRow({
        organizationId,
        catalogType: activeCatalogType,
        id,
        mtlUnit: row.mtlUnit,
        hrsUnit: row.hrsUnit,
        partNumber: field === "partNumber" ? (nextValue || null) : row.partNumber ?? null,
        manufacturer: field === "manufacturer" ? (nextValue || null) : row.manufacturer ?? null,
      });

      if (!savedRow) return;

      const mappedRow = {
        id: savedRow.id,
        desc: savedRow.description,
        mtlUnit: Number(savedRow.mtl_unit ?? 0),
        mtlPer: savedRow.mtl_per ?? "E",
        hrsUnit: Number(savedRow.hrs_unit ?? 0),
        hrsPer: savedRow.hrs_per ?? "E",
        category: savedRow.category ?? null,
        freq: Boolean(savedRow.freq),
        alternateIds: Array.isArray(savedRow.alternate_ids) ? savedRow.alternate_ids : [],
        partNumber: savedRow.part_number ?? null,
        manufacturer: savedRow.manufacturer ?? null,
      };

      setControlsRows((current) => ({ ...current, [id]: mappedRow }));
      setRecentKey(key);
      window.setTimeout(() => setRecentKey(null), 900);
    } catch (error) {
      input.value = String(activeCatalog[id]?.[field] ?? "");
      window.alert(error instanceof Error ? error.message : "Unable to save price.");
    } finally {
      setSavingKey(null);
    }
  };

  const exportCSV = () => {
    const rows = activeCatalogType === "controls"
      ? [["Item ID", "Description", "Category", "Part #", "Manufacturer", "Mtl Unit", "Mtl Per", "Hrs Unit", "Hrs Per"]]
      : [["Item ID", "Description", "Category", "Mtl Unit", "Mtl Per", "Hrs Unit", "Hrs Per"]];
    for (const item of activeRows) {
      rows.push(
        activeCatalogType === "controls"
          ? [
              item.id,
              item.desc,
              item.category ?? "",
              item.partNumber ?? "",
              item.manufacturer ?? "",
              item.mtlUnit,
              item.mtlPer,
              item.hrsUnit,
              item.hrsPer,
            ]
          : [
              item.id,
              item.desc,
              item.category ?? "",
              item.mtlUnit,
              item.mtlPer,
              item.hrsUnit,
              item.hrsPer,
            ],
      );
    }

    const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeCatalogType}_assembly_catalog.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importCSV = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).slice(1);
    let updatedCount = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      const cells = parseCsvRow(line);
      const [id, , , mtlUnit, , hrsUnit] = cells;
      const row = activeCatalog[id];
      if (!row) continue;

      const nextMtl = Number.parseFloat(mtlUnit);
      const nextHrs = Number.parseFloat(hrsUnit);
      if (!Number.isFinite(nextMtl) || !Number.isFinite(nextHrs)) continue;

      const shouldSave =
        Math.abs(nextMtl - row.mtlUnit) > 0.000001 ||
        Math.abs(nextHrs - row.hrsUnit) > 0.000001;

      if (!shouldSave) continue;

      const savedRow = await patchCatalogRow({
        organizationId,
        catalogType: activeCatalogType,
        id,
        mtlUnit: nextMtl,
        hrsUnit: nextHrs,
      });

      if (!savedRow) continue;

      const mappedRow = {
        id: savedRow.id,
        desc: savedRow.description,
        mtlUnit: Number(savedRow.mtl_unit ?? 0),
        mtlPer: savedRow.mtl_per ?? "E",
        hrsUnit: Number(savedRow.hrs_unit ?? 0),
        hrsPer: savedRow.hrs_per ?? "E",
        category: savedRow.category ?? null,
        freq: Boolean(savedRow.freq),
        alternateIds: Array.isArray(savedRow.alternate_ids) ? savedRow.alternate_ids : [],
        partNumber: savedRow.part_number ?? null,
        manufacturer: savedRow.manufacturer ?? null,
      };

      if (activeTab === "installation") {
        setInstallRows((current) => ({ ...current, [id]: mappedRow }));
      } else {
        setControlsRows((current) => ({ ...current, [id]: mappedRow }));
      }
      updatedCount += 1;
    }

    window.alert(`Import complete - ${updatedCount} item${updatedCount === 1 ? "" : "s"} updated.`);
    event.target.value = "";
  };

  const fmt4 = (value) => "$" + (Number(value) || 0).toFixed(4);

  const ItemRow = ({ item, idx }) => {
    const color = CAT_COLOR[item.category] || T.steel;
    const isStarred = starred.includes(item.id);
    const perLabel = item.mtlPer === "C" ? "/100" : item.mtlPer === "M" ? "/1000" : "/ea";
    const lbrLabel = item.hrsPer === "C" ? "/100" : item.hrsPer === "M" ? "/1000" : "/ea";
    const saveMtlKey = `${item.id}:mtlUnit`;
    const saveHrsKey = `${item.id}:hrsUnit`;

    return (
      <tr
        style={{
          borderBottom: "1px solid " + T.border,
          background: idx % 2 === 0 ? T.surface : T.faint,
        }}
      >
        <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
          <button
            onClick={() => toggleStar(item.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              color: isStarred ? T.amber : T.border2,
              padding: "0 4px",
              lineHeight: 1,
              marginRight: 4,
            }}
          >
            ★
          </button>
          <span style={{ fontSize: 10, color: T.dim, fontFamily: T.mono }}>{item.id}</span>
        </td>
        <td style={{ padding: "7px 10px", maxWidth: 280 }}>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{item.desc}</div>
          <div style={{ fontSize: 10, color: color, fontFamily: T.mono }}>{item.category || "Uncategorized"}</div>
          {activeTab === "controls" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 9, color: T.dim, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1 }}>Part #</span>
                <input
                  type="text"
                  defaultValue={item.partNumber ?? ""}
                  key={`${item.id}:part:${item.partNumber ?? ""}`}
                  onBlur={(event) => void updateControlsTextRow(item.id, "partNumber", event)}
                  style={{
                    width: 118,
                    padding: "3px 6px",
                    border: "1px solid " + color,
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: T.mono,
                    background: color + "10",
                    color: T.text,
                    outline: "none",
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 140px", minWidth: 140 }}>
                <span style={{ fontSize: 9, color: T.dim, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1 }}>Manufacturer</span>
                <input
                  type="text"
                  defaultValue={item.manufacturer ?? ""}
                  key={`${item.id}:manufacturer:${item.manufacturer ?? ""}`}
                  onBlur={(event) => void updateControlsTextRow(item.id, "manufacturer", event)}
                  style={{
                    width: "100%",
                    padding: "3px 6px",
                    border: "1px solid " + color,
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: T.mono,
                    background: color + "10",
                    color: T.text,
                    outline: "none",
                  }}
                />
              </label>
            </div>
          )}
        </td>
        <td style={{ padding: "7px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 11, color: T.dim }}>$</span>
            <input
              type="number"
              min="0"
              step="0.001"
              defaultValue={item.mtlUnit}
              key={`${item.id}:mtl:${item.mtlUnit}`}
              onBlur={(event) => void updateCatalogRow(item.id, "mtlUnit", event)}
              style={{
                width: 88,
                padding: "3px 6px",
                border: "1px solid " + (savingKey === saveMtlKey ? T.blue : color),
                borderRadius: 4,
                fontSize: 12,
                fontFamily: T.mono,
                background: color + "10",
                color: T.text,
                outline: "none",
                textAlign: "right",
                boxShadow: recentKey === saveMtlKey ? `0 0 0 2px ${T.blueFaint}` : "none",
              }}
            />
            <span style={{ fontSize: 10, color: T.dim, fontFamily: T.mono }}>{perLabel}</span>
          </div>
          <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, marginTop: 2 }}>{fmt4(item.mtlUnit)}</div>
        </td>
        <td style={{ padding: "7px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <input
              type="number"
              min="0"
              step="0.001"
              defaultValue={item.hrsUnit}
              key={`${item.id}:hrs:${item.hrsUnit}`}
              onBlur={(event) => void updateCatalogRow(item.id, "hrsUnit", event)}
              style={{
                width: 88,
                padding: "3px 6px",
                border: "1px solid " + (savingKey === saveHrsKey ? T.blue : color),
                borderRadius: 4,
                fontSize: 12,
                fontFamily: T.mono,
                background: color + "10",
                color: T.text,
                outline: "none",
                textAlign: "right",
                boxShadow: recentKey === saveHrsKey ? `0 0 0 2px ${T.blueFaint}` : "none",
              }}
            />
            <span style={{ fontSize: 10, color: T.dim, fontFamily: T.mono }}>h{lbrLabel}</span>
          </div>
          <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, marginTop: 2 }}>{item.hrsUnit}h</div>
        </td>
        <td style={{ padding: "7px 10px", color: T.muted, fontSize: 11, fontFamily: T.mono }}>
          Live catalog
        </td>
      </tr>
    );
  };

  const tabLabel = activeTab === "installation" ? "Installation" : "Controls";
  const emptyControls = activeTab === "controls" && activeRows.length === 0;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 4 }}>Price Book</div>
          <div style={{ fontSize: 13, color: T.muted }}>
            Live catalog pricing for the {tabLabel.toLowerCase()} assembly book.
          </div>
          <div style={{ fontSize: 12, color: T.dim, marginTop: 4 }}>
            Click ★ on any item to pin it to the top. Export CSV to edit in Excel, then reimport.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={exportCSV}
            style={{
              padding: "8px 16px",
              border: "1px solid " + T.blue,
              borderRadius: 5,
              background: T.blueFaint,
              color: T.blue,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: T.mono,
            }}
          >
            ↓ Export CSV
          </button>
          <label
            style={{
              padding: "8px 16px",
              border: "1px solid " + T.border2,
              borderRadius: 5,
              background: "none",
              color: T.muted,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: T.mono,
            }}
          >
            ↑ Import CSV
            <input type="file" accept=".csv" onChange={(event) => void importCSV(event)} style={{ display: "none" }} />
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { id: "installation", label: `Installation (${Object.keys(installRows).length})` },
          { id: "controls", label: `Controls (${Object.keys(controlsRows).length})` },
        ].map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setSearch("");
                setShowAll(false);
              }}
              style={{
                padding: "8px 14px",
                border: "1px solid " + (selected ? T.blue : T.border2),
                borderRadius: 999,
                background: selected ? T.blueFaint : "transparent",
                color: selected ? T.blue : T.muted,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: T.mono,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {starredItems.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: T.amber,
              fontFamily: T.mono,
              marginBottom: 10,
            }}
          >
            ★ Starred Items
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <TableHeader />
            <tbody>
              {starredItems.map((item, idx) => (
                <ItemRow key={item.id} item={item} idx={idx} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {starredItems.length === 0 && activeRows.length > 0 && (
        <div
          style={{
            marginBottom: 24,
            padding: "12px 16px",
            border: "1px dashed " + T.border,
            borderRadius: 6,
            background: T.panel,
            fontSize: 12,
            color: T.dim,
          }}
        >
          Click ★ on any item below to pin it here for quick access.
        </div>
      )}

      {emptyControls ? (
        <div
          style={{
            padding: "20px 18px",
            border: "1px dashed " + T.border,
            borderRadius: 8,
            background: T.panel,
            color: T.muted,
            fontSize: 13,
          }}
        >
          Controls catalog is empty. Populated in a future update.
        </div>
      ) : (
        <div style={{ borderTop: "1px solid " + T.border, paddingTop: 24 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: T.muted,
              fontFamily: T.mono,
              marginBottom: 12,
            }}
          >
            {activeRows.length} Items
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 13,
                  color: T.dim,
                }}
              >
                🔍
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by item #, description, or category..."
                style={{
                  width: "100%",
                  padding: "8px 10px 8px 32px",
                  border: "1px solid " + T.border2,
                  borderRadius: 5,
                  fontSize: 13,
                  background: T.bg,
                  color: T.text,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: T.dim,
                    cursor: "pointer",
                    fontSize: 16,
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              style={{
                padding: "8px 14px",
                border: "1px solid " + T.border2,
                borderRadius: 5,
                background: "none",
                color: showAll ? T.blue : T.muted,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: T.mono,
                whiteSpace: "nowrap",
              }}
            >
              {showAll ? "Hide all" : "Show all"}
            </button>
          </div>

          {shouldShowTable && currentRows.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <TableHeader />
              <tbody>
                {currentRows.map((item, idx) => (
                  <ItemRow key={item.id} item={item} idx={idx} />
                ))}
              </tbody>
            </table>
          )}

          {shouldShowTable && currentRows.length === 0 && (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                border: "2px dashed " + T.border,
                borderRadius: 8,
                background: T.panel,
              }}
            >
              <div style={{ fontSize: 13, color: T.muted }}>No catalog items matched your search.</div>
            </div>
          )}

          {!shouldShowTable && (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                border: "2px dashed " + T.border,
                borderRadius: 8,
                background: T.panel,
              }}
            >
              <div style={{ fontSize: 13, color: T.muted }}>
                Search for a specific item or click "Show all" to browse the live catalog.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

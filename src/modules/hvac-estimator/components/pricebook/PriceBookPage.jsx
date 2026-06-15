"use client";

import { useEffect, useMemo, useState } from "react";
import { T, CAT_COLOR } from "../../shared/tokens.js";
import { loadStarred, saveStarred } from "../../shared/starredItemsStore.js";
import { buildDefaultPartsIndex } from "../../shared/defaultPartsIndex.js";

const DEFAULT_TABLE_COLUMNS = ["★", "Description", "Material", "Labor", "Default For"];

function TableHeader({ columns = DEFAULT_TABLE_COLUMNS }) {
  return (
    <thead>
      <tr style={{ borderBottom: "2px solid " + T.border }}>
        {columns.map((column) => {
          const key = typeof column === "string" ? column : column.key;
          const label = typeof column === "string" ? column : column.label;
          return (
            <th
              key={key}
              style={{
                padding: "7px 10px",
                textAlign: "left",
                fontSize: 11,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: T.muted,
                fontFamily: T.mono,
                fontWeight: 600,
              }}
            >
              {label}
            </th>
          );
        })}
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

async function patchControlsDefault({ organizationId, componentKey, controlsCatalogId }) {
  const response = await fetch("/api/estimating/controls-defaults", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId, componentKey, controlsCatalogId }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof json?.error === "string" ? json.error : "Unable to save default.");
  }
  return json?.overrides ?? {};
}

async function deleteControlsDefault({ organizationId, componentKey }) {
  const response = await fetch("/api/estimating/controls-defaults", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId, componentKey }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof json?.error === "string" ? json.error : "Unable to reset default.");
  }
  return json?.overrides ?? {};
}

export default function PriceBookPage({ installCatalog, controlsCatalog, controlsDefaultOverrides: controlsDefaultOverridesProp = {}, organizationId }) {
  const [activeTab, setActiveTab] = useState("installation");
  const [installRows, setInstallRows] = useState(() => cloneCatalog(installCatalog));
  const [controlsRows, setControlsRows] = useState(() => cloneCatalog(controlsCatalog));
  const [controlsDefaultOverrides, setControlsDefaultOverrides] = useState(() => ({ ...(controlsDefaultOverridesProp ?? {}) }));
  const [search, setSearch] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [defaultsOnly, setDefaultsOnly] = useState(false);
  const [recentKey, setRecentKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [savingDefaultKey, setSavingDefaultKey] = useState(null);
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

  useEffect(() => {
    setControlsDefaultOverrides({ ...(controlsDefaultOverridesProp ?? {}) });
  }, [controlsDefaultOverridesProp]);

  const defaultPartsIndex = useMemo(() => buildDefaultPartsIndex(controlsDefaultOverrides), [controlsDefaultOverrides]);
  const activeCatalogType = activeTab === "installation" ? "install" : "controls";
  const activeCatalog = activeTab === "installation" ? installRows : controlsRows;
  const defaultsByCatalogId =
    activeTab === "controls" ? defaultPartsIndex.controlsDefaultsByCatalogId : defaultPartsIndex.installDefaultsByCatalogId;
  const activeRows = useMemo(() => sortCatalogRows(activeCatalog), [activeCatalog]);
  const scopedRows = useMemo(
    () => (defaultsOnly ? activeRows.filter((row) => defaultsByCatalogId.has(row.id)) : activeRows),
    [activeRows, defaultsByCatalogId, defaultsOnly],
  );
  const starredItems = useMemo(() => scopedRows.filter((row) => starred.includes(row.id)), [scopedRows, starred]);
  const filteredRows = useMemo(() => {
    if (!search.trim()) return showAll ? scopedRows : [];
    const query = search.toLowerCase();

    return scopedRows.filter((row) => {
      const defaultUsages = defaultsByCatalogId.get(row.id) ?? [];
      return (
        row.desc.toLowerCase().includes(query) ||
        row.id.toLowerCase().includes(query) ||
        (row.category ?? "").toLowerCase().includes(query) ||
        defaultUsages.some(
          (usage) =>
            usage.pointName.toLowerCase().includes(query) || usage.equipmentType.toLowerCase().includes(query),
        )
      );
    });
  }, [defaultsByCatalogId, scopedRows, search, showAll]);
  const currentRows = search.trim() ? filteredRows : scopedRows;
  const shouldShowTable = Boolean(search.trim()) || showAll;

  const assignmentRows = useMemo(() => {
    const query = assignmentSearch.trim().toLowerCase();
    if (!query) return defaultPartsIndex.assignments;

    return defaultPartsIndex.assignments.filter((assignment) => {
      const controlsRow = assignment.controlsCatalogId ? controlsRows[assignment.controlsCatalogId] : null;
      const installRow = assignment.installCatalogId ? installRows[assignment.installCatalogId] : null;
      const installRowPlenum = assignment.installCatalogIdPlenum ? installRows[assignment.installCatalogIdPlenum] : null;
      return [
        assignment.equipmentType,
        assignment.pointName,
        assignment.category ?? "",
        assignment.controlsCatalogId ?? "",
        assignment.installCatalogId ?? "",
        controlsRow?.desc ?? "",
        controlsRow?.partNumber ?? "",
        installRow?.desc ?? "",
        installRow?.partNumber ?? "",
        installRowPlenum?.desc ?? "",
        installRowPlenum?.partNumber ?? "",
      ].some((value) => String(value).toLowerCase().includes(query));
    });
  }, [assignmentSearch, controlsRows, defaultPartsIndex.assignments, installRows]);

  function controlsOptionsForAssignment(assignment) {
    const all = sortCatalogRows(controlsRows);
    const sameCategory = assignment.category ? all.filter((row) => row.category === assignment.category) : all;
    const options = sameCategory.length > 0 ? sameCategory : all;
    if (assignment.controlsCatalogId && !options.some((row) => row.id === assignment.controlsCatalogId)) {
      const current = controlsRows[assignment.controlsCatalogId];
      if (current) return [current, ...options];
    }
    return options;
  }

  const updateControlsDefault = async (assignment, controlsCatalogId) => {
    if (!controlsCatalogId || controlsCatalogId === assignment.controlsCatalogId) return;
    setSavingDefaultKey(assignment.componentKey);
    try {
      const overrides = await patchControlsDefault({
        organizationId,
        componentKey: assignment.componentKey,
        controlsCatalogId,
      });
      setControlsDefaultOverrides(overrides);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to save default.");
    } finally {
      setSavingDefaultKey(null);
    }
  };

  const resetControlsDefault = async (assignment) => {
    setSavingDefaultKey(assignment.componentKey);
    try {
      const overrides = await deleteControlsDefault({ organizationId, componentKey: assignment.componentKey });
      setControlsDefaultOverrides(overrides);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to reset default.");
    } finally {
      setSavingDefaultKey(null);
    }
  };

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
    const rows =
      activeCatalogType === "controls"
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
          : [item.id, item.desc, item.category ?? "", item.mtlUnit, item.mtlPer, item.hrsUnit, item.hrsPer],
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
        Math.abs(nextMtl - row.mtlUnit) > 0.000001 || Math.abs(nextHrs - row.hrsUnit) > 0.000001;

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
    const defaultUsages = defaultsByCatalogId.get(item.id) ?? [];
    const visibleDefaultUsages = defaultUsages.slice(0, 3);
    const defaultTooltip = defaultUsages
      .map(
        (usage) =>
          `${usage.equipmentType}: ${usage.pointName}${usage.conditional ? " (conditional)" : ""}${usage.installType ? ` [${usage.installType}]` : ""}`,
      )
      .join("\n");
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
          <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>{item.id}</span>
        </td>
        <td style={{ padding: "7px 10px", maxWidth: 280 }}>
          <div style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>{item.desc}</div>
          <div style={{ fontSize: 11, color: color, fontFamily: T.mono }}>{item.category || "Uncategorized"}</div>
          {activeTab === "controls" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                  style={{
                    fontSize: 10,
                    color: T.dim,
                    fontFamily: T.mono,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Part #
                </span>
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
                    fontSize: 12,
                    fontFamily: T.mono,
                    background: color + "10",
                    color: T.text,
                    outline: "none",
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 140px", minWidth: 140 }}>
                <span
                  style={{
                    fontSize: 10,
                    color: T.dim,
                    fontFamily: T.mono,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Manufacturer
                </span>
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
                    fontSize: 12,
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
            <span style={{ fontSize: 12, color: T.dim }}>$</span>
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
                fontSize: 14,
                fontFamily: T.mono,
                background: color + "10",
                color: T.text,
                outline: "none",
                textAlign: "right",
                boxShadow: recentKey === saveMtlKey ? `0 0 0 2px ${T.blueFaint}` : "none",
              }}
            />
            <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>{perLabel}</span>
          </div>
          <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 2 }}>{fmt4(item.mtlUnit)}</div>
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
                fontSize: 14,
                fontFamily: T.mono,
                background: color + "10",
                color: T.text,
                outline: "none",
                textAlign: "right",
                boxShadow: recentKey === saveHrsKey ? `0 0 0 2px ${T.blueFaint}` : "none",
              }}
            />
            <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>h{lbrLabel}</span>
          </div>
          <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 2 }}>{item.hrsUnit}h</div>
        </td>
        <td style={{ padding: "7px 10px", color: T.muted, fontSize: 13, fontFamily: T.mono }}>
          {defaultUsages.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {visibleDefaultUsages.map((usage) => (
                <div
                  key={`${usage.equipmentType}::${usage.pointName}::${usage.installType ?? ""}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 4,
                    color: T.green,
                    fontSize: 12,
                    fontFamily: T.mono,
                    lineHeight: 1.3,
                    flexWrap: "wrap",
                  }}
                >
                  <span>{usage.equipmentType}: {usage.pointName}</span>
                  {usage.conditional && (
                    <span title={usage.conditionSource ?? ""} style={{ color: T.amber, cursor: "help" }}>
                      *
                    </span>
                  )}
                  {usage.installType && <span>[{usage.installType}]</span>}
                </div>
              ))}
              {defaultUsages.length > 3 && (
                <div title={defaultTooltip} style={{ color: T.dim, fontSize: 12, fontFamily: T.mono, lineHeight: 1.3 }}>
                  +{defaultUsages.length - 3} more
                </div>
              )}
            </div>
          ) : (
            <span style={{ color: T.dim }}>—</span>
          )}
        </td>
      </tr>
    );
  };

  const AssignmentRow = ({ assignment, idx }) => {
    const color = CAT_COLOR[assignment.category] || T.steel;
    const controlsRow = assignment.controlsCatalogId ? controlsRows[assignment.controlsCatalogId] : null;
    const installRow = assignment.installCatalogId ? installRows[assignment.installCatalogId] : null;
    const installRowPlenum = assignment.installCatalogIdPlenum ? installRows[assignment.installCatalogIdPlenum] : null;
    const installLabel = assignment.installCatalogId
      ? `${assignment.installCatalogId}${installRow?.desc ? ` — ${installRow.desc}` : ""}${
          installRowPlenum
            ? ` / ${assignment.installCatalogIdPlenum}${installRowPlenum?.desc ? ` (Plenum) — ${installRowPlenum.desc}` : ""}`
            : ""
        }`
      : "—";

    return (
      <tr
        style={{
          borderBottom: "1px solid " + T.border,
          background: idx % 2 === 0 ? T.surface : T.faint,
        }}
      >
        <td style={{ padding: "7px 10px", color: T.text, fontSize: 13, fontFamily: T.mono, whiteSpace: "nowrap" }}>
          {assignment.equipmentType}
        </td>
        <td style={{ padding: "7px 10px", color: T.text, fontSize: 13 }}>
          <span>{assignment.pointName}</span>
          {assignment.conditional && (
            <span
              title={assignment.conditionSource ?? ""}
              style={{ marginLeft: 4, color: T.amber, fontFamily: T.mono, fontSize: 12, cursor: "help" }}
            >
              *
            </span>
          )}
        </td>
        <td style={{ padding: "7px 10px", color, fontSize: 13, fontFamily: T.mono, whiteSpace: "nowrap" }}>
          {assignment.category ?? "Uncategorized"}
        </td>
        <td style={{ padding: "7px 10px", color: T.text, fontSize: 13, fontFamily: T.mono }}>
          {assignment.controlsCatalogId ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <select
                value={assignment.controlsCatalogId}
                disabled={savingDefaultKey === assignment.componentKey}
                onChange={(event) => void updateControlsDefault(assignment, event.target.value)}
                style={{
                  width: "100%",
                  padding: "4px 6px",
                  border: "1px solid " + color,
                  borderRadius: 4,
                  fontSize: 12,
                  fontFamily: T.mono,
                  background: color + "10",
                  color: T.text,
                  outline: "none",
                }}
              >
                {controlsOptionsForAssignment(assignment).map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.id} — {row.desc}
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                {assignment.controlsOverridden ? (
                  <span
                    title={`Built-in default: ${assignment.builtInControlsCatalogId ?? "none"}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "1px 8px",
                      borderRadius: 999,
                      background: T.blueFaint,
                      color: T.blue,
                      fontSize: 11,
                      fontFamily: T.mono,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Org Default
                  </span>
                ) : null}
                {savingDefaultKey === assignment.componentKey ? (
                  <span style={{ color: T.dim, fontSize: 11, fontFamily: T.mono }}>Saving...</span>
                ) : assignment.controlsOverridden ? (
                  <button
                    type="button"
                    onClick={() => void resetControlsDefault(assignment)}
                    disabled={savingDefaultKey === assignment.componentKey}
                    style={{
                      border: "none",
                      background: "none",
                      color: T.blue,
                      cursor: "pointer",
                      fontSize: 11,
                      fontFamily: T.mono,
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    Reset to built-in
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            "—"
          )}
        </td>
        <td style={{ padding: "7px 10px", color: T.text, fontSize: 13, fontFamily: T.mono, whiteSpace: "nowrap" }}>
          {controlsRow?.partNumber ?? "—"}
        </td>
        <td style={{ padding: "7px 10px", color: T.text, fontSize: 13, fontFamily: T.mono, whiteSpace: "nowrap" }}>
          {controlsRow?.manufacturer ?? "—"}
        </td>
        <td style={{ padding: "7px 10px", color: T.text, fontSize: 13, fontFamily: T.mono, whiteSpace: "nowrap" }}>
          {controlsRow ? fmt4(controlsRow.mtlUnit) : "—"}
        </td>
        <td style={{ padding: "7px 10px", color: T.text, fontSize: 13, fontFamily: T.mono }}>
          {installLabel}
        </td>
        <td style={{ padding: "7px 10px", color: T.text, fontSize: 13, fontFamily: T.mono, whiteSpace: "nowrap" }}>
          {installRow ? fmt4(installRow.mtlUnit) : "—"}
        </td>
        <td style={{ padding: "7px 10px", color: T.text, fontSize: 13, fontFamily: T.mono, whiteSpace: "nowrap" }}>
          {installRow ? `${fmt4(installRow.hrsUnit)}` : "—"}
        </td>
      </tr>
    );
  };

  const tabLabel =
    activeTab === "installation" ? "Installation" : activeTab === "controls" ? "Controls" : "Default Assignments";
  const isCatalogTab = activeTab !== "defaults";
  const emptyControls = activeTab === "controls" && activeRows.length === 0;
  const defaultAssignmentColumns = [
    { key: "equipment", label: "Equipment" },
    { key: "point", label: "Point" },
    { key: "category", label: "Category" },
    { key: "controls-part", label: "Default Controls Part" },
    { key: "part-number", label: "Part #" },
    { key: "manufacturer", label: "Mfr" },
    { key: "controls-price", label: "Controls $/ea" },
    { key: "install-part", label: "Default Install Assembly" },
    { key: "install-price", label: "Install $/ea" },
    { key: "install-hours", label: "Install hrs" },
  ];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 4 }}>Price Book</div>
          <div style={{ fontSize: 14, color: T.muted }}>
            {activeTab === "defaults"
              ? "Reverse lookup of default assignments across the equipment catalogs."
              : `Live catalog pricing for the ${tabLabel.toLowerCase()} assembly book.`}
          </div>
          <div style={{ fontSize: 14, color: T.dim, marginTop: 4 }}>
            {activeTab === "defaults"
              ? "Search by equipment type, point name, or part number to trace defaults back to the catalog."
              : "Click ★ on any item to pin it to the top. Export CSV to edit in Excel, then reimport."}
          </div>
        </div>
        {isCatalogTab && (
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
                fontSize: 14,
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
                fontSize: 13,
                fontFamily: T.mono,
              }}
            >
              ↑ Import CSV
              <input type="file" accept=".csv" onChange={(event) => void importCSV(event)} style={{ display: "none" }} />
            </label>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { id: "installation", label: `Installation (${Object.keys(installRows).length})` },
          { id: "controls", label: `Controls (${Object.keys(controlsRows).length})` },
          { id: "defaults", label: `Default Assignments (${defaultPartsIndex.assignments.length})` },
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
                setDefaultsOnly(false);
              }}
              style={{
                padding: "8px 14px",
                border: "1px solid " + (selected ? T.blue : T.border2),
                borderRadius: 999,
                background: selected ? T.blueFaint : "transparent",
                color: selected ? T.blue : T.muted,
                cursor: "pointer",
                fontSize: 13,
                fontFamily: T.mono,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isCatalogTab ? (
        <>
          {starredItems.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div
                style={{
                  fontSize: 12,
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

          {starredItems.length === 0 && scopedRows.length > 0 && (
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
                fontSize: 14,
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
                {scopedRows.length} Items
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: "1 1 320px" }}>
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
                    placeholder="Search by item #, description, category, or default usage..."
                    style={{
                      width: "100%",
                      padding: "8px 10px 8px 32px",
                      border: "1px solid " + T.border2,
                      borderRadius: 5,
                      fontSize: 14,
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
                    fontSize: 13,
                    fontFamily: T.mono,
                    whiteSpace: "nowrap",
                  }}
                >
                  {showAll ? "Hide all" : "Show all"}
                </button>
                <button
                  type="button"
                  onClick={() => setDefaultsOnly((current) => !current)}
                  style={{
                    padding: "8px 14px",
                    border: "1px solid " + T.border2,
                    borderRadius: 5,
                    background: defaultsOnly ? T.green + "10" : "none",
                    color: defaultsOnly ? T.green : T.muted,
                    cursor: "pointer",
                    fontSize: 13,
                    fontFamily: T.mono,
                    whiteSpace: "nowrap",
                  }}
                >
                  {defaultsOnly ? "All items" : "Defaults only"}
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
                  <div style={{ fontSize: 14, color: T.muted }}>No catalog items matched your search.</div>
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
                  <div style={{ fontSize: 14, color: T.muted }}>
                    Search for a specific item or click "Show all" to browse the live catalog.
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div style={{ borderTop: "1px solid " + T.border, paddingTop: 24 }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: T.muted,
              fontFamily: T.mono,
              marginBottom: 12,
            }}
          >
            {assignmentRows.length} Assignments
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
                value={assignmentSearch}
                onChange={(event) => setAssignmentSearch(event.target.value)}
                placeholder="Search equipment, point, category, or catalog part..."
                style={{
                  width: "100%",
                  padding: "8px 10px 8px 32px",
                  border: "1px solid " + T.border2,
                  borderRadius: 5,
                  fontSize: 14,
                  background: T.bg,
                  color: T.text,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {assignmentSearch && (
                <button
                  type="button"
                  onClick={() => setAssignmentSearch("")}
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
          </div>

          {assignmentRows.length > 0 ? (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <TableHeader columns={defaultAssignmentColumns} />
                <tbody>
                  {assignmentRows.map((assignment, idx) => (
                    <AssignmentRow key={`${assignment.equipmentType}::${assignment.pointName}::${idx}`} assignment={assignment} idx={idx} />
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 10, fontSize: 13, color: T.dim, fontFamily: T.mono }}>
                * = conditional default - only applies for certain equipment configurations (hover for the condition)
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: T.dim, fontFamily: T.mono }}>
                "Default Controls Part" is editable - changes apply org-wide to new estimate items and to existing draft estimates the next time they're recalculated.
                {" "}
                "Org Default" = overridden from the built-in default; "Reset to built-in" removes the override.
              </div>
            </>
          ) : (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                border: "2px dashed " + T.border,
                borderRadius: 8,
                background: T.panel,
              }}
            >
              <div style={{ fontSize: 14, color: T.muted }}>No default assignments matched your search.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

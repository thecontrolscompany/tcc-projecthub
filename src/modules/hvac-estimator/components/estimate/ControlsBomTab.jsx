import { useMemo, useState } from "react";
import { T } from "../../shared/tokens.js";
import { fmt$, fmtHr } from "../../shared/utils.js";
import { deriveControlsBomRows } from "./estimateCalc.js";

const headerCellStyle = {
  padding: "8px 10px",
  borderBottom: "1px solid " + T.border,
  fontSize: 9,
  color: T.muted,
  fontFamily: T.mono,
  textTransform: "uppercase",
  letterSpacing: 1.1,
  whiteSpace: "nowrap",
};

const bodyCellStyle = {
  padding: "8px 10px",
  borderBottom: "1px solid " + T.border,
  fontSize: 11,
  fontFamily: T.mono,
  whiteSpace: "nowrap",
  color: T.text,
};

function formatQtyDisplay(row) {
  const qtyPerUnit = Number(row.qtyPerUnit) || 0;
  const equipmentQty = Number(row.equipmentQty) || 0;
  const extendedQty = Number(row.extendedQty) || 0;
  if (qtyPerUnit === 1 && equipmentQty === 1 && extendedQty === 1) return "1";
  if (equipmentQty > 1 || qtyPerUnit > 1) return `${qtyPerUnit} × ${equipmentQty} = ${extendedQty}`;
  return String(extendedQty || qtyPerUnit || equipmentQty || 1);
}

function ActionPlaceholder({ label }) {
  return (
    <button
      type="button"
      disabled
      title="Read-only in this pass"
      style={{
        padding: "3px 6px",
        border: "1px solid " + T.border2,
        borderRadius: 999,
        background: T.panel,
        color: T.muted,
        cursor: "not-allowed",
        fontSize: 10,
        fontFamily: T.mono,
        fontWeight: 700,
        opacity: 0.7,
      }}
    >
      {label}
    </button>
  );
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((cell) => csvEscape(cell)).join(","))
    .join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ControlsBomTab({ estimate, controlsCatalog, settings }) {
  const [vendorFilter, setVendorFilter] = useState("all");
  const bom = useMemo(
    () => deriveControlsBomRows(estimate, controlsCatalog, settings),
    [controlsCatalog, estimate, settings]
  );
  const vendorOptions = useMemo(() => {
    const names = new Set();
    for (const group of bom.groups || []) {
      for (const row of group.rows || []) {
        const vendor = String(row.vendor || row.manufacturer || "").trim();
        if (vendor) names.add(vendor);
      }
    }
    return ["all", ...Array.from(names).sort((left, right) => left.localeCompare(right))];
  }, [bom.groups]);
  const filteredGroups = useMemo(() => {
    if (vendorFilter === "all") return bom.groups || [];
    return (bom.groups || [])
      .map((group) => ({
        ...group,
        rows: (group.rows || []).filter((row) => String(row.vendor || row.manufacturer || "").trim() === vendorFilter),
      }))
      .filter((group) => group.rows.length > 0)
      .map((group) => ({
        ...group,
        subtotalInternalCost: group.rows.reduce((sum, row) => sum + (row.totalInternalCost || 0), 0),
        subtotalMaterialCost: group.rows.reduce((sum, row) => sum + (row.extendedMaterialCost || 0), 0),
        subtotalLaborHours: group.rows.reduce((sum, row) => sum + (row.extendedLaborHours || 0), 0),
      }));
  }, [bom.groups, vendorFilter]);
  const visibleRowCount = filteredGroups.reduce((sum, group) => sum + (group.rows?.length || 0), 0);
  const totalRowCount = bom.totals.rowCount || 0;

  const handleExportCsv = () => {
    const rows = [
      ["Controls Part", "Part Number", "Vendor", "Qty", "Unit Mtl ($)", "Ext Mtl ($)", "Unit Labor (h)", "Ext Labor (h)", "Internal Cost ($)"],
    ];

    for (const group of filteredGroups) {
      for (const row of group.rows || []) {
        rows.push([
          row.controlsPart || "",
          row.displayPartNumber || row.internalId || "",
          row.vendor || row.manufacturer || "",
          formatQtyDisplay(row),
          Number(row.unitMaterialCost || 0).toFixed(2),
          Number(row.extendedMaterialCost || 0).toFixed(2),
          Number(row.unitLaborHours || 0).toFixed(2),
          Number(row.extendedLaborHours || 0).toFixed(2),
          Number(row.totalInternalCost || 0).toFixed(2),
        ]);
      }
      rows.push(["", "", "", "", "", "", "", "", ""]);
    }

    downloadCsv("controls-parts.csv", rows);
  };

  return (
    <section
      role="tabpanel"
      id="estimator-panel-controlsBom"
      aria-labelledby="estimator-tab-controlsBom"
      style={{ display: "grid", gap: 12, marginTop: 18 }}
    >
      <div
        style={{
          border: "1px solid " + T.border,
          borderRadius: 10,
          background: T.surface,
          overflow: "hidden",
          padding: "10px 14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3 }}>
              Controls Parts
            </div>
            <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>
              Controls parts breakdown for the estimate, with vendor filtering and export-ready rows.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.muted, fontFamily: T.mono }}>
              <span>Vendor</span>
              <select
                value={vendorFilter}
                onChange={(event) => setVendorFilter(event.target.value)}
                style={{
                  border: "1px solid " + T.border2,
                  borderRadius: 999,
                  background: T.surface,
                  color: T.text,
                  padding: "6px 10px",
                  fontSize: 11,
                  fontFamily: T.mono,
                  outline: "none",
                }}
              >
                {vendorOptions.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {vendor === "all" ? "All Vendors" : vendor}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleExportCsv}
              className="rounded-full border border-border-default bg-surface-overlay px-3 py-2 text-sm font-semibold text-text-primary transition hover:border-brand-primary/40 hover:bg-brand-subtle/40"
            >
              Export CSV
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: T.muted, fontFamily: T.mono }}>
          <span>{filteredGroups.length} group{filteredGroups.length === 1 ? "" : "s"}</span>
          <span>Showing {visibleRowCount} of {totalRowCount} rows</span>
          <span>{fmt$(filteredGroups.reduce((sum, group) => sum + (group.subtotalInternalCost || 0), 0))} internal cost</span>
        </div>
      </div>

      {filteredGroups.length ? (
        <div style={{ display: "grid", gap: 12 }}>
          {filteredGroups.map((group) => (
            <section
              key={group.id}
              style={{
                border: "1px solid " + T.border,
                borderRadius: 12,
                background: T.surface,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "10px 12px",
                  borderBottom: "1px solid " + T.border,
                  background: T.panel,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
                    {group.sourceLabel}
                  </div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, marginTop: 2 }}>
                    Tag {group.tag || "—"} · Type {group.equipmentType || "—"} · {group.rows.length} controls row{group.rows.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <div style={{ minWidth: 116, padding: "6px 10px", borderRadius: 10, border: "1px solid " + T.border, background: T.surface, textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.1 }}>
                      Internal cost
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.blue, fontFamily: T.mono, marginTop: 2 }}>
                      {fmt$(group.subtotalInternalCost)}
                    </div>
                  </div>
                  <div style={{ minWidth: 116, padding: "6px 10px", borderRadius: 10, border: "1px solid " + T.border, background: T.surface, textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.1 }}>
                      Labor hrs
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.steel, fontFamily: T.mono, marginTop: 2 }}>
                      {fmtHr(group.subtotalLaborHours)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
                  <thead>
                    <tr style={{ background: T.surface }}>
                      <th style={{ ...headerCellStyle, textAlign: "left" }}>Controls Part</th>
                      <th style={{ ...headerCellStyle, textAlign: "left" }}>Part Number</th>
                      <th style={{ ...headerCellStyle, textAlign: "left" }}>Vendor</th>
                      <th style={{ ...headerCellStyle, textAlign: "right" }}>Qty</th>
                      <th style={{ ...headerCellStyle, textAlign: "right" }}>Unit Mtl ($)</th>
                      <th style={{ ...headerCellStyle, textAlign: "right" }}>Ext Mtl ($)</th>
                      <th style={{ ...headerCellStyle, textAlign: "right" }}>Unit Labor (h)</th>
                      <th style={{ ...headerCellStyle, textAlign: "right" }}>Ext Labor (h)</th>
                      <th style={{ ...headerCellStyle, textAlign: "right" }}>Internal Cost ($)</th>
                      <th style={{ ...headerCellStyle, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr
                        key={row.id}
                        style={{
                          background: row.totalInternalCost <= 0 ? T.faint : T.surface,
                          opacity: row.totalInternalCost <= 0 ? 0.8 : 1,
                        }}
                      >
                        <td style={{ ...bodyCellStyle, textAlign: "left", fontWeight: 700, color: row.totalInternalCost <= 0 ? T.muted : T.text }}>
                          <div style={{ whiteSpace: "normal", lineHeight: 1.35 }}>
                            {row.controlsPart}
                            {row.totalInternalCost <= 0 && (
                              <span style={{
                                display: "inline-flex",
                                alignItems: "center",
                                marginLeft: 6,
                                padding: "1px 5px",
                                borderRadius: 999,
                                border: "1px solid " + T.border2,
                                background: T.surface,
                                color: T.muted,
                                fontSize: 9,
                                fontFamily: T.mono,
                                fontWeight: 700,
                                verticalAlign: "middle",
                              }}>
                                No cost
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ ...bodyCellStyle, textAlign: "left", color: T.dim }}>
                          <div style={{ whiteSpace: "normal", lineHeight: 1.35, display: "grid", gap: 2 }}>
                            <span style={{ color: row.displayPartNumber ? T.text : T.muted, fontWeight: row.displayPartNumber ? 700 : 600 }}>
                              {row.displayPartNumber || row.internalId}
                            </span>
                            {row.manufacturer && (
                              <span style={{ color: T.muted, fontFamily: T.mono, fontSize: 10 }}>
                                {row.manufacturer}
                              </span>
                            )}
                            {!row.displayPartNumber && row.internalId && (
                              <span style={{ color: T.muted, fontFamily: T.mono, fontSize: 10 }}>
                                Internal ID: {row.internalId}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ ...bodyCellStyle, textAlign: "left", color: row.vendor ? T.text : T.muted }}>
                          {row.vendor || "—"}
                        </td>
                        <td style={{ ...bodyCellStyle, textAlign: "right", color: T.text }}>{formatQtyDisplay(row)}</td>
                        <td style={{ ...bodyCellStyle, textAlign: "right", color: T.steel }}>{fmt$(row.unitMaterialCost)}</td>
                        <td style={{ ...bodyCellStyle, textAlign: "right", color: T.steel }}>{fmt$(row.extendedMaterialCost)}</td>
                        <td style={{ ...bodyCellStyle, textAlign: "right", color: T.steel }}>{fmtHr(row.unitLaborHours)}</td>
                        <td style={{ ...bodyCellStyle, textAlign: "right", color: T.steel }}>{fmtHr(row.extendedLaborHours)}</td>
                        <td style={{ ...bodyCellStyle, textAlign: "right", color: T.text, fontWeight: 800 }}>{fmt$(row.totalInternalCost)}</td>
                        <td style={{ ...bodyCellStyle, textAlign: "center" }}>
                          <div style={{ display: "inline-flex", gap: 3, flexWrap: "nowrap", justifyContent: "center", whiteSpace: "nowrap" }}>
                            <ActionPlaceholder label="Change" />
                            <ActionPlaceholder label="Add" />
                            <ActionPlaceholder label="Qty" />
                            <ActionPlaceholder label="Remove" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : (
          <div
            style={{
              border: "1px dashed " + T.border2,
              borderRadius: 10,
              background: T.surface,
              padding: "14px 16px",
              color: T.muted,
              fontSize: 12,
            }}
          >
          No selected controls parts were found for the current vendor filter.
          </div>
      )}
    </section>
  );
}

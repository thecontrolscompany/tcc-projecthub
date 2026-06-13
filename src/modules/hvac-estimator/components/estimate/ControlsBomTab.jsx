import { useMemo } from "react";
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
};

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

export function ControlsBomTab({ estimate, controlsCatalog, settings }) {
  const bom = useMemo(
    () => deriveControlsBomRows(estimate, controlsCatalog, settings),
    [controlsCatalog, estimate, settings]
  );

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
        <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3 }}>
          Controls BOM
        </div>
        <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>
          Read-only controls parts view. Installation materials are excluded.
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8, fontSize: 11, color: T.muted, fontFamily: T.mono }}>
          <span>{bom.totals.groupCount} group{bom.totals.groupCount === 1 ? "" : "s"}</span>
          <span>{bom.totals.rowCount} row{bom.totals.rowCount === 1 ? "" : "s"}</span>
          <span>{fmt$(bom.totals.internalCost)} internal cost</span>
        </div>
      </div>

      {bom.groups.length ? (
        <div style={{ display: "grid", gap: 12 }}>
          {bom.groups.map((group) => (
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
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.1 }}>
                    Internal cost
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.blue, fontFamily: T.mono, marginTop: 2 }}>
                    {fmt$(group.subtotalInternalCost)}
                  </div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, marginTop: 2 }}>
                    {fmtHr(group.subtotalLaborHours)} labor hrs
                  </div>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
                  <thead>
                    <tr style={{ background: T.surface }}>
                      <th style={{ ...headerCellStyle, textAlign: "left" }}>Controls Part</th>
                      <th style={{ ...headerCellStyle, textAlign: "left" }}>Part Number / Catalog ID</th>
                      <th style={{ ...headerCellStyle, textAlign: "right" }}>Qty / Unit</th>
                      <th style={{ ...headerCellStyle, textAlign: "right" }}>Equip Qty</th>
                      <th style={{ ...headerCellStyle, textAlign: "right" }}>Ext Qty</th>
                      <th style={{ ...headerCellStyle, textAlign: "right" }}>Unit Mtl</th>
                      <th style={{ ...headerCellStyle, textAlign: "right" }}>Ext Mtl</th>
                      <th style={{ ...headerCellStyle, textAlign: "right" }}>Unit Labor Hrs</th>
                      <th style={{ ...headerCellStyle, textAlign: "right" }}>Ext Labor Hrs</th>
                      <th style={{ ...headerCellStyle, textAlign: "right" }}>Internal Cost</th>
                      <th style={{ ...headerCellStyle, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.id} style={{ background: T.surface }}>
                        <td style={{ ...bodyCellStyle, textAlign: "left", fontWeight: 700, color: T.text }}>
                          <div style={{ whiteSpace: "normal", lineHeight: 1.35 }}>
                            {row.controlsPart}
                          </div>
                        </td>
                        <td style={{ ...bodyCellStyle, textAlign: "left", color: T.dim }}>
                          <div style={{ whiteSpace: "normal", lineHeight: 1.35 }}>
                            {row.partNumber}
                          </div>
                        </td>
                        <td style={{ ...bodyCellStyle, textAlign: "right" }}>{row.qtyPerUnit}</td>
                        <td style={{ ...bodyCellStyle, textAlign: "right" }}>{row.equipmentQty}</td>
                        <td style={{ ...bodyCellStyle, textAlign: "right" }}>{row.extendedQty}</td>
                        <td style={{ ...bodyCellStyle, textAlign: "right", color: T.blue }}>{fmt$(row.unitMaterialCost)}</td>
                        <td style={{ ...bodyCellStyle, textAlign: "right", color: T.blue }}>{fmt$(row.extendedMaterialCost)}</td>
                        <td style={{ ...bodyCellStyle, textAlign: "right", color: T.steel }}>{fmtHr(row.unitLaborHours)}</td>
                        <td style={{ ...bodyCellStyle, textAlign: "right", color: T.steel }}>{fmtHr(row.extendedLaborHours)}</td>
                        <td style={{ ...bodyCellStyle, textAlign: "right", color: T.blue, fontWeight: 800 }}>{fmt$(row.totalInternalCost)}</td>
                        <td style={{ ...bodyCellStyle, textAlign: "center" }}>
                          <div style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
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
          No selected controls parts were found on this estimate.
        </div>
      )}
    </section>
  );
}

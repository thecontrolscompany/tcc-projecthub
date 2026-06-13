import { useMemo } from "react";
import { T } from "./tokens.js";
import { fmt$, fmtHr } from "./utils.js";
import { deriveItemControlsCostBreakdown } from "../components/estimate/estimateCalc.js";

function MetricTile({ label, value, subtle = false }) {
  return (
    <div
      style={{
        border: "1px solid " + T.border,
        borderRadius: 8,
        background: T.surface,
        padding: "7px 9px",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.1 }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 3,
          fontSize: subtle ? 12 : 13,
          fontWeight: 700,
          color: T.text,
          fontFamily: T.mono,
          lineHeight: 1.15,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function ControlsCostBreakdown({
  item,
  controlsCatalog,
  settings,
  title = "Controls Cost Breakdown",
  description = "Internal controls cost. Excludes overhead, profit, and bond.",
  defaultOpen = true,
}) {
  const breakdown = useMemo(
    () => deriveItemControlsCostBreakdown(item, controlsCatalog, settings),
    [controlsCatalog, item, settings],
  );

  const rows = breakdown.rows || [];

  return (
    <details
      open={defaultOpen}
      style={{
        border: "1px solid " + T.border,
        borderRadius: 10,
        background: T.panel,
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          padding: "10px 12px",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "baseline",
          flexWrap: "wrap",
          borderBottom: "1px solid " + T.border,
          background: T.surface,
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3 }}>
            {title}
          </div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
            {description}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1 }}>
            x{breakdown.itemQty || 1} equipment qty
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.blue, fontFamily: T.mono, marginTop: 2 }}>
            {fmt$(breakdown.totals.extendedTotalControlsInternalCost)}
          </div>
        </div>
      </summary>

      <div style={{ padding: 12, display: "grid", gap: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 8,
          }}
        >
          <MetricTile label="Controls material / unit" value={fmt$(breakdown.totals.controlsMaterialPerUnit)} />
          <MetricTile label="Controls labor hrs / unit" value={fmtHr(breakdown.totals.controlsLaborHoursPerUnit)} />
          <MetricTile label="Controls labor $ / unit" value={fmt$(breakdown.totals.controlsLaborDollarPerUnit)} />
          <MetricTile label="Internal cost / unit" value={fmt$(breakdown.totals.controlsInternalCostPerUnit)} />
          <MetricTile label="Extended controls material" value={fmt$(breakdown.totals.extendedControlsMaterial)} />
          <MetricTile label="Extended controls labor hrs" value={fmtHr(breakdown.totals.extendedControlsLaborHours)} />
          <MetricTile label="Extended controls labor $" value={fmt$(breakdown.totals.extendedControlsLaborDollars)} />
          <MetricTile label="Extended internal cost" value={fmt$(breakdown.totals.extendedTotalControlsInternalCost)} subtle />
        </div>

        <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.1 }}>
          Selected controls components
        </div>

        {rows.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {rows.map((row, index) => {
              const topRow = index === 0;
              return (
                <div
                  key={row.id}
                  style={{
                    border: "1px solid " + (topRow ? T.blueMid : T.border),
                    borderRadius: 9,
                    background: topRow ? T.blueFaint : T.surface,
                    padding: "9px 10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
                        {row.name}
                      </div>
                      <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, marginTop: 2 }}>
                        Qty / unit {row.qtyPerUnit} · Ext qty {row.extendedQty}
                        {row.controlsId ? ` · ${row.controlsId}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: T.blue, fontFamily: T.mono, fontWeight: 700 }}>
                        {fmt$(row.totalInternalCost)}
                      </div>
                      <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono }}>
                        internal cost
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(122px, 1fr))",
                      gap: 6,
                    }}
                  >
                    <MetricTile label="Unit material" value={fmt$(row.unitMaterialCost)} />
                    <MetricTile label="Ext. material" value={fmt$(row.extendedMaterialCost)} />
                    <MetricTile label="Unit labor hrs" value={fmtHr(row.unitLaborHours)} />
                    <MetricTile label="Ext. labor hrs" value={fmtHr(row.extendedLaborHours)} />
                    <MetricTile label="Unit labor $" value={fmt$(row.unitLaborDollarCost)} />
                    <MetricTile label="Ext. labor $" value={fmt$(row.extendedLaborDollarCost)} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              border: "1px dashed " + T.border2,
              borderRadius: 8,
              padding: "10px 12px",
              color: T.muted,
              fontSize: 11,
            }}
          >
            No selected controls components with catalog pricing were found.
          </div>
        )}
      </div>
    </details>
  );
}

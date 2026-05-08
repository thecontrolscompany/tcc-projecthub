import { useEffect, useMemo, useState } from "react";
import {
  CABLES,
  CONDUIT_FILL_BUNDLE_KEY,
  CONDUIT_FILL_CONTEXT_KEY,
  CONDUIT_FILL_RESTORE_KEY,
  CONDUITS,
  CONDUIT_TYPES,
  DEFAULT_CONDUIT_SIZE,
  DEFAULT_CONDUIT_TYPE,
  calculateRequiredConduits,
  conduitAllowedArea,
  necFillPct,
  normalizeCableId,
  upsertSelectedQty,
} from "../../shared/conduitFill.js";
import { T } from "../../shared/tokens.js";

function fmtArea(value) {
  return value.toFixed(4);
}

export default function ConduitFillPage() {
  const [conduitType, setConduitType] = useState(DEFAULT_CONDUIT_TYPE);
  const [conduitSize, setConduitSize] = useState(DEFAULT_CONDUIT_SIZE);
  const [rows, setRows] = useState([]);
  const [source, setSource] = useState("manual");
  const [editorContext, setEditorContext] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(CONDUIT_FILL_BUNDLE_KEY);
    if (raw) {
      try {
        const bundle = JSON.parse(raw);
        const valid = bundle.filter((b) => CABLES.some((c) => c.id === normalizeCableId(b.cableId)));
        if (valid.length > 0) {
          setRows(valid.map((b) => ({
            id: crypto.randomUUID(),
            cableId: normalizeCableId(b.cableId),
            qty: b.qty,
          })));
          setSource("points-list");
        }
      } catch {}
      sessionStorage.removeItem(CONDUIT_FILL_BUNDLE_KEY);
    }

    try {
      const contextRaw = sessionStorage.getItem(CONDUIT_FILL_CONTEXT_KEY);
      if (contextRaw) {
        setEditorContext(JSON.parse(contextRaw));
      }
    } catch {}
  }, []);

  const conduitOptions = CONDUITS[conduitType] ?? [];
  const selectedConduit = conduitOptions.find((entry) => entry.size === conduitSize) ?? conduitOptions[0];

  const cableCount = rows.reduce((sum, row) => sum + Math.max(0, Number(row.qty) || 0), 0);

  const totals = useMemo(() => {
    const cableArea = rows.reduce((sum, row) => {
      const cable = CABLES.find((entry) => entry.id === row.cableId);
      const qty = Math.max(0, Number(row.qty) || 0);
      return sum + (cable?.area ?? 0) * qty;
    }, 0);

    const conduitArea = selectedConduit?.area ?? 0;
    const allowedFillPct = necFillPct(cableCount);
    const allowedArea = conduitArea * allowedFillPct;
    const fillRatio = conduitArea > 0 ? cableArea / conduitArea : 0;
    const packing = calculateRequiredConduits(rows, selectedConduit);

    return {
      cableArea,
      conduitArea,
      allowedFillPct,
      allowedArea,
      fillRatio,
      passes: cableArea <= allowedArea,
      requiredConduitCount: packing.conduitCount,
      packing,
    };
  }, [rows, selectedConduit, cableCount]);

  function updateRow(rowId, patch) {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), cableId: "18/2", qty: 1 },
    ]);
  }

  function removeRow(rowId) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== rowId)));
  }

  function applyToEditor() {
    if (!editorContext?.homerunId || totals.requiredConduitCount < 1) return;

    const restore = {
      ...editorContext,
      draft: {
        ...editorContext.draft,
        selected: upsertSelectedQty(
          editorContext.draft?.selected ?? [],
          editorContext.homerunId,
          totals.requiredConduitCount
        ),
      },
    };

    sessionStorage.setItem(CONDUIT_FILL_RESTORE_KEY, JSON.stringify(restore));
    window.dispatchEvent(new CustomEvent("return-from-conduit-fill"));
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 16px" }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 22, color: T.text }}>Conduit Fill Calculator</h2>
        <p style={{ margin: 0, color: T.muted, fontSize: 13, fontFamily: T.mono }}>
          NEC Chapter 9 fill calculator using cable ODs and conduit IDs from the shared catalog.
        </p>
      </div>
      {editorContext?.homerunId && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${T.border}`,
            background: T.surface,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ color: T.muted, fontSize: 12, fontFamily: T.mono }}>
            Apply the required conduit count back to the current editor home run quantity.
          </span>
          <button
            onClick={applyToEditor}
            disabled={totals.requiredConduitCount < 1}
            style={{
              padding: "7px 12px",
              borderRadius: 6,
              border: `1px solid ${totals.requiredConduitCount < 1 ? T.border : T.blue}`,
              background: totals.requiredConduitCount < 1 ? "transparent" : T.blueFaint,
              color: totals.requiredConduitCount < 1 ? T.dim : T.blue,
              cursor: totals.requiredConduitCount < 1 ? "default" : "pointer",
              fontFamily: T.mono,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            Apply {Math.max(1, totals.requiredConduitCount || 0)} Home Runs
          </button>
        </div>
      )}
      {source === "points-list" && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${T.blueA18 ?? T.border}`,
            background: T.blueFaint,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ color: T.blue, fontSize: 12, fontFamily: T.mono }}>
            Loaded from points list — you can edit cables below
          </span>
          <button
            onClick={() => setSource("manual")}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              border: `1px solid ${T.border2}`,
              background: "transparent",
              color: T.blue,
              cursor: "pointer",
              fontFamily: T.mono,
              fontSize: 11,
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(280px, 1fr)", gap: 16 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>Conduit Type</span>
              <select
                value={conduitType}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setConduitType(nextType);
                  const defaultSize =
                    CONDUITS[nextType]?.find((entry) => entry.size === DEFAULT_CONDUIT_SIZE)?.size
                    ?? CONDUITS[nextType]?.[0]?.size
                    ?? DEFAULT_CONDUIT_SIZE;
                  setConduitSize(defaultSize);
                }}
                style={{
                  padding: "9px 10px",
                  borderRadius: 6,
                  border: `1px solid ${T.border2}`,
                  background: T.panel,
                  color: T.text,
                }}
              >
                {CONDUIT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>Conduit Size</span>
              <select
                value={selectedConduit?.size ?? conduitSize}
                onChange={(e) => setConduitSize(e.target.value)}
                style={{
                  padding: "9px 10px",
                  borderRadius: 6,
                  border: `1px solid ${T.border2}`,
                  background: T.panel,
                  color: T.text,
                }}
              >
                {conduitOptions.map((option) => (
                  <option key={option.size} value={option.size}>{option.size}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((row) => (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.4fr) 110px 76px",
                  gap: 10,
                  alignItems: "end",
                  padding: 12,
                  background: T.panel,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>Cable</span>
                  <select
                    value={row.cableId}
                    onChange={(e) => updateRow(row.id, { cableId: e.target.value })}
                    style={{
                      padding: "9px 10px",
                      borderRadius: 6,
                      border: `1px solid ${T.border2}`,
                      background: T.surface,
                      color: T.text,
                    }}
                  >
                    {CABLES.map((cable) => (
                      <option key={cable.id} value={cable.id}>
                        {cable.label} ({cable.od}")
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>Qty</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={row.qty}
                    onChange={(e) => updateRow(row.id, { qty: e.target.value })}
                    style={{
                      padding: "9px 10px",
                      borderRadius: 6,
                      border: `1px solid ${T.border2}`,
                      background: T.surface,
                      color: T.text,
                    }}
                  />
                </label>
                <button
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1}
                  style={{
                    padding: "9px 10px",
                    borderRadius: 6,
                    border: `1px solid ${rows.length === 1 ? T.border : T.border2}`,
                    background: "transparent",
                    color: rows.length === 1 ? T.dim : T.muted,
                    cursor: rows.length === 1 ? "default" : "pointer",
                    fontFamily: T.mono,
                    fontSize: 12,
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addRow}
            style={{
              marginTop: 14,
              padding: "8px 12px",
              borderRadius: 6,
              border: `1px solid ${T.border2}`,
              background: "transparent",
              color: T.blue,
              cursor: "pointer",
              fontFamily: T.mono,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            + Add Cable
          </button>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, letterSpacing: 1, marginBottom: 10 }}>
              RESULTS
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <ResultRow label="Cable Count" value={String(cableCount)} />
              <ResultRow label="Required Conduits" value={String(totals.requiredConduitCount)} />
              <ResultRow label="Allowed Fill" value={`${(totals.allowedFillPct * 100).toFixed(0)}%`} />
              <ResultRow label="Cable Area" value={`${fmtArea(totals.cableArea)} in²`} />
              <ResultRow label="Conduit Area" value={`${fmtArea(totals.conduitArea)} in²`} />
              <ResultRow label="Allowed Area" value={`${fmtArea(totals.allowedArea)} in²`} />
              <ResultRow label="Actual Fill" value={`${(totals.fillRatio * 100).toFixed(1)}%`} />
            </div>
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${totals.requiredConduitCount === 1 && totals.passes ? "#86EFAC" : "#93C5FD"}`,
                background: totals.requiredConduitCount === 1 && totals.passes
                  ? "color-mix(in srgb, #22C55E 12%, transparent)"
                  : "color-mix(in srgb, #2563EB 10%, transparent)",
                color: totals.requiredConduitCount === 1 && totals.passes ? "#166534" : "#1D4ED8",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {totals.requiredConduitCount === 1 && totals.passes
                ? "One conduit is sufficient"
                : totals.requiredConduitCount === 0
                  ? "Add cables to calculate conduit count"
                : `${totals.requiredConduitCount} conduits required at this size`}
            </div>
            {totals.packing.conduits.length > 0 && (
              <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                {totals.packing.conduits.map((run, index) => (
                  <div
                    key={`run-${index + 1}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: T.panel,
                      border: `1px solid ${T.border}`,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: T.text, fontWeight: 600 }}>Conduit {index + 1}</span>
                    <span style={{ color: T.muted }}>
                      {run.count} cables, {fmtArea(run.usedArea)} in² used, {(run.fillRatio * 100).toFixed(1)}% fill
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 10, color: T.dim, fontFamily: T.mono, letterSpacing: 1, marginBottom: 10 }}>
              REFERENCE
            </div>
            <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
              <div>Conduit type: <strong style={{ color: T.text }}>{conduitType}</strong></div>
              <div>Conduit size: <strong style={{ color: T.text }}>{selectedConduit?.size ?? conduitSize}</strong></div>
              <div>Inner diameter: <strong style={{ color: T.text }}>{selectedConduit?.id ?? 0}"</strong></div>
              <div>Single-conduit capacity: <strong style={{ color: T.text }}>{fmtArea(conduitAllowedArea(totals.conduitArea, Math.max(cableCount, 1)))} in²</strong></div>
              <div style={{ marginTop: 8 }}>
                Fill rules:
                <div>1 conductor = 53%</div>
                <div>2 conductors = 31%</div>
                <div>3+ conductors = 40%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
      <span style={{ color: T.muted }}>{label}</span>
      <span style={{ color: T.text, fontFamily: T.mono, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

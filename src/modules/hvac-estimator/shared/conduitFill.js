// NEC fill rules (Chapter 9, Table 1)
export const NEC_FILL = { 1: 0.53, 2: 0.31, default: 0.40 };

export function necFillPct(count) {
  return NEC_FILL[count] ?? NEC_FILL.default;
}

export function conduitAllowedArea(conduitArea, cableCount) {
  return conduitArea * necFillPct(cableCount);
}

const circleArea = (diameter) => Math.PI * Math.pow(diameter / 2, 2);

// Cable catalog — OD in inches, area computed from OD
export const CABLES = [
  { id: "16/2", label: "16/2", od: 0.184 },
  { id: "18/2", label: "18/2", od: 0.158 },
  { id: "18/3", label: "18/3", od: 0.168 },
  { id: "18/4", label: "18/4", od: 0.184 },
  { id: "22/3", label: "22/3", od: 0.134 },
  { id: "cat6", label: "Cat 6", od: 0.277 },
].map((cable) => ({
  ...cable,
  area: circleArea(cable.od),
}));

export function normalizeCableId(str) {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  if (s === "cat6" || s === "cat 6") return "cat6";
  return s.replace("-", "/");
}

// Conduit catalog — inner diameter in inches, area computed from ID
// Source: NEC Chapter 9 Table 4
export const CONDUIT_TYPES = ["EMT", "IMC", "RMC", "PVC-40", "PVC-80"];
export const DEFAULT_CONDUIT_TYPE = "EMT";
export const DEFAULT_CONDUIT_SIZE = '3/4"';
export const CONDUIT_FILL_BUNDLE_KEY = "conduitFill_bundle";
export const CONDUIT_FILL_CONTEXT_KEY = "conduitFill_editor_context";
export const CONDUIT_FILL_RESTORE_KEY = "conduitFill_editor_restore";

export const CONDUITS = {
  EMT: [
    { size: '1/2"', id: 0.622 },
    { size: '3/4"', id: 0.824 },
    { size: '1"', id: 1.049 },
    { size: '1-1/4"', id: 1.380 },
    { size: '1-1/2"', id: 1.610 },
    { size: '2"', id: 2.067 },
    { size: '2-1/2"', id: 2.731 },
    { size: '3"', id: 3.356 },
    { size: '3-1/2"', id: 3.834 },
    { size: '4"', id: 4.334 },
  ],
  IMC: [
    { size: '1/2"', id: 0.660 },
    { size: '3/4"', id: 0.864 },
    { size: '1"', id: 1.101 },
    { size: '1-1/4"', id: 1.448 },
    { size: '1-1/2"', id: 1.683 },
    { size: '2"', id: 2.150 },
    { size: '2-1/2"', id: 2.557 },
    { size: '3"', id: 3.176 },
    { size: '3-1/2"', id: 3.671 },
    { size: '4"', id: 4.166 },
  ],
  RMC: [
    { size: '1/2"', id: 0.632 },
    { size: '3/4"', id: 0.836 },
    { size: '1"', id: 1.063 },
    { size: '1-1/4"', id: 1.394 },
    { size: '1-1/2"', id: 1.624 },
    { size: '2"', id: 2.083 },
    { size: '2-1/2"', id: 2.489 },
    { size: '3"', id: 3.090 },
    { size: '3-1/2"', id: 3.570 },
    { size: '4"', id: 4.050 },
  ],
  "PVC-40": [
    { size: '1/2"', id: 0.602 },
    { size: '3/4"', id: 0.804 },
    { size: '1"', id: 1.029 },
    { size: '1-1/4"', id: 1.360 },
    { size: '1-1/2"', id: 1.590 },
    { size: '2"', id: 2.047 },
    { size: '2-1/2"', id: 2.445 },
    { size: '3"', id: 3.042 },
    { size: '3-1/2"', id: 3.521 },
    { size: '4"', id: 3.998 },
  ],
  "PVC-80": [
    { size: '1/2"', id: 0.526 },
    { size: '3/4"', id: 0.722 },
    { size: '1"', id: 0.936 },
    { size: '1-1/4"', id: 1.255 },
    { size: '1-1/2"', id: 1.476 },
    { size: '2"', id: 1.913 },
    { size: '2-1/2"', id: 2.290 },
    { size: '3"', id: 2.864 },
    { size: '3-1/2"', id: 3.326 },
    { size: '4"', id: 3.786 },
  ],
};

Object.keys(CONDUITS).forEach((type) => {
  CONDUITS[type] = CONDUITS[type].map((conduit) => ({
    ...conduit,
    area: circleArea(conduit.id),
  }));
});

export function buildCableAreaList(rows, cables = CABLES) {
  const cableMap = new Map(cables.map((cable) => [normalizeCableId(cable.id), cable]));
  const areas = [];

  for (const row of rows ?? []) {
    const cable = cableMap.get(normalizeCableId(row.cableId));
    const qty = Math.max(0, Number(row.qty) || 0);
    if (!cable || qty === 0) continue;
    for (let i = 0; i < qty; i += 1) {
      areas.push(cable.area);
    }
  }

  return areas.sort((a, b) => b - a);
}

export function buildCableBundleFromPoints(comps, selected) {
  const cableIds = new Set(CABLES.map((cable) => cable.id));
  const counts = {};

  for (const sel of selected ?? []) {
    const comp = comps.find((c) => c.id === sel.id);
    if (!comp) continue;
    const raw = comp.wire ?? "18/2";
    if (raw === "-" || raw === "—" || raw === "") continue;
    const cableId = normalizeCableId(raw);
    if (!cableId || !cableIds.has(cableId)) continue;
    counts[cableId] = (counts[cableId] ?? 0) + (sel.qty ?? 1);
  }

  return Object.entries(counts).map(([cableId, qty]) => ({ cableId, qty }));
}

export function findHomeRunComponentId(comps) {
  return (comps ?? []).find(
    (comp) =>
      comp?.name === "Home Run Conduit" ||
      String(comp?.id || "").toLowerCase().includes("homerun")
  )?.id ?? null;
}

export function upsertSelectedQty(selected, componentId, qty) {
  if (!componentId || !Number.isFinite(Number(qty)) || Number(qty) < 1) {
    return selected ?? [];
  }

  const nextQty = Math.max(1, Number(qty) || 1);
  const list = [...(selected ?? [])];
  const index = list.findIndex((entry) => entry.id === componentId);

  if (index >= 0) {
    list[index] = { ...list[index], qty: nextQty };
    return list;
  }

  return [...list, { id: componentId, qty: nextQty }];
}

export function calculateRequiredConduits(rows, conduit, cables = CABLES) {
  const cableAreas = buildCableAreaList(rows, cables);
  const conduitArea = conduit?.area ?? 0;

  if (!conduitArea || cableAreas.length === 0) {
    return {
      cableAreas,
      conduitArea,
      totalCableArea: cableAreas.reduce((sum, area) => sum + area, 0),
      conduitCount: 0,
      conduits: [],
    };
  }

  const conduits = [];

  for (const cableArea of cableAreas) {
    let placed = false;

    for (const run of conduits) {
      const nextCount = run.count + 1;
      const nextArea = run.usedArea + cableArea;
      const allowedArea = conduitAllowedArea(conduitArea, nextCount);

      if (nextArea <= allowedArea) {
        run.count = nextCount;
        run.usedArea = nextArea;
        run.allowedArea = allowedArea;
        run.fillRatio = nextArea / conduitArea;
        placed = true;
        break;
      }
    }

    if (!placed) {
      const count = 1;
      const allowedArea = conduitAllowedArea(conduitArea, count);
      conduits.push({
        count,
        usedArea: cableArea,
        allowedArea,
        fillRatio: cableArea / conduitArea,
      });
    }
  }

  return {
    cableAreas,
    conduitArea,
    totalCableArea: cableAreas.reduce((sum, area) => sum + area, 0),
    conduitCount: conduits.length,
    conduits,
  };
}

import { T } from "../../shared/tokens.js";
import { DEFAULT_SETTINGS, computeCosts, computeControlsCosts } from "./projectSettings.js";
import { VAV_COMPS } from "../vav/vavData.js";
import { AHU_COMPS, AHU_TYPES } from "../ahu/ahuData.js";
import { RTU_COMPS } from "../rtu/rtuData.js";
import { DX_COMPS } from "../dx/dxData.js";
import { VRF_COMPS } from "../vrf/vrfData.js";
import { FCU_COMPS } from "../fcu/fcuData.js";
import { UH_COMPS } from "../uh/uhData.js";
import { PLANT_COMPS } from "../plant/plantData.js";
import { NETWORK_COMPS } from "../network/networkData.js";
import { EXHAUST_FAN_COMPS } from "../exhaustFan/exhaustFanData.js";
import { getAllEquipmentComponents } from "../../shared/componentCatalog.js";
import { ASSEMBLIES, calcAssembly } from "../../shared/assemblyData.js";

const CUSTOM_COMPS = getAllEquipmentComponents();
const warnedMissingAssemblyCosts = new Set();
let controlsDefaultOverrides = {};

export const COMPS_MAP = {
  vav: VAV_COMPS,
  ahu: AHU_COMPS,
  rtu: RTU_COMPS,
  dx: DX_COMPS,
  vrf: VRF_COMPS,
  fcu: FCU_COMPS,
  uh: UH_COMPS,
  network: NETWORK_COMPS,
  "exhaust-fan": EXHAUST_FAN_COMPS,
  custom: CUSTOM_COMPS,
};

export const TYPE_META = {
  vav: { label: "VAV", color: T.blue, bg: "#EFF6FF" },
  ahu: { label: "AHU", color: "#0D9488", bg: "#F0FDFA" },
  rtu: { label: "RTU", color: "#7C3AED", bg: "#F5F3FF" },
  dx: { label: "DX/HP", color: "#4338CA", bg: "#EEF2FF" },
  vrf: { label: "VRF", color: "#047857", bg: "#ECFDF5" },
  fcu: { label: "FCU", color: "#EA580C", bg: "#FFF7ED" },
  uh: { label: "UH", color: "#DC2626", bg: "#FEF2F2" },
  plant: { label: "PLANT", color: "#0369A1", bg: "#F0F9FF" },
  network: { label: "NET", color: "#059669", bg: "#ECFDF5" },
  "exhaust-fan": { label: "EF", color: "#B45309", bg: "#FFFBEB" },
  custom: { label: "CUST", color: "#6B7280", bg: "#F3F4F6" },
};

export const shouldIncludeProposalComp = (comp) => {
  const name = (comp?.label || comp?.name || "").toLowerCase();
  return !name.includes("home run conduit");
};

export function setControlsDefaultOverrides(overridesByKey = {}) {
  controlsDefaultOverrides = overridesByKey && typeof overridesByKey === "object" ? { ...overridesByKey } : {};
}

function applyControlsDefaultsOverride(component, sourceType) {
  const builtInControlsId = component.controlsId ?? component.builtInControlsId ?? null;
  const componentKey = component.componentKey || `${sourceType || "unknown"}:${component.id}`;
  const overrideValue = controlsDefaultOverrides?.[componentKey];
  const overrideId = typeof overrideValue === "string" && overrideValue.trim() ? overrideValue.trim() : null;
  const controlsId =
    overrideId || builtInControlsId;

  return {
    ...component,
    componentKey,
    builtInControlsId,
    controlsId,
    controlsOverridden: Boolean(overrideId && overrideId !== String(builtInControlsId ?? "")),
  };
}

function resolveItemComps(item) {
  let comps = COMPS_MAP[item.type] || [];
  if (item.type === "plant" && item.cfg?.plantType) {
    comps = PLANT_COMPS[item.cfg.plantType] || [];
  } else if (item.type === "custom" && item.cfg?.componentId) {
    const selected = comps.find((component) => component.id === item.cfg.componentId);
    comps = selected ? [selected] : comps;
  }
  return comps.map((component) => applyControlsDefaultsOverride(component, component.sourceType || item.type));
}

function getCompQty(item, id) {
  return item.selected?.find((s) => s.id === id)?.qty ?? 1;
}

function getCompCost(item, comp) {
  const aid = String(item.installType === "EMT" ? comp.emtAID : comp.plnAID);
  const snap = item.priceSnap?.[comp.id] || (aid && aid !== "undefined" ? item.priceSnap?.[aid] : null);
  if (snap) return snap;
  if (!aid || aid === "undefined") return { mtl: comp.unitMtl || 0, lbr: comp.unitLbr || 0 };
  if (!ASSEMBLIES[aid]) {
    const hasFallbackCost = comp.unitMtl != null || comp.unitLbr != null;
    const warningKey = `${comp.id}:${aid}`;
    if (!hasFallbackCost && !warnedMissingAssemblyCosts.has(warningKey)) {
      warnedMissingAssemblyCosts.add(warningKey);
      console.warn(`[estimateCalc] Component "${comp.id}" references missing assembly "${aid}" and has no unitMtl/unitLbr fallback.`);
    }
    return { mtl: comp.unitMtl || 0, lbr: comp.unitLbr || 0 };
  }
  return calcAssembly(aid);
}

function getControlsOverride(item, id) {
  return item.selected?.find((s) => s.id === id)?.controlsOverride || null;
}

function getControlsCustomPart(item, id) {
  return item.selected?.find((s) => s.id === id)?.controlsCustomPart || null;
}

function isZeroedControlsCustomPart(customPart) {
  if (!customPart || typeof customPart !== "object") return false;
  return (Number(customPart.mtlUnit) || 0) === 0 && (Number(customPart.hrsUnit) || 0) === 0;
}

function getControlsCost(comp, controlsCatalog, override, customPart) {
  if (customPart) {
    return {
      mtl: Number(customPart.mtlUnit) || 0,
      lbr: Number(customPart.hrsUnit) || 0,
    };
  }

  const id = override || comp.controlsId;
  const entry = id ? controlsCatalog?.[id] : null;
  if (!entry) return { mtl: 0, lbr: 0 };
  return { mtl: entry.mtlUnit || 0, lbr: entry.hrsUnit || 0 };
}

function resolveControlsId(comp, override) {
  return override || comp.controlsId || null;
}

function getControlsCatalogRow(controlsCatalog, id) {
  return id ? controlsCatalog?.[id] || null : null;
}

function getSelectedControlsEntries(estimate = {}) {
  const entries = [];
  for (const item of estimate.items || []) {
    const itemQty = Math.max(1, Number(item.qty) || 1);
    const comps = resolveItemComps(item);
    for (const comp of comps) {
      if (!item.selected?.some((s) => s.id === comp.id)) continue;
      const compQty = Math.max(1, Number(getCompQty(item, comp.id)) || 1);
      const controlsOverride = getControlsOverride(item, comp.id);
      const controlsCustomPart = getControlsCustomPart(item, comp.id);
      entries.push({
        itemId: item.id,
        tag: item.tag || "",
        itemQty,
        compId: comp.id,
        compQty,
        controlsId: resolveControlsId(comp, controlsOverride),
        baseControlsId: comp.controlsId || null,
        controlsOverride,
        controlsCustomPart,
      });
    }
  }
  return entries;
}

function getCustomCost(item, custom) {
  const aid = String(item.installType === "EMT" ? custom.emtAID : custom.plnAID);
  const qty = Math.max(1, Number(custom.qty || 1));
  if (aid && aid !== "undefined") {
    const result = calcAssembly(aid);
    return {
      mtl: (result?.mtl || 0) * qty,
      lbr: (result?.lbr || 0) * qty,
    };
  }
  return {
    mtl: ((custom.unitMtl || 0) + (custom.extraMtl || 0)) * qty,
    lbr: ((custom.unitLbr || 0) + (custom.extraLbr || 0)) * qty,
  };
}

const DDC_CONTROLLER_TIERS = [8, 16, 32, 64];
const VAV_DEDICATED_CONTROLLER_ID = "CTL-DEV-VAV-CTRL";

const DDC_FALLBACK_DESCRIPTIONS = {
  "CTL-DDC-08": "DDC Controller - 8 Point Capacity",
  "CTL-DDC-16": "DDC Controller - 16 Point Capacity",
  "CTL-DDC-32": "DDC Controller - 32 Point Capacity",
  "CTL-DDC-64": "DDC Controller - 64 Point Capacity",
  "CTL-PNL-SM": "Control Panel Enclosure - Small (1-2 Controllers)",
  "CTL-PNL-MD": "Control Panel Enclosure - Medium (3-5 Controllers)",
  "CTL-PNL-LG": "Control Panel Enclosure - Large (6+ Controllers)",
  "CTL-NET-SUP": "Supervisory Controller - BACnet/IP Building Controller",
  "CTL-LIC-DEVICE": "Device Connection License - per Controller",
  "CTL-ENG-PROGRAM": "Sequence of Operations Programming - per Controller",
  "CTL-ENG-COMMISSION": "System Commissioning & Functional Test - per Controller",
  "CTL-ENG-SUBMITTAL": "Controls Submittal Package - per Project",
  "CTL-GFX-EQUIP": "Equipment Graphic - per Unit",
  "CTL-GFX-FLOORPLAN": "Floor Plan / Summary Graphic - per Page",
};

function getDdcRowMeta(controlsCatalog, catalogId) {
  const row = getControlsCatalogRow(controlsCatalog, catalogId);
  return {
    catalogId,
    description: row?.desc || DDC_FALLBACK_DESCRIPTIONS[catalogId] || catalogId,
    mtlUnit: row?.mtlUnit || 0,
    hrsUnit: row?.hrsUnit || 0,
  };
}

function sizeControllers(pointCount) {
  let pointsLeft = Math.max(0, Math.ceil(Number(pointCount) || 0));
  const sizes = [];
  while (pointsLeft > 0) {
    if (pointsLeft > 64) {
      sizes.push(64);
      pointsLeft -= 64;
      continue;
    }
    const size = DDC_CONTROLLER_TIERS.find((tier) => tier >= pointsLeft) || 64;
    sizes.push(size);
    pointsLeft = 0;
  }
  return sizes;
}

function getPanelCatalogId(controllerCount) {
  if (controllerCount <= 0) return null;
  if (controllerCount <= 2) return "CTL-PNL-SM";
  if (controllerCount <= 5) return "CTL-PNL-MD";
  return "CTL-PNL-LG";
}

export function calcDdcInfrastructure(selected = [], controlsCatalog = {}, settings = {}) {
  const pointCounts = { AI: 0, AO: 0, BI: 0, BO: 0 };
  let unknownPointCount = 0;
  const dedicatedControllerItemIds = new Set();

  for (const entry of selected || []) {
    if (entry?.controlsId !== VAV_DEDICATED_CONTROLLER_ID) continue;
    if (isZeroedControlsCustomPart(entry.controlsCustomPart)) continue;
    dedicatedControllerItemIds.add(entry.itemId);
  }

  for (const entry of selected || []) {
    if (!entry?.controlsId) continue;
    if (isZeroedControlsCustomPart(entry.controlsCustomPart)) continue;
    if (entry.controlsId === VAV_DEDICATED_CONTROLLER_ID) continue;
    if (dedicatedControllerItemIds.has(entry.itemId)) continue;

    const row = getControlsCatalogRow(controlsCatalog, entry.controlsId);
    const ioType = String(row?.ioType || row?.io_type || "").toUpperCase();
    const pointQty = Math.max(1, Number(entry.itemQty) || 1) * Math.max(1, Number(entry.compQty) || 1);

    if (ioType && pointCounts[ioType] !== undefined) {
      pointCounts[ioType] += pointQty;
    } else {
      unknownPointCount += pointQty;
    }

  }

  const totalPoints = Object.values(pointCounts).reduce((sum, count) => sum + count, 0) + unknownPointCount;
  const controllerSizes = sizeControllers(totalPoints);
  const controllerCount = controllerSizes.length;
  const panelCatalogId = getPanelCatalogId(controllerCount);
  const equipmentInstanceCounts = new Map();
  for (const entry of selected || []) {
    if (!entry?.controlsId) continue;
    if (isZeroedControlsCustomPart(entry.controlsCustomPart)) continue;
    const qty = Math.max(1, Number(entry.itemQty) || 1);
    // Dotted tags (e.g. "RTU-1.COND") denote a field device belonging to a parent
    // piece of equipment ("RTU-1") rather than a standalone unit — group them
    // together so "per Unit" graphics aren't counted once per sub-tag.
    const tag = String(entry.tag || "").trim();
    const dotIndex = tag.indexOf(".");
    const groupKey = dotIndex > 0 ? tag.slice(0, dotIndex) : entry.itemId;
    equipmentInstanceCounts.set(groupKey, Math.max(equipmentInstanceCounts.get(groupKey) || 0, qty));
  }
  const equipmentCount = Array.from(equipmentInstanceCounts.values()).reduce((sum, qty) => sum + qty, 0);
  const graphicsCount = equipmentCount;
  const rows = [];

  // Controller hardware furnished by others (e.g. the GC): keep the mount/wire/program
  // labor TCC still performs, but zero the material cost since TCC isn't buying it.
  const controllerFurnishedByOthers = !!settings?.ddcControllerFurnishedByOthers;
  for (const size of [64, 32, 16, 8]) {
    const qty = controllerSizes.filter((tier) => tier === size).length;
    if (!qty) continue;
    const meta = getDdcRowMeta(controlsCatalog, `CTL-DDC-${String(size).padStart(2, "0")}`);
    rows.push({
      ...meta,
      qty,
      mtlTotal: controllerFurnishedByOthers ? 0 : qty * meta.mtlUnit,
      hrsTotal: qty * meta.hrsUnit,
    });
  }

  if (panelCatalogId) {
    const meta = getDdcRowMeta(controlsCatalog, panelCatalogId);
    rows.push({
      ...meta,
      qty: 1,
      mtlTotal: meta.mtlUnit,
      hrsTotal: meta.hrsUnit,
    });
  }

  if (controllerCount > 0) {
    const controllerRows = [
      // Existing Head-End: customer already has a supervisory controller/front-end,
      // so the new field controller(s) join their network instead of a new one.
      ...(settings?.existingHeadEnd ? [] : [{ catalogId: "CTL-NET-SUP", qty: 1 }]),
      { catalogId: "CTL-LIC-DEVICE", qty: controllerCount },
      { catalogId: "CTL-ENG-PROGRAM", qty: controllerCount },
      { catalogId: "CTL-ENG-COMMISSION", qty: controllerCount },
      { catalogId: "CTL-ENG-SUBMITTAL", qty: 1 },
      { catalogId: "CTL-GFX-EQUIP", qty: graphicsCount },
      { catalogId: "CTL-GFX-FLOORPLAN", qty: 1 },
    ];

    for (const rowDef of controllerRows) {
      if (!rowDef.qty) continue;
      const meta = getDdcRowMeta(controlsCatalog, rowDef.catalogId);
      rows.push({
        ...meta,
        qty: rowDef.qty,
        mtlTotal: rowDef.qty * meta.mtlUnit,
        hrsTotal: rowDef.qty * meta.hrsUnit,
      });
    }
  }

  const rawMtl = rows.reduce((sum, row) => sum + (row.mtlTotal || 0), 0);
  const rawLbrHrs = rows.reduce((sum, row) => sum + (row.hrsTotal || 0), 0);
  const controlsWageRate = Number(settings.controlsWageRate || DEFAULT_SETTINGS.controlsWageRate) || DEFAULT_SETTINGS.controlsWageRate;

  return {
    rows,
    pointCounts,
    unknownPointCount,
    totalPoints,
    controllerSizes,
    controllerCount,
    panelCatalogId,
    equipmentCount,
    graphicsCount,
    rawMtl,
    rawLbrHrs,
    grandTotal: rawMtl + (rawLbrHrs * controlsWageRate),
  };
}

export function calcItem(item, controlsCatalog = {}) {
  const comps = resolveItemComps(item);
  const selComps = comps.filter((c) => item.selected?.some((s) => s.id === c.id));
  const custMtl = (item.custom || []).reduce((a, c) => a + getCustomCost(item, c).mtl, 0);
  const custLbr = (item.custom || []).reduce((a, c) => a + getCustomCost(item, c).lbr, 0);
  const unitMtl = selComps.reduce((a, c) => {
    const cq = getCompQty(item, c.id);
    const result = getCompCost(item, c);
    return a + (result?.mtl || 0) * cq;
  }, 0) + custMtl;
  const unitLbr = selComps.reduce((a, c) => {
    const cq = getCompQty(item, c.id);
    const result = getCompCost(item, c);
    return a + (result?.lbr || 0) * cq;
  }, 0) + custLbr;
  const unitControlsMtl = selComps.reduce((a, c) => {
    const cq = getCompQty(item, c.id);
    const result = getControlsCost(c, controlsCatalog, getControlsOverride(item, c.id), getControlsCustomPart(item, c.id));
    return a + (result?.mtl || 0) * cq;
  }, 0);
  const unitControlsLbr = selComps.reduce((a, c) => {
    const cq = getCompQty(item, c.id);
    const result = getControlsCost(c, controlsCatalog, getControlsOverride(item, c.id), getControlsCustomPart(item, c.id));
    return a + (result?.lbr || 0) * cq;
  }, 0);
  return {
    unitMtl,
    unitLbr,
    totalMtl: unitMtl * item.qty,
    totalLbr: unitLbr * item.qty,
    unitControlsMtl,
    unitControlsLbr,
    totalControlsMtl: unitControlsMtl * item.qty,
    totalControlsLbr: unitControlsLbr * item.qty,
  };
}

export function calcEstimate(estimate, controlsCatalog = {}) {
  const ddcInfrastructure = calcDdcInfrastructure(getSelectedControlsEntries(estimate), controlsCatalog, estimate?.settings || {});
  return (estimate.items || []).reduce((acc, item) => {
    const c = calcItem(item, controlsCatalog);
    return {
      mtl: acc.mtl + c.totalMtl,
      lbrHrs: acc.lbrHrs + c.totalLbr,
      controlsMtl: acc.controlsMtl + c.totalControlsMtl,
      controlsLbrHrs: acc.controlsLbrHrs + c.totalControlsLbr,
      ddcInfrastructure: acc.ddcInfrastructure,
    };
  }, {
    mtl: 0,
    lbrHrs: 0,
    controlsMtl: ddcInfrastructure.rawMtl,
    controlsLbrHrs: ddcInfrastructure.rawLbrHrs,
    ddcInfrastructure,
  });
}

// Install and controls are parallel cost pools, not nested buckets.
// Install sell price still comes from the command center logic, while
// controls sell price is derived separately from the controls catalog.
export function deriveEstimatorCostBuckets(estimate, controlsCatalog = {}, settings = {}) {
  const normalizedEstimate = estimate || {};
  const normalizedSettings = { ...DEFAULT_SETTINGS, ...(normalizedEstimate.settings || {}), ...(settings || {}) };
  const totals = calcEstimate(normalizedEstimate, controlsCatalog);
  const costs = computeCosts(totals.mtl, totals.lbrHrs, normalizedSettings, normalizedEstimate.items || []);
  const controlsCosts = computeControlsCosts(totals.controlsMtl, totals.controlsLbrHrs, normalizedSettings);

  const installInternalCost = costs.labor + costs.material;
  const controlsInternalLaborCost = totals.controlsLbrHrs * normalizedSettings.controlsWageRate;
  const controlsInternalCost = totals.controlsMtl + controlsInternalLaborCost;
  const installSellPrice = costs.total;
  const controlsSellPrice = controlsCosts.material + controlsCosts.labor;
  const turnkeySellPrice = installSellPrice + controlsSellPrice;
  const internalCost = installInternalCost + controlsInternalCost;

  return {
    install: {
      laborCost: costs.labor,
      materialCost: costs.material,
      internalCost: installInternalCost,
      markup: {
        overhead: costs.overhead,
        profit: costs.profit,
        bond: costs.bond,
      },
      sellPrice: installSellPrice,
    },
    controls: {
      materialCost: totals.controlsMtl,
      engineeringLaborCost: controlsInternalLaborCost,
      internalCost: controlsInternalCost,
      markup: {
        overhead: controlsCosts.overhead,
        profit: controlsCosts.profit,
        bond: controlsCosts.bond,
      },
      sellPrice: controlsSellPrice,
    },
    totals: {
      internalCost,
      markupTotal: turnkeySellPrice - internalCost,
      installSellPrice,
      controlsSellPrice,
      turnkeySellPrice,
    },
    diagnostics: {
      installRawLaborHours: totals.lbrHrs,
      controlsRawLaborHours: totals.controlsLbrHrs,
      estimateScopeMode: normalizedSettings.estimateScopeMode,
      hasControlsCost: controlsInternalCost > 0,
      hasInstallCost: installInternalCost > 0,
    },
  };
}

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function accumulateScopeTotals(item, controlsCatalog, settings) {
  const cost = calcItem(item, controlsCatalog);
  const hasKnownComps = resolveItemComps(item).length > 0;
  const installMaterial = Math.max(0, toSafeNumber(cost.totalMtl) - toSafeNumber(cost.totalControlsMtl));
  const installLaborHrs = Math.max(0, toSafeNumber(cost.totalLbr) - toSafeNumber(cost.totalControlsLbr));
  const controlsMaterial = Math.max(0, toSafeNumber(cost.totalControlsMtl));
  const controlsLaborHrs = Math.max(0, toSafeNumber(cost.totalControlsLbr));
  const installLabor = installLaborHrs * toSafeNumber(settings?.wageRate, DEFAULT_SETTINGS.wageRate);
  const controlsLabor = controlsLaborHrs * toSafeNumber(settings?.controlsWageRate, DEFAULT_SETTINGS.controlsWageRate);

  return {
    isUnclassified: !hasKnownComps && (installMaterial + installLabor + controlsMaterial + controlsLabor > 0),
    installMaterial,
    installLaborHrs,
    installLabor,
    controlsMaterial,
    controlsLaborHrs,
    controlsLabor,
    installRaw: installMaterial + installLabor,
    controlsRaw: controlsMaterial + controlsLabor,
  };
}

export function deriveCostBreakdownByScope(estimate, controlsCatalog = {}, settings = {}, totalInternalCost = 0) {
  const items = Array.isArray(estimate?.items) ? estimate.items : [];
  const scopeTotals = {
    controlsMaterial: 0,
    controlsLaborHrs: 0,
    controlsLabor: 0,
    installMaterial: 0,
    installLaborHrs: 0,
    installLabor: 0,
    controlsRaw: 0,
    installRaw: 0,
    unclassifiedRaw: 0,
  };
  let unclassifiedCount = 0;

  for (const item of items) {
    try {
      const next = accumulateScopeTotals(item, controlsCatalog, settings);
      if (next.isUnclassified) {
        unclassifiedCount += 1;
        scopeTotals.unclassifiedRaw += next.installRaw + next.controlsRaw;
      } else {
        scopeTotals.controlsMaterial += next.controlsMaterial;
        scopeTotals.controlsLaborHrs += next.controlsLaborHrs;
        scopeTotals.controlsLabor += next.controlsLabor;
        scopeTotals.installMaterial += next.installMaterial;
        scopeTotals.installLaborHrs += next.installLaborHrs;
        scopeTotals.installLabor += next.installLabor;
        scopeTotals.controlsRaw += next.controlsRaw;
        scopeTotals.installRaw += next.installRaw;
      }
    } catch {
      unclassifiedCount += 1;
    }
  }

  const controlsTotal = scopeTotals.controlsMaterial + scopeTotals.controlsLabor;
  const installTotal = scopeTotals.installMaterial + scopeTotals.installLabor;
  const unclassifiedTotal = Math.max(0, toSafeNumber(totalInternalCost) - controlsTotal - installTotal);
  const total = Math.max(0, controlsTotal + installTotal + unclassifiedTotal);
  const divisor = total > 0 ? total : 1;
  const controlsPercent = (controlsTotal / divisor) * 100;
  const installPercent = (installTotal / divisor) * 100;
  const unclassifiedPercent = (unclassifiedTotal / divisor) * 100;

  return {
    total,
    controls: {
      total: controlsTotal,
      percent: controlsPercent,
      material: scopeTotals.controlsMaterial,
      labor: scopeTotals.controlsLabor,
      hasScope: controlsTotal > 0,
    },
    installation: {
      total: installTotal,
      percent: installPercent,
      material: scopeTotals.installMaterial,
      labor: scopeTotals.installLabor,
      hasScope: installTotal > 0,
    },
    unclassified: {
      total: unclassifiedTotal,
      percent: unclassifiedPercent,
      material: 0,
      labor: 0,
      hasScope: unclassifiedTotal > 0,
      count: unclassifiedCount,
    },
    controlsRawCost: scopeTotals.controlsRaw,
    installationRawCost: scopeTotals.installRaw,
    unclassifiedRawCost: scopeTotals.unclassifiedRaw,
    hasUnclassified: unclassifiedTotal > 0 || unclassifiedCount > 0,
  };
}

export const deriveScopeBreakdown = deriveCostBreakdownByScope;

export function getItemDetails(item, controlsCatalog = {}) {
  const comps = resolveItemComps(item);
  const selected = comps
    .filter((c) => item.selected?.some((s) => s.id === c.id))
    .map((comp) => {
      const qty = getCompQty(item, comp.id);
      const cost = getCompCost(item, comp);
      const controlsId = comp.controlsId || null;
      const controlsOverride = getControlsOverride(item, comp.id);
      const controlsCustomPart = getControlsCustomPart(item, comp.id);
      const controlsEntry = controlsId ? controlsCatalog?.[controlsId] : null;
      const controlsAlternates = controlsEntry
        ? [
            { id: controlsId, desc: controlsEntry.desc || controlsId },
            ...(controlsEntry.alternateIds || []).map((altId) => ({
              id: altId,
              desc: controlsCatalog?.[altId]?.desc || altId,
            })),
          ]
        : [];
      const controlsCost = getControlsCost(comp, controlsCatalog, controlsOverride, controlsCustomPart);
      return {
        id: comp.id,
        label: comp.label || comp.name || comp.id,
        qty,
        mtl: (cost?.mtl || 0) * qty,
        lbr: (cost?.lbr || 0) * qty,
        controlsId,
        controlsOverride,
        controlsCustomPart,
        controlsAlternates,
        controlsMtl: (controlsCost?.mtl || 0) * qty,
        controlsLbr: (controlsCost?.lbr || 0) * qty,
      };
    });

  const custom = (item.custom || []).map((entry) => {
    const cost = getCustomCost(item, entry);
    return {
      id: entry.id || entry.label,
      label: entry.label || "Custom",
      category: entry.category || "Imported Assembly",
      qty: Math.max(1, Number(entry.qty || 1)),
      mtl: cost.mtl || 0,
      lbr: cost.lbr || 0,
    };
  });

  return { selected, custom };
}

export function deriveItemControlsCostBreakdown(item, controlsCatalog = {}, settings = {}) {
  const normalizedItem = item || {};
  const normalizedSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const itemQty = Math.max(1, Number(normalizedItem.qty) || 1);
  const comps = resolveItemComps(normalizedItem);
  const selectedRows = comps
    .filter((comp) => normalizedItem.selected?.some((entry) => entry.id === comp.id))
    .map((comp) => {
      const qtyPerUnit = Math.max(1, Number(getCompQty(normalizedItem, comp.id)) || 1);
      const controlsOverride = getControlsOverride(normalizedItem, comp.id);
      const controlsCustomPart = getControlsCustomPart(normalizedItem, comp.id);
      const controlsCost = getControlsCost(comp, controlsCatalog, controlsOverride, controlsCustomPart);
      const unitMaterialCost = (controlsCost?.mtl || 0) * qtyPerUnit;
      const unitLaborHours = (controlsCost?.lbr || 0) * qtyPerUnit;
      const unitLaborDollarCost = unitLaborHours * normalizedSettings.controlsWageRate;
      const unitInternalCost = unitMaterialCost + unitLaborDollarCost;
      const extendedQty = itemQty * qtyPerUnit;
      const extendedMaterialCost = unitMaterialCost * itemQty;
      const extendedLaborHours = unitLaborHours * itemQty;
      const extendedLaborDollarCost = unitLaborDollarCost * itemQty;
      const totalInternalCost = unitInternalCost * itemQty;

      return {
        id: comp.id,
        name: comp.label || comp.name || comp.id,
        controlsId: controlsOverride || comp.controlsId || null,
        controlsOverride,
        controlsCustomPart,
        qtyPerUnit,
        extendedQty,
        unitMaterialCost,
        extendedMaterialCost,
        unitLaborHours,
        extendedLaborHours,
        unitLaborDollarCost,
        extendedLaborDollarCost,
        unitInternalCost,
        totalInternalCost,
      };
    })
    .sort((left, right) => {
      const delta = (right.totalInternalCost || 0) - (left.totalInternalCost || 0);
      if (delta !== 0) return delta;
      return String(left.name || "").localeCompare(String(right.name || ""));
    });

  const totals = selectedRows.reduce((acc, row) => ({
    controlsMaterialPerUnit: acc.controlsMaterialPerUnit + row.unitMaterialCost,
    controlsLaborHoursPerUnit: acc.controlsLaborHoursPerUnit + row.unitLaborHours,
    controlsLaborDollarPerUnit: acc.controlsLaborDollarPerUnit + row.unitLaborDollarCost,
    controlsInternalCostPerUnit: acc.controlsInternalCostPerUnit + row.unitInternalCost,
    extendedControlsMaterial: acc.extendedControlsMaterial + row.extendedMaterialCost,
    extendedControlsLaborHours: acc.extendedControlsLaborHours + row.extendedLaborHours,
    extendedControlsLaborDollars: acc.extendedControlsLaborDollars + row.extendedLaborDollarCost,
    extendedTotalControlsInternalCost: acc.extendedTotalControlsInternalCost + row.totalInternalCost,
  }), {
    controlsMaterialPerUnit: 0,
    controlsLaborHoursPerUnit: 0,
    controlsLaborDollarPerUnit: 0,
    controlsInternalCostPerUnit: 0,
    extendedControlsMaterial: 0,
    extendedControlsLaborHours: 0,
    extendedControlsLaborDollars: 0,
    extendedTotalControlsInternalCost: 0,
  });

  return {
    itemQty,
    rows: selectedRows,
    totals,
    hasRows: selectedRows.length > 0,
  };
}

function buildBomPartIdentity(row, controlsCatalog) {
  const customPart = row.controlsCustomPart || null;
  const internalId = String(row.controlsId || row.controlsOverride || row.id || "—").trim() || "—";
  if (customPart) {
    const displayPartNumber = String(customPart.partNumber || customPart.modelNumber || customPart.model || customPart.catalogNumber || customPart.description || "").trim();
    const vendor = String(customPart.vendor || customPart.manufacturer || customPart.brand || "").trim() || null;
    return {
      displayPartNumber: displayPartNumber || null,
      internalId,
      manufacturer: vendor,
      vendor,
    };
  }

  const catalogRow = controlsCatalog?.[row.controlsId || row.controlsOverride || row.id] || null;
  const displayPartNumber = String(catalogRow?.partNumber || catalogRow?.manufacturerPartNumber || catalogRow?.modelNumber || catalogRow?.model || catalogRow?.catalogNumber || catalogRow?.vendorPartNumber || catalogRow?.sku || catalogRow?.productCode || catalogRow?.sourcePartNumber || "").trim();
  const vendor = String(catalogRow?.vendor || catalogRow?.manufacturer || "").trim() || null;
  return {
    displayPartNumber: displayPartNumber || null,
    internalId,
    manufacturer: vendor,
    vendor,
  };
}

function buildBomEquipmentLabel(item) {
  const typeLabel = TYPE_META[item.type]?.label || String(item.type || "ITEM").toUpperCase();
  const sourceBits = [item.tag, item.location].map((part) => String(part || "").trim()).filter(Boolean);
  return {
    system: typeLabel,
    tag: String(item.tag || "").trim(),
    equipmentType: String(item.location || item.cfg?.ahuType || item.cfg?.plantType || item.cfg?.componentId || item.type || "").trim() || "—",
    sourceLabel: sourceBits.length ? `${typeLabel} · ${sourceBits.join(" · ")}` : typeLabel,
  };
}

export function deriveControlsBomRows(estimate, controlsCatalog = {}, settings = {}) {
  const normalizedEstimate = estimate || {};
  const normalizedSettings = { ...DEFAULT_SETTINGS, ...(normalizedEstimate.settings || {}), ...(settings || {}) };
  const equipmentGroups = [];

  for (const item of normalizedEstimate.items || []) {
    const itemBreakdown = deriveItemControlsCostBreakdown(item, controlsCatalog, normalizedSettings);
    if (!itemBreakdown.rows.length) continue;

    const equipment = buildBomEquipmentLabel(item);
    const rows = itemBreakdown.rows.map((row) => ({
      id: `${item.id}-${row.id}`,
      groupId: item.id,
      groupKind: "equipment",
      system: equipment.system,
      tag: equipment.tag || "—",
      equipmentType: equipment.equipmentType,
      sourceLabel: equipment.sourceLabel,
      controlsPart: row.name,
      ...buildBomPartIdentity(row, controlsCatalog),
      qtyPerUnit: row.qtyPerUnit,
      equipmentQty: itemBreakdown.itemQty,
      extendedQty: row.extendedQty,
      unitMaterialCost: row.unitMaterialCost,
      extendedMaterialCost: row.extendedMaterialCost,
      unitLaborHours: row.unitLaborHours,
      extendedLaborHours: row.extendedLaborHours,
      unitLaborDollarCost: row.unitLaborDollarCost,
      extendedLaborDollarCost: row.extendedLaborDollarCost,
      totalInternalCost: row.totalInternalCost,
      controlsCustomPart: row.controlsCustomPart || null,
      controlsId: row.controlsId || null,
      vendor: row.vendor || row.manufacturer || null,
    }));

    equipmentGroups.push({
      id: item.id,
      kind: "equipment",
      system: equipment.system,
      tag: equipment.tag || "—",
      equipmentType: equipment.equipmentType,
      sourceLabel: equipment.sourceLabel,
      subtotalInternalCost: itemBreakdown.totals.extendedTotalControlsInternalCost,
      subtotalMaterialCost: itemBreakdown.totals.extendedControlsMaterial,
      subtotalLaborHours: itemBreakdown.totals.extendedControlsLaborHours,
      equipmentQty: itemBreakdown.itemQty,
      rows,
    });
  }

  const ddcInfrastructure = calcEstimate(normalizedEstimate, controlsCatalog).ddcInfrastructure || {
    rows: [],
    rawMtl: 0,
    rawLbrHrs: 0,
    grandTotal: 0,
  };
  const controlsWageRate = Number(normalizedSettings.controlsWageRate || DEFAULT_SETTINGS.controlsWageRate) || DEFAULT_SETTINGS.controlsWageRate;
  const ddcRows = (ddcInfrastructure.rows || []).map((row) => {
    const qty = Math.max(1, Number(row.qty) || 1);
    const unitMaterialCost = (Number(row.mtlTotal) || 0) / qty;
    const unitLaborHours = (Number(row.hrsTotal) || 0) / qty;
    const unitLaborDollarCost = unitLaborHours * controlsWageRate;
    const totalInternalCost = (Number(row.mtlTotal) || 0) + (Number(row.hrsTotal) || 0) * controlsWageRate;
    return {
      id: `ddc-${row.catalogId}`,
      groupId: "ddc-infrastructure",
      groupKind: "ddc",
      system: "DDC Infrastructure",
      tag: "—",
      equipmentType: "Infrastructure",
      sourceLabel: "DDC Infrastructure",
      controlsPart: row.description || row.catalogId,
      ...buildBomPartIdentity({
        id: row.catalogId,
        controlsId: row.catalogId,
        controlsOverride: null,
        controlsCustomPart: null,
      }, controlsCatalog),
      vendor: (controlsCatalog?.[row.catalogId]?.vendor || controlsCatalog?.[row.catalogId]?.manufacturer || null),
      qtyPerUnit: qty,
      equipmentQty: 1,
      extendedQty: qty,
      unitMaterialCost,
      extendedMaterialCost: Number(row.mtlTotal) || 0,
      unitLaborHours,
      extendedLaborHours: Number(row.hrsTotal) || 0,
      unitLaborDollarCost,
      extendedLaborDollarCost: (Number(row.hrsTotal) || 0) * controlsWageRate,
      totalInternalCost,
      controlsCustomPart: null,
      controlsId: row.catalogId,
    };
  });

  if (ddcRows.length) {
    equipmentGroups.push({
      id: "ddc-infrastructure",
      kind: "ddc",
      system: "DDC Infrastructure",
      tag: "—",
      equipmentType: "Infrastructure",
      sourceLabel: "DDC Infrastructure",
      subtotalInternalCost: ddcRows.reduce((sum, row) => sum + (row.totalInternalCost || 0), 0),
      subtotalMaterialCost: ddcRows.reduce((sum, row) => sum + (row.extendedMaterialCost || 0), 0),
      subtotalLaborHours: ddcRows.reduce((sum, row) => sum + (row.extendedLaborHours || 0), 0),
      equipmentQty: 1,
      rows: ddcRows,
    });
  }

  const totals = equipmentGroups.reduce((acc, group) => ({
    rowCount: acc.rowCount + (group.rows?.length || 0),
    groupCount: acc.groupCount + 1,
    internalCost: acc.internalCost + (group.subtotalInternalCost || 0),
    materialCost: acc.materialCost + (group.subtotalMaterialCost || 0),
    laborHours: acc.laborHours + (group.subtotalLaborHours || 0),
  }), {
    rowCount: 0,
    groupCount: 0,
    internalCost: 0,
    materialCost: 0,
    laborHours: 0,
  });

  return {
    groups: equipmentGroups,
    totals,
    hasRows: equipmentGroups.length > 0,
  };
}

export function fmtAuditDate(value) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString();
}

export function buildItemsWithComps(estimate) {
  const settings = { ...DEFAULT_SETTINGS, ...(estimate.settings || {}) };
  return (estimate.items || []).map((item) => {
    const comps = resolveItemComps(item);
    const selComps = comps.filter((c) =>
      item.selected?.some((s) => s.id === c.id) && shouldIncludeProposalComp(c)
    );
    const compNames = selComps.map((c) => c.label || c.name || c.id);
    (item.custom || []).forEach((c) => { if (c.label) compNames.push(c.label); });
    if (item.type === "vav" && !settings.vavFieldMount) {
      compNames.push("VAV controllers factory installed");
    }
    const meta = TYPE_META[item.type] || {};
    const label = meta.label
      ? meta.label + (item.cfg?.ahuType
        ? " â€” " + (AHU_TYPES.find((t) => t.id === item.cfg.ahuType)?.label || "")
        : "")
      : item.type;
    return {
      item: { qty: item.qty, tag: item.tag || "", label, location: item.location || "" },
      compNames: compNames.length > 0 ? compNames : ["Installation per project specifications"],
    };
  });
}

import { T } from "../../shared/tokens.js";
import { DEFAULT_SETTINGS } from "./projectSettings.js";
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
import { calcAssembly } from "../../shared/assemblyData.js";

const CUSTOM_COMPS = getAllEquipmentComponents();

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

function resolveItemComps(item) {
  let comps = COMPS_MAP[item.type] || [];
  if (item.type === "plant" && item.cfg?.plantType) {
    comps = PLANT_COMPS[item.cfg.plantType] || [];
  } else if (item.type === "custom" && item.cfg?.componentId) {
    const selected = comps.find((component) => component.id === item.cfg.componentId);
    comps = selected ? [selected] : comps;
  }
  return comps;
}

function getCompQty(item, id) {
  return item.selected?.find((s) => s.id === id)?.qty ?? 1;
}

function getCompCost(item, comp) {
  const aid = String(item.installType === "EMT" ? comp.emtAID : comp.plnAID);
  const snap = item.priceSnap?.[comp.id] || (aid && aid !== "undefined" ? item.priceSnap?.[aid] : null);
  if (snap) return snap;
  if (!aid || aid === "undefined") return { mtl: comp.unitMtl || 0, lbr: comp.unitLbr || 0 };
  return calcAssembly(aid);
}

function getControlsOverride(item, id) {
  return item.selected?.find((s) => s.id === id)?.controlsOverride || null;
}

function getControlsCustomPart(item, id) {
  return item.selected?.find((s) => s.id === id)?.controlsCustomPart || null;
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
  return (estimate.items || []).reduce((acc, item) => {
    const c = calcItem(item, controlsCatalog);
    return {
      mtl: acc.mtl + c.totalMtl,
      lbrHrs: acc.lbrHrs + c.totalLbr,
      controlsMtl: acc.controlsMtl + c.totalControlsMtl,
      controlsLbrHrs: acc.controlsLbrHrs + c.totalControlsLbr,
    };
  }, { mtl: 0, lbrHrs: 0, controlsMtl: 0, controlsLbrHrs: 0 });
}

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

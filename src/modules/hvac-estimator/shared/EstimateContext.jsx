import { createContext, useContext, useMemo, useState } from "react";
import { calcAssembly, UNIT_ITEMS } from "./assemblyData.js";
import { getCurrentUser } from "./currentUser.js";
import { VAV_COMPS } from "../components/vav/vavData.js";
import { AHU_COMPS } from "../components/ahu/ahuData.js";
import { RTU_COMPS } from "../components/rtu/rtuData.js";
import { DX_COMPS } from "../components/dx/dxData.js";
import { VRF_COMPS } from "../components/vrf/vrfData.js";
import { FCU_COMPS } from "../components/fcu/fcuData.js";
import { UH_COMPS } from "../components/uh/uhData.js";
import { PLANT_COMPS } from "../components/plant/plantData.js";
import { NETWORK_COMPS } from "../components/network/networkData.js";
import { EXHAUST_FAN_COMPS } from "../components/exhaustFan/exhaustFanData.js";
import { getAllEquipmentComponents } from "./componentCatalog.js";

const Ctx = createContext(null);

const CUSTOM_COMPS = getAllEquipmentComponents();

const COMPS_MAP = {
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

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `item_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getComponentsForItem(type, cfg) {
  if (type === "plant" && cfg?.plantType) return PLANT_COMPS[cfg.plantType] || [];
  if (type === "custom" && cfg?.componentId) {
    const custom = COMPS_MAP.custom || [];
    const selected = custom.find(entry => entry.id === cfg.componentId);
    return selected ? [selected] : custom;
  }
  return COMPS_MAP[type] || [];
}

function getActiveInstallCatalog(installCatalog) {
  return installCatalog && Object.keys(installCatalog).length > 0 ? installCatalog : UNIT_ITEMS;
}

function buildPriceSnapshot(type, cfg, selected, installType, installCatalog) {
  if (!selected?.length) return {};

  const comps = getComponentsForItem(type, cfg);
  const snap = {};
  const activeInstallCatalog = getActiveInstallCatalog(installCatalog);

  for (const sel of selected) {
    const comp = comps.find(entry => entry.id === sel.id);
    if (!comp) continue;

    const aid = installType === "EMT" ? comp.emtAID : comp.plnAID;
    snap[comp.id] =
      aid && String(aid) !== "undefined"
        ? calcAssembly(String(aid), {}, activeInstallCatalog)
        : { mtl: comp.unitMtl || 0, lbr: comp.unitLbr || 0 };
  }

  return snap;
}

function stamp(estimate, patch = {}) {
  const currentUser = getCurrentUser();
  return {
    ...estimate,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser || estimate.updatedBy || estimate.createdBy || null,
  };
}

export function ProjectHubEstimateProvider({
  estimate,
  onChange,
  onAutosave,
  installCatalog,
  controlsCatalog,
  children,
}) {
  const [subPage, setSubPage] = useState(null);
  const activeId = estimate?.id || null;
  const activeInstallCatalog = getActiveInstallCatalog(installCatalog);
  const editingItem = subPage?.editItemId
    ? estimate?.items?.find(item => item.id === subPage.editItemId) || null
    : null;

  const persist = nextEstimate => {
    onChange(nextEstimate);
  };

  const autosave = nextEstimate => {
    if (typeof onAutosave !== "function") return;
    void onAutosave(nextEstimate);
  };

  const addItem = (type, tag, location, cfg, selected, custom, qty, installType) => {
    if (!activeId) return false;

    const updatedAt = new Date().toISOString();
    const priceSnap = buildPriceSnapshot(type, cfg, selected, installType, activeInstallCatalog);
    const item = {
      id: uid(),
      type,
      tag,
      location,
      cfg,
      selected,
      custom,
      qty,
      installType,
      addedAt: updatedAt,
      priceSnap,
      pricesLockedAt: updatedAt,
    };

    const nextEstimate = stamp(estimate, { items: [...(estimate.items || []), item] });
    persist(nextEstimate);
    autosave(nextEstimate);
    setSubPage(null);
    return true;
  };

  const updateItem = (itemId, type, tag, location, cfg, selected, custom, qty, installType) => {
    if (!activeId) return false;

    const updatedAt = new Date().toISOString();
    const priceSnap = buildPriceSnapshot(type, cfg, selected, installType, activeInstallCatalog);
    const nextEstimate = stamp(estimate, {
      items: (estimate.items || []).map(item =>
        item.id === itemId
          ? {
              ...item,
              type,
              tag,
              location,
              cfg,
              selected,
              custom,
              qty,
              installType,
              priceSnap,
              pricesLockedAt: updatedAt,
            }
          : item,
      ),
    });
    persist(nextEstimate);
    autosave(nextEstimate);
    setSubPage(null);
    return true;
  };

  const refreshItemPrices = (estimateId, itemId) => {
    if (estimateId !== activeId) return false;
    const nextEstimate = stamp(estimate, {
      items: (estimate.items || []).map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          priceSnap: buildPriceSnapshot(item.type, item.cfg, item.selected, item.installType, activeInstallCatalog),
          pricesLockedAt: new Date().toISOString(),
        };
      }),
    });
    persist(nextEstimate);
    autosave(nextEstimate);
    return true;
  };

  const refreshAllPrices = estimateId => {
    if (estimateId !== activeId) return false;
    const nextEstimate = stamp(estimate, {
      items: (estimate.items || []).map(item => ({
        ...item,
        priceSnap: buildPriceSnapshot(item.type, item.cfg, item.selected, item.installType, activeInstallCatalog),
        pricesLockedAt: new Date().toISOString(),
      })),
    });
    persist(nextEstimate);
    autosave(nextEstimate);
    return true;
  };

  const applyDefaultInstallType = estimateId => {
    if (estimateId !== activeId) return false;
    const installType = estimate.settings?.defaultInstallType || "EMT";
    const nextEstimate = stamp(estimate, {
      items: (estimate.items || []).map(item => ({
        ...item,
        installType,
        priceSnap: buildPriceSnapshot(item.type, item.cfg, item.selected, installType, activeInstallCatalog),
        pricesLockedAt: new Date().toISOString(),
      })),
    });
    persist(nextEstimate);
    autosave(nextEstimate);
    return true;
  };

  const value = useMemo(() => ({
    estimates: estimate ? [estimate] : [],
    activeEstimate: estimate || null,
    activeId,
    setActiveId: () => {},
    addItem,
    updateItem,
    updateEstimates: estimates => {
      const next = estimates?.find(entry => entry.id === activeId);
      if (next) persist(next);
    },
    refreshItemPrices,
    refreshAllPrices,
    applyDefaultInstallType,
    subPage,
    setSubPage,
    editingItem,
    controlsCatalog,
  }), [estimate, activeId, editingItem, installCatalog, subPage, controlsCatalog]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useEstimate = () => useContext(Ctx);

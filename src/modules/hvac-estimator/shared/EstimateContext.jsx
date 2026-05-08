import { createContext, useContext, useMemo, useState } from "react";
import { calcAssembly } from "./assemblyData.js";
import { loadUnitPrices } from "./unitPriceStore.js";
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

const Ctx = createContext(null);

const COMPS_MAP = {
  vav: VAV_COMPS,
  ahu: AHU_COMPS,
  rtu: RTU_COMPS,
  dx: DX_COMPS,
  vrf: VRF_COMPS,
  fcu: FCU_COMPS,
  uh: UH_COMPS,
  network: NETWORK_COMPS,
};

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `item_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getComponentsForItem(type, cfg) {
  if (type === "plant" && cfg?.plantType) return PLANT_COMPS[cfg.plantType] || [];
  return COMPS_MAP[type] || [];
}

function buildPriceSnapshot(type, cfg, selected, installType, overrides) {
  if (!selected?.length) return {};

  const comps = getComponentsForItem(type, cfg);
  const snap = {};

  for (const sel of selected) {
    const comp = comps.find(entry => entry.id === sel.id);
    if (!comp) continue;

    const aid = installType === "EMT" ? comp.emtAID : comp.plnAID;
    snap[comp.id] =
      aid && String(aid) !== "undefined"
        ? calcAssembly(String(aid), overrides)
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

export function ProjectHubEstimateProvider({ estimate, onChange, children }) {
  const [subPage, setSubPage] = useState(null);
  const activeId = estimate?.id || null;
  const editingItem = subPage?.editItemId
    ? estimate?.items?.find(item => item.id === subPage.editItemId) || null
    : null;

  const persist = nextEstimate => {
    onChange(nextEstimate);
  };

  const addItem = (type, tag, location, cfg, selected, custom, qty, installType) => {
    if (!activeId) return false;

    const updatedAt = new Date().toISOString();
    const priceSnap = buildPriceSnapshot(type, cfg, selected, installType, loadUnitPrices());
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

    persist(stamp(estimate, { items: [...(estimate.items || []), item] }));
    setSubPage(null);
    return true;
  };

  const updateItem = (itemId, type, tag, location, cfg, selected, custom, qty, installType) => {
    if (!activeId) return false;

    const updatedAt = new Date().toISOString();
    const priceSnap = buildPriceSnapshot(type, cfg, selected, installType, loadUnitPrices());
    persist(stamp(estimate, {
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
    }));
    setSubPage(null);
    return true;
  };

  const refreshItemPrices = (estimateId, itemId) => {
    if (estimateId !== activeId) return false;
    const overrides = loadUnitPrices();
    persist(stamp(estimate, {
      items: (estimate.items || []).map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          priceSnap: buildPriceSnapshot(item.type, item.cfg, item.selected, item.installType, overrides),
          pricesLockedAt: new Date().toISOString(),
        };
      }),
    }));
    return true;
  };

  const refreshAllPrices = estimateId => {
    if (estimateId !== activeId) return false;
    const overrides = loadUnitPrices();
    persist(stamp(estimate, {
      items: (estimate.items || []).map(item => ({
        ...item,
        priceSnap: buildPriceSnapshot(item.type, item.cfg, item.selected, item.installType, overrides),
        pricesLockedAt: new Date().toISOString(),
      })),
    }));
    return true;
  };

  const applyDefaultInstallType = estimateId => {
    if (estimateId !== activeId) return false;
    const installType = estimate.settings?.defaultInstallType || "EMT";
    const overrides = loadUnitPrices();
    persist(stamp(estimate, {
      items: (estimate.items || []).map(item => ({
        ...item,
        installType,
        priceSnap: buildPriceSnapshot(item.type, item.cfg, item.selected, installType, overrides),
        pricesLockedAt: new Date().toISOString(),
      })),
    }));
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
  }), [estimate, activeId, editingItem, subPage]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useEstimate = () => useContext(Ctx);

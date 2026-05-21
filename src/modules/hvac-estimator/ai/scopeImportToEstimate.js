import { getCustomComponentOptions } from "../shared/componentCatalog.js";
import { resolveAssemblyCatalogMatch, describeAssemblyResolution } from "./assemblyResolver.js";
import { normalizeAhuCfg, applyAhuDefaultSelections, getVisibleAhuComponents } from "../components/ahu/ahuData.js";
import { normalizeDxCfg, applyDxDefaultSelections, getVisibleDxComponents } from "../components/dx/dxData.js";
import { normalizeFcuCfg, applyFcuDefaultSelections, getVisibleFcuComponents } from "../components/fcu/fcuData.js";
import { normalizeRtuCfg, applyRtuDefaultSelections, getVisibleRtuComponents } from "../components/rtu/rtuData.js";
import { normalizeUhCfg, applyUhDefaultSelections, getVisibleUhComponents } from "../components/uh/uhData.js";
import { normalizeVavCfg, applyVavDefaultSelections, getVisibleVavComponents } from "../components/vav/vavData.js";
import { normalizeVrfCfg, buildDefaultVrfSelected, getVisibleVrfComponents } from "../components/vrf/vrfData.js";
import { PLANT_COMPS, PLANT_TYPES } from "../components/plant/plantData.js";
import { NETWORK_COMPS } from "../components/network/networkData.js";
import { EXHAUST_FAN_COMPS } from "../components/exhaustFan/exhaustFanData.js";

const CUSTOM_COMPONENT_OPTIONS = getCustomComponentOptions();
const SUPPORTED_TYPES = [
  "ahu",
  "vav",
  "rtu",
  "dx",
  "vrf",
  "fcu",
  "uh",
  "plant",
  "network",
  "exhaust-fan",
  "custom",
];

const TYPE_COMPONENTS = {
  network: NETWORK_COMPS,
  "exhaust-fan": EXHAUST_FAN_COMPS,
};

function asString(value) {
  return typeof value === "string" ? value : "";
}

function asNumber(value, fallback = 1) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLookup(value) {
  return String(value || "").trim().toLowerCase();
}

function getComponents(type) {
  const value = TYPE_COMPONENTS[type];
  return Array.isArray(value) ? value : [];
}

function getCustomComponentId(cfg) {
  const value = asString(cfg.componentId);
  if (value) return value;
  return CUSTOM_COMPONENT_OPTIONS[0]?.id ?? "";
}

function getDefaultCfg(type) {
  switch (type) {
    case "ahu":
      return normalizeAhuCfg({});
    case "vav":
      return normalizeVavCfg({});
    case "rtu":
      return normalizeRtuCfg({});
    case "dx":
      return normalizeDxCfg({});
    case "vrf":
      return normalizeVrfCfg({});
    case "fcu":
      return normalizeFcuCfg({});
    case "uh":
      return normalizeUhCfg({});
    case "custom":
      return { componentId: CUSTOM_COMPONENT_OPTIONS[0]?.id ?? "" };
    default:
      return {};
  }
}

function getVisibleComponentsForType(type, cfg) {
  switch (type) {
    case "ahu":
      return getVisibleAhuComponents(cfg);
    case "vav":
      return getVisibleVavComponents(cfg);
    case "rtu":
      return getVisibleRtuComponents(cfg);
    case "dx":
      return getVisibleDxComponents(cfg);
    case "vrf":
      return getVisibleVrfComponents(cfg);
    case "fcu":
      return getVisibleFcuComponents(cfg);
    case "uh":
      return getVisibleUhComponents(cfg);
    case "custom":
      return CUSTOM_COMPONENT_OPTIONS.map((component) => ({
        ...component.component,
        sourceType: component.type,
        sourceLabel: component.typeLabel,
      }));
    default:
      return getComponents(type);
  }
}

function getDefaultSelectedForType(type, cfg) {
  switch (type) {
    case "ahu":
      return applyAhuDefaultSelections([], cfg);
    case "vav":
      return applyVavDefaultSelections([], cfg);
    case "rtu":
      return applyRtuDefaultSelections([], cfg);
    case "dx":
      return applyDxDefaultSelections([], cfg);
    case "vrf":
      return buildDefaultVrfSelected(cfg);
    case "fcu":
      return applyFcuDefaultSelections([], cfg);
    case "uh":
      return applyUhDefaultSelections([], cfg);
    case "custom": {
      const componentId = getCustomComponentId(cfg);
      return componentId ? [{ id: componentId, qty: 1 }] : [];
    }
    default:
      return getComponents(type)
        .filter((component) => Boolean(component.def))
        .map((component) => ({ id: component.id, qty: 1 }));
  }
}

function inferImportedType(system) {
  const rawType = normalizeLookup(asString(system.type));
  const name = normalizeLookup(asString(system.name));
  const haystack = `${rawType} ${name}`;

  if (haystack.includes("ahu") || haystack.includes("air handling")) return "ahu";
  if (haystack.includes("vav") || haystack.includes("terminal box")) return "vav";
  if (haystack.includes("rtu") || haystack.includes("roof top") || haystack.includes("packaged rooftop")) return "rtu";
  if (haystack.includes("dx") || haystack.includes("heat pump") || haystack.includes("split system")) return "dx";
  if (haystack.includes("vrf")) return "vrf";
  if (haystack.includes("fcu") || haystack.includes("fan coil")) return "fcu";
  if (haystack.includes("unit heater") || haystack.includes("uh")) return "uh";
  if (haystack.includes("exhaust fan") || haystack.includes("exhaust") || haystack === "ef") return "exhaust-fan";
  if (
    haystack.includes("chiller") ||
    haystack.includes("boiler") ||
    haystack.includes("cooling tower") ||
    haystack.includes("pumping") ||
    haystack.includes("pump")
  ) {
    return "plant";
  }
  if (haystack.includes("network") || haystack.includes("controller") || haystack.includes("gateway") || haystack.includes("panel")) {
    return "network";
  }
  return SUPPORTED_TYPES.includes(rawType) ? rawType : "custom";
}

function getPlantTypeFromImportedSystem(system) {
  const rawType = normalizeLookup(asString(system.type));
  const name = normalizeLookup(asString(system.name));
  const haystack = `${rawType} ${name}`;

  if (haystack.includes("air") && haystack.includes("chiller")) return "chiller-air";
  if (haystack.includes("water") && haystack.includes("chiller")) return "chiller-water";
  if (haystack.includes("cooling tower")) return "cooling-tower";
  if (haystack.includes("steam boiler")) return "boiler-steam";
  if (haystack.includes("boiler")) return "boiler-hw";
  if (haystack.includes("condenser") && haystack.includes("pump")) return "pumping-cond";
  if (haystack.includes("hot water") && haystack.includes("pump")) return "pumping-hw";
  if (haystack.includes("chilled water") && haystack.includes("pump")) return "pumping-chw";
  return "chiller-air";
}

function getImportedPlantSelections(plantType) {
  const plantCatalog = PLANT_COMPS;
  const comps = plantCatalog[plantType] || [];
  return comps
    .filter((component) => Boolean(component.def))
    .map((component) => ({ id: component.id, qty: 1 }));
}

function buildImportedPointCustomEntries(point) {
  const assemblies = Array.isArray(point.assemblies) ? point.assemblies : [];
  const qty = Math.max(1, asNumber(point.qty, 1));
  const pointName = asString(point.name) || "Imported Point";

  const entries = assemblies.map((assembly, assemblyIndex) => {
    const assemblyRecord = assembly && typeof assembly === "object" ? assembly : {};
    const resolved = resolveAssemblyCatalogMatch({
      assemblyRef: asString(assemblyRecord.assemblyRef),
      assemblyName: asString(assemblyRecord.assemblyName),
      sourceText: asString(assemblyRecord.notes),
    });
    const sourceAssemblyName = asString(assemblyRecord.assemblyName) || asString(assemblyRecord.assemblyRef) || "Imported Assembly";
    const assemblyName = resolved?.name || sourceAssemblyName;
    const notes = [describeAssemblyResolution(resolved, sourceAssemblyName, asString(assemblyRecord.assemblyRef)), asString(assemblyRecord.notes)]
      .filter(Boolean)
      .join(" · ");

    return {
      id: `imported-${pointName}-${assemblyIndex}-${crypto.randomUUID()}`,
      label: assemblyName,
      name: assemblyName,
      category: resolved ? "Assembly" : "Imported Assembly",
      notes,
      qty,
      emtAID: resolved?.id || "",
      plnAID: resolved?.id || "",
    };
  });

  if (!entries.length) {
    return [
      {
        id: `imported-${pointName}-${crypto.randomUUID()}`,
        label: pointName,
        name: pointName,
        category: "Imported Point",
        notes: asString(point.notes),
        qty,
        emtAID: "",
        plnAID: "",
      },
    ];
  }

  return entries;
}

function buildImportedEstimateItem(system, index, installType) {
  const type = inferImportedType(system);
  const plantType = type === "plant" ? getPlantTypeFromImportedSystem(system) : "";
  const cfg =
    type === "plant"
      ? { plantType, aiScopeSystem: system }
      : { ...getDefaultCfg(type), aiScopeSystem: system };
  const selected =
    type === "plant"
      ? getImportedPlantSelections(plantType)
      : getDefaultSelectedForType(type, cfg);
  const points = Array.isArray(system.points) ? system.points : [];

  return {
    id: crypto.randomUUID(),
    type,
    tag: asString(system.name).trim() || `${type.toUpperCase()}-${index + 1}`,
    location: asString(system.location).trim(),
    qty: Math.max(1, asNumber(system.qty, 1)),
    installType,
    selected,
    custom: points.flatMap((point) => buildImportedPointCustomEntries(point)),
    priceSnap: {},
    cfg: {
      ...cfg,
      aiScopeImport: system,
    },
  };
}

export function applyImportedScopeImportToEstimate(estimate, scopeImport) {
  const systems = Array.isArray(scopeImport?.systems) ? scopeImport.systems : [];
  if (!systems.length) {
    throw new Error("The parsed import did not contain any systems.");
  }

  const settings = estimate?.settings || {};
  const installType = settings.defaultInstallType === "Plenum" ? "Plenum" : "EMT";
  const importedItems = systems
    .filter((system) => system && typeof system === "object")
    .map((system, index) => buildImportedEstimateItem(system, index, installType));

  if (!importedItems.length) {
    throw new Error("The parsed import did not produce any estimator items.");
  }

  return {
    nextEstimate: {
      ...estimate,
      items: [...(estimate.items || []), ...importedItems],
      updatedAt: new Date().toISOString(),
    },
    importedCount: importedItems.length,
  };
}

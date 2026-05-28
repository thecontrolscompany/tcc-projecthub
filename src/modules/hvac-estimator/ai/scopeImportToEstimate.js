import { getCustomComponentOptions } from "../shared/componentCatalog.js";
import { resolveAssemblyCatalogMatch, describeAssemblyResolution } from "./assemblyResolver.js";
import { normalizeAhuCfg, applyAhuDefaultSelections, getVisibleAhuComponents } from "../components/ahu/ahuData.js";
import { normalizeDxCfg, applyDxDefaultSelections, getVisibleDxComponents } from "../components/dx/dxData.js";
import { normalizeFcuCfg, applyFcuDefaultSelections, getVisibleFcuComponents } from "../components/fcu/fcuData.js";
import { normalizeRtuCfg, applyRtuDefaultSelections, getVisibleRtuComponents } from "../components/rtu/rtuData.js";
import { normalizeUhCfg, applyUhDefaultSelections, getVisibleUhComponents } from "../components/uh/uhData.js";
import { normalizeVavCfg, applyVavDefaultSelections, getVisibleVavComponents } from "../components/vav/vavData.js";
import { normalizeVrfCfg, buildDefaultVrfSelected, getVisibleVrfComponents } from "../components/vrf/vrfData.js";
import { PLANT_COMPS } from "../components/plant/plantData.js";
import { NETWORK_COMPS } from "../components/network/networkData.js";
import { EXHAUST_FAN_COMPS } from "../components/exhaustFan/exhaustFanData.js";

const CUSTOM_COMPONENT_OPTIONS = getCustomComponentOptions();

function getVisibleCompsForType(type, cfg) {
  switch (type) {
    case "vav": return getVisibleVavComponents(cfg);
    case "ahu": return getVisibleAhuComponents(cfg);
    case "rtu": return getVisibleRtuComponents(cfg);
    case "dx": return getVisibleDxComponents(cfg);
    case "fcu": return getVisibleFcuComponents(cfg);
    case "uh": return getVisibleUhComponents(cfg);
    case "vrf": return getVisibleVrfComponents(cfg);
    case "network": return NETWORK_COMPS;
    case "exhaust-fan": return EXHAUST_FAN_COMPS;
    default: return [];
  }
}

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

function normalizeImportedPointQty(pointQty, systemQty) {
  const qty = Math.max(1, asNumber(pointQty, 1));
  const equipmentQty = Math.max(1, asNumber(systemQty, 1));
  if (equipmentQty > 1 && qty > 1 && qty % equipmentQty === 0) {
    return Math.max(1, qty / equipmentQty);
  }
  return qty;
}

function normalizeLookup(value) {
  return String(value || "").trim().toLowerCase();
}

function pushLine(lines, value = "") {
  if (arguments.length === 1) {
    lines.push("");
    return;
  }
  if (value === null || value === undefined) return;
  const text = String(value).trim();
  if (!text) return;
  lines.push(text);
}

function buildIndentedBullet(lines, value, indent = 0) {
  if (value === null || value === undefined) return;
  const text = String(value).trim();
  if (!text) return;
  lines.push(`${"  ".repeat(Math.max(0, indent))}- ${text}`);
}

function isGenericSystemType(value) {
  const type = normalizeLookup(value);
  return !type || type === "equipment" || type === "system" || type === "misc";
}

export function buildCustomerScopeFromScopeImport(scopeImport) {
  const systems = Array.isArray(scopeImport?.systems) ? scopeImport.systems : [];
  const assumptions = Array.isArray(scopeImport?.assumptions) ? scopeImport.assumptions : [];
  const exclusions = Array.isArray(scopeImport?.exclusions) ? scopeImport.exclusions : [];
  const notes = Array.isArray(scopeImport?.notes) ? scopeImport.notes : [];
  const lines = [];

  pushLine(lines, scopeImport?.baseScopeName || "Customer Scope");
  pushLine(lines);

  systems.forEach((system, systemIndex) => {
    if (!system || typeof system !== "object") return;

    const systemName = asString(system.name).trim() || `System ${systemIndex + 1}`;
    const systemParts = [];
    const qty = Math.max(1, asNumber(system.qty, 1));
    const location = asString(system.location).trim();
    const type = asString(system.type).trim();
    const sourceText = asString(system.sourceText).trim();
    const systemNotes = asString(system.notes).trim();

    if (qty > 1) systemParts.push(`Qty ${qty}`);
    if (!isGenericSystemType(type)) systemParts.push(type);
    if (location) systemParts.push(location);

    pushLine(lines, `${systemIndex + 1}. ${systemName}${systemParts.length ? ` (${systemParts.join(" - ")})` : ""}`);

    if (sourceText) buildIndentedBullet(lines, sourceText, 1);
    if (systemNotes) buildIndentedBullet(lines, systemNotes, 1);

    const points = Array.isArray(system.points) ? system.points : [];
    points.forEach((point) => {
      if (!point || typeof point !== "object") return;

      const pointName = asString(point.name).trim();
      const pointQty = Math.max(1, asNumber(point.qty, 1));
      const pointNotes = asString(point.notes).trim();
      const assemblies = Array.isArray(point.assemblies) ? point.assemblies : [];

      buildIndentedBullet(lines, `${pointName || "Point"}${pointQty > 1 ? ` (Qty ${pointQty})` : ""}`, 1);

      if (pointNotes) buildIndentedBullet(lines, pointNotes, 2);

      assemblies.forEach((assembly) => {
        if (!assembly || typeof assembly !== "object") return;

        const assemblyName = asString(assembly.assemblyName).trim() || asString(assembly.assemblyRef).trim();
        const assemblyQty = Math.max(1, asNumber(assembly.qty, 1));
        const assemblyNotes = asString(assembly.notes).trim();
        const label = assemblyName || "Assembly";
        buildIndentedBullet(lines, `${label}${assemblyQty > 1 ? ` (Qty ${assemblyQty})` : ""}`, 2);
        if (assemblyNotes) buildIndentedBullet(lines, assemblyNotes, 3);
      });
    });

    pushLine(lines);
  });

  if (assumptions.length) {
    pushLine(lines, "Assumptions");
    assumptions.forEach((item) => buildIndentedBullet(lines, item, 1));
    pushLine(lines);
  }

  if (exclusions.length) {
    pushLine(lines, "Exclusions");
    exclusions.forEach((item) => buildIndentedBullet(lines, item, 1));
    pushLine(lines);
  }

  if (notes.length) {
    pushLine(lines, "Notes");
    notes.forEach((item) => buildIndentedBullet(lines, item, 1));
  }

  return lines.join("\n").trim();
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
  if (haystack.includes("vav") || haystack.includes("terminal box") || haystack.includes("variable volume") || haystack.includes("variable air volume") || haystack.includes("air terminal unit")) return "vav";
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

function buildImportedPointCustomEntries(point, selectedAssemblyIds = new Set(), systemQty = 1) {
  const assemblies = Array.isArray(point.assemblies) ? point.assemblies : [];
  const qty = normalizeImportedPointQty(point.qty, systemQty);
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

    if (resolved?.id && selectedAssemblyIds.has(String(resolved.id))) {
      return null;
    }

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
  }).filter(Boolean);

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

  const points = Array.isArray(system.points) ? system.points : [];
  const systemQty = Math.max(1, asNumber(system.qty, 1));
  const hasAiPoints = points.length > 0;

  const baseSelected = hasAiPoints
    ? []
    : type === "plant"
      ? getImportedPlantSelections(plantType)
      : getDefaultSelectedForType(type, cfg);

  // Build reverse map: assembly catalog ID (emtAID/plnAID) → component id.
  // Resolved assemblies whose catalog ID matches a standard component for this
  // equipment type land in selected[] instead of custom[].
  const assemblyToCompId = new Map();
  for (const comp of getVisibleCompsForType(type, cfg)) {
    if (comp.emtAID && !assemblyToCompId.has(String(comp.emtAID))) {
      assemblyToCompId.set(String(comp.emtAID), comp.id);
    }
    if (comp.plnAID && !assemblyToCompId.has(String(comp.plnAID))) {
      assemblyToCompId.set(String(comp.plnAID), comp.id);
    }
  }

  const selectedIds = new Set(baseSelected.map((s) => String(s.id)));
  const additionalSelected = [];
  const customEntries = [];

  for (const point of points) {
    for (const entry of buildImportedPointCustomEntries(point, selectedIds, systemQty)) {
      const resolvedAssemblyId = entry.emtAID ? String(entry.emtAID) : "";
      const compId = resolvedAssemblyId ? assemblyToCompId.get(resolvedAssemblyId) : null;
      if (compId && !selectedIds.has(compId)) {
        additionalSelected.push({ id: compId, qty: entry.qty });
        selectedIds.add(compId);
      } else {
        customEntries.push(entry);
      }
    }
  }

  return {
    id: crypto.randomUUID(),
    type,
    tag: asString(system.name).trim() || `${type.toUpperCase()}-${index + 1}`,
    location: asString(system.location).trim(),
    qty: systemQty,
    installType,
    selected: [...baseSelected, ...additionalSelected],
    custom: customEntries,
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
  const customerScope = buildCustomerScopeFromScopeImport(scopeImport);
  const currentSettings = estimate?.settings || {};

  if (!importedItems.length) {
    throw new Error("The parsed import did not produce any estimator items.");
  }

  return {
    nextEstimate: {
      ...estimate,
      settings: {
        ...currentSettings,
        ...(scopeImport?.baseScopeName ? { baseScopeName: scopeImport.baseScopeName } : {}),
        useCustomerScope: true,
        customerScope,
        customerScopeImport: scopeImport,
      },
      items: [...(estimate.items || []), ...importedItems],
      updatedAt: new Date().toISOString(),
    },
    importedCount: importedItems.length,
  };
}

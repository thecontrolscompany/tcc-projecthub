import { getAllEquipmentComponents } from "./componentCatalog.js";

function isAlwaysTrue(fn) {
  return typeof fn === "function" && fn.toString().replace(/\s+/g, "") === "()=>true";
}

function isDefaultComponent(component) {
  return component.def === true || typeof component.defaultWhen === "function";
}

function isConditionalDefault(component) {
  return typeof component.defaultWhen === "function" && !isAlwaysTrue(component.defaultWhen);
}

function buildUsage(component) {
  return {
    equipmentType: component.sourceLabel,
    pointName: component.label || component.name || component.id,
    category: component.cat ?? null,
    conditional: isConditionalDefault(component),
    conditionSource: isConditionalDefault(component)
      ? component.defaultWhen.toString().replace(/\s+/g, " ").trim()
      : null,
  };
}

function dedupeUsages(usages) {
  const seen = new Map();
  for (const usage of usages) {
    const key = `${usage.equipmentType}::${usage.pointName}::${usage.conditional}::${usage.installType ?? ""}`;
    if (!seen.has(key)) seen.set(key, usage);
  }
  return [...seen.values()];
}

export function buildDefaultPartsIndex(overridesByKey = {}) {
  const components = getAllEquipmentComponents(overridesByKey).filter(isDefaultComponent);

  const controlsDefaultsByCatalogId = new Map();
  const installDefaultsByCatalogId = new Map();
  const assignments = [];
  const assignmentSeen = new Set();

  for (const component of components) {
    const usage = buildUsage(component);

    if (component.controlsId) {
      const list = controlsDefaultsByCatalogId.get(component.controlsId) ?? [];
      list.push(usage);
      controlsDefaultsByCatalogId.set(component.controlsId, list);
    }

    const emtAID = component.emtAID ?? null;
    const plnAID = component.plnAID ?? null;
    const installIds = new Set([emtAID, plnAID].filter(Boolean));
    for (const installId of installIds) {
      const installType =
        emtAID && plnAID && emtAID !== plnAID
          ? installId === emtAID
            ? "EMT"
            : "Plenum"
          : null;
      const list = installDefaultsByCatalogId.get(installId) ?? [];
      list.push({ ...usage, installType });
      installDefaultsByCatalogId.set(installId, list);
    }

    if (!component.controlsId && installIds.size === 0) continue;

    const assignmentKey = `${usage.equipmentType}::${usage.pointName}::${usage.conditional}`;
    if (!assignmentSeen.has(assignmentKey)) {
      assignmentSeen.add(assignmentKey);
      assignments.push({
        ...usage,
        componentKey: component.componentKey ?? null,
        builtInControlsCatalogId: component.builtInControlsId ?? null,
        controlsOverridden: Boolean(component.controlsOverridden),
        controlsCatalogId: component.controlsId ?? null,
        installCatalogId: emtAID ?? plnAID ?? null,
        installCatalogIdPlenum: plnAID && plnAID !== emtAID ? plnAID : null,
      });
    }
  }

  for (const [key, list] of controlsDefaultsByCatalogId) {
    controlsDefaultsByCatalogId.set(key, dedupeUsages(list));
  }
  for (const [key, list] of installDefaultsByCatalogId) {
    installDefaultsByCatalogId.set(key, dedupeUsages(list));
  }

  assignments.sort((a, b) =>
    a.equipmentType.localeCompare(b.equipmentType) || a.pointName.localeCompare(b.pointName),
  );

  return { controlsDefaultsByCatalogId, installDefaultsByCatalogId, assignments };
}

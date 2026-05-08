export const AHU_TYPES = [
  { id: "mixed", label: "Mixed Air", icon: "<>", desc: "Standard return + OA mixing box, economizer capable" },
  { id: "doas", label: "100% OA / DOAS", icon: "->", desc: "Dedicated outside air, no return duct" },
  { id: "erv-wheel", label: "Energy Recovery - Heat Wheel", icon: "O", desc: "Rotary energy recovery wheel on OA/EA streams" },
  { id: "erv-plate", label: "Energy Recovery - Plate HX", icon: "[]", desc: "Fixed plate heat exchanger, cross-flow" },
  { id: "erv-rac", label: "Energy Recovery - Run-Around", icon: "<->", desc: "Run-around coil loop between OA and EA streams" },
];

export const FAN_CONFIGS = [
  { id: "single", label: "Single Supply Fan" },
  { id: "dual", label: "Dual Supply Fans" },
  { id: "wall", label: "Fan Wall Array" },
];

export const RETURN_CONFIGS = [
  { id: "none", label: "No Return Fan" },
  { id: "single", label: "Single Return Fan" },
  { id: "dual", label: "Dual Return Fans" },
];

export const AHU_SUPPLY_FAN_TYPES = [
  { id: "variable", label: "Variable Speed" },
  { id: "constant", label: "Constant Speed" },
];

export const AHU_RETURN_FAN_TYPES = [
  { id: "variable", label: "Variable Speed" },
  { id: "constant", label: "Constant Speed" },
];

export const AHU_ECONOMIZER_TYPES = [
  { id: "none", label: "None" },
  { id: "modulating", label: "Modulating" },
];

export const AHU_COOLING_TYPES = [
  { id: "none", label: "None" },
  { id: "chw-prop", label: "CHW Valve - Proportional" },
  { id: "chw-2pos", label: "CHW Valve - Two-Position" },
  { id: "dx-staged", label: "DX Staged" },
];

export const AHU_HEATING_TYPES = [
  { id: "none", label: "None" },
  { id: "hw-prop", label: "HW Valve - Proportional" },
  { id: "hw-2pos", label: "HW Valve - Two-Position" },
  { id: "hw-incr", label: "HW Valve - Incremental" },
  { id: "electric-staged", label: "Electric Staged" },
  { id: "steam-prop", label: "Steam Valve - Proportional" },
];

export const AHU_PREHEAT_TYPES = [
  { id: "none", label: "None" },
  { id: "hw-prop", label: "HW Valve - Proportional" },
  { id: "hw-2pos", label: "HW Valve - Two-Position" },
  { id: "steam-prop", label: "Steam Valve - Proportional" },
];

export const AHU_REHEAT_TYPES = [
  { id: "none", label: "None" },
  { id: "hw-prop", label: "HW Valve - Proportional" },
  { id: "hw-2pos", label: "HW Valve - Two-Position" },
  { id: "hw-incr", label: "HW Valve - Incremental" },
  { id: "electric-staged", label: "Electric Staged" },
];

export const AHU_HEAT_RECOVERY_TYPES = [
  { id: "none", label: "None" },
  { id: "wheel", label: "Wheel" },
  { id: "plate", label: "Plate HX" },
  { id: "run-around", label: "Run-Around" },
];

export const DEFAULT_AHU_CFG = {
  ahuType: "mixed",
  supplyFanConfig: "single",
  supplyFanType: "variable",
  returnFanConfig: "single",
  returnFanStrategy: "building-pressure",
  returnFanType: "variable",
  economizer: "modulating",
  coolingType: "chw-prop",
  heatingType: "hw-prop",
  preheatType: "none",
  reheatType: "none",
  commonCoilType: "none",
  humidificationType: "none",
  filtration: "standard",
  heatRecoveryType: "none",
  g36: false,
};

const A = ["mixed", "doas", "erv-wheel", "erv-plate", "erv-rac"];
const M = ["mixed"];
const E = ["erv-wheel", "erv-plate", "erv-rac"];
const ME = ["mixed", "erv-wheel", "erv-plate", "erv-rac"];

const isExclusiveAhuGroup = (group) => group?.groupMode === "exclusive";

const withLegacyArrays = (component, types = [], defs = []) => ({
  ...component,
  types,
  defs,
});

export const normalizeAhuCfg = (cfg) => {
  const next = { ...DEFAULT_AHU_CFG, ...(cfg || {}) };

  if (cfg?.fanCfg && !cfg?.supplyFanConfig) {
    next.supplyFanConfig = cfg.fanCfg;
  }

  if (cfg?.retCfg && !cfg?.returnFanConfig) {
    next.returnFanConfig = cfg.retCfg;
  }

  if (cfg?.minOA && !cfg?.economizer) {
    next.economizer = "modulating";
  }

  if (next.ahuType === "erv-wheel") {
    next.ahuType = "doas";
    next.heatRecoveryType = "wheel";
  }

  if (next.ahuType === "erv-plate") {
    next.ahuType = "doas";
    next.heatRecoveryType = "plate";
  }

  if (next.ahuType === "erv-rac") {
    next.ahuType = "mixed";
    next.heatRecoveryType = "run-around";
  }

  if (next.ahuType === "doas") {
    next.commonCoilType = "none";
    next.returnFanConfig = "none";
  }

  if (next.heatRecoveryType === "run-around" && next.ahuType === "doas") {
    next.heatRecoveryType = "none";
  }

  next.fanCfg = next.supplyFanConfig;
  next.retCfg = next.returnFanConfig;
  next.minOA = next.economizer === "modulating";

  return next;
};

export const AHU_COMPONENT_GROUPS = [
  {
    groupId: "ahu-clg-actuator",
    label: "Cooling Coil Actuator Type",
    groupMode: "exclusive",
    required: false,
  },
  {
    groupId: "ahu-htg-actuator",
    label: "Heating Coil Actuator Type",
    groupMode: "exclusive",
    required: false,
  },
  {
    groupId: "ahu-preheat-actuator",
    label: "Preheat Coil Actuator Type",
    groupMode: "exclusive",
    required: false,
  },
  {
    groupId: "ahu-reheat-actuator",
    label: "Reheat Coil Actuator Type",
    groupMode: "exclusive",
    required: false,
  },
  {
    groupId: "ahu-supply-fan",
    label: "Supply Fan Type",
    groupMode: "exclusive",
    required: true,
  },
  {
    groupId: "ahu-return-fan",
    label: "Return Fan Type",
    groupMode: "exclusive",
    required: false,
  },
];

export const getAhuGroup = (groupId, groups = AHU_COMPONENT_GROUPS) =>
  groups.find(group => group.groupId === groupId) || null;

const hasGroupSelection = (selected, groupId, comps) =>
  selected.some(entry => comps.some(comp => comp.id === entry.id && comp.groupId === groupId));

export const isAhuComponentVisible = (comp, cfg) =>
  comp.showWhen ? comp.showWhen(normalizeAhuCfg(cfg)) : true;

export const getVisibleAhuComponents = (cfg, comps = AHU_COMPS) =>
  comps.filter(comp => isAhuComponentVisible(comp, cfg));

export const applyAhuDefaultSelections = (selected, cfg, options = {}) => {
  const normalizedCfg = normalizeAhuCfg(cfg);
  const comps = options.components || AHU_COMPS;
  const groups = options.groups || AHU_COMPONENT_GROUPS;
  const blockedIds = new Set(options.blockedIds || []);
  const next = [...selected];
  const selectedIds = new Set(next.map(entry => entry.id));

  for (const comp of comps) {
    if (!comp.defaultWhen || !comp.defaultWhen(normalizedCfg) || blockedIds.has(comp.id) || selectedIds.has(comp.id)) {
      continue;
    }

    if (comp.groupId) {
      const group = getAhuGroup(comp.groupId, groups);
      if (isExclusiveAhuGroup(group) && hasGroupSelection(next, comp.groupId, comps)) {
        continue;
      }
    }

    next.push({ id: comp.id, qty: 1 });
    selectedIds.add(comp.id);
  }

  return next;
};

export const reconcileAhuSelected = (selected, cfg, options = {}) => {
  const normalizedCfg = normalizeAhuCfg(cfg);
  const comps = options.components || AHU_COMPS;
  const groups = options.groups || AHU_COMPONENT_GROUPS;
  const visibleComponents = getVisibleAhuComponents(normalizedCfg, comps);
  const visibleIds = new Set(visibleComponents.map(comp => comp.id));
  const compById = new Map(comps.map(comp => [comp.id, comp]));
  const takenExclusiveGroups = new Set();
  const next = [];

  for (const entry of selected || []) {
    if (!visibleIds.has(entry.id)) continue;
    const comp = compById.get(entry.id);

    if (!comp?.groupId) {
      next.push(entry);
      continue;
    }

    const group = getAhuGroup(comp.groupId, groups);
    if (isExclusiveAhuGroup(group)) {
      if (takenExclusiveGroups.has(comp.groupId)) continue;
      takenExclusiveGroups.add(comp.groupId);
    }

    next.push(entry);
  }

  return applyAhuDefaultSelections(next, normalizedCfg, {
    blockedIds: options.blockedIds,
    components: visibleComponents,
    groups,
  });
};

export const toggleAhuComponentSelection = (selected, componentId, options = {}) => {
  const comps = options.components || AHU_COMPS;
  const groups = options.groups || AHU_COMPONENT_GROUPS;
  const comp = comps.find(entry => entry.id === componentId);

  if (!comp) return selected;

  const isSelected = selected.some(entry => entry.id === componentId);
  if (!comp.groupId) {
    return isSelected
      ? selected.filter(entry => entry.id !== componentId)
      : [...selected, { id: componentId, qty: 1 }];
  }

  const group = getAhuGroup(comp.groupId, groups);
  const groupMemberIds = new Set(
    comps.filter(entry => entry.groupId === comp.groupId).map(entry => entry.id)
  );

  if (isSelected) {
    const selectedGroupMembers = selected.filter(entry => groupMemberIds.has(entry.id));
    if (group?.required && selectedGroupMembers.length === 1) {
      return selected;
    }
    return selected.filter(entry => entry.id !== componentId);
  }

  return [
    ...selected.filter(entry => !groupMemberIds.has(entry.id)),
    { id: componentId, qty: 1 },
  ];
};

export const AHU_COMPS = [
  withLegacyArrays(
    { id: "oa-temp", emtAID: "60075", plnAID: "60075", name: "OA Temp Sensor", cat: "Temperature", unitMtl: 95, unitLbr: 1.0,
      showWhen: () => true, defaultWhen: () => true, desc: "Outside air temp at intake" },
    A, A
  ),
  withLegacyArrays(
    { id: "ma-temp", emtAID: "60075", plnAID: "60075", name: "Mixed Air Temp", cat: "Temperature", unitMtl: 85, unitLbr: 0.75,
      showWhen: cfg => normalizeAhuCfg(cfg).ahuType === "mixed",
      defaultWhen: cfg => normalizeAhuCfg(cfg).ahuType === "mixed",
      desc: "Mixed air temp after mixing box" },
    M, M
  ),
  withLegacyArrays(
    { id: "sa-temp", emtAID: "60075", plnAID: "60075", name: "SA Temp Sensor", cat: "Temperature", unitMtl: 85, unitLbr: 0.75,
      showWhen: () => true, defaultWhen: () => true, desc: "Supply air temp in discharge duct" },
    A, A
  ),
  withLegacyArrays(
    { id: "ra-temp", emtAID: "60075", plnAID: "60075", name: "RA Temp Sensor", cat: "Temperature", unitMtl: 85, unitLbr: 0.75,
      showWhen: cfg => normalizeAhuCfg(cfg).ahuType !== "doas",
      defaultWhen: cfg => normalizeAhuCfg(cfg).ahuType !== "doas",
      desc: "Return air temp sensor" },
    ME, ME
  ),
  withLegacyArrays(
    { id: "ea-temp", emtAID: "60075", plnAID: "60075", name: "EA Temp Sensor", cat: "Temperature", unitMtl: 85, unitLbr: 0.75,
      showWhen: cfg => normalizeAhuCfg(cfg).heatRecoveryType !== "none",
      desc: "Exhaust air temp after energy recovery" },
    E, []
  ),
  withLegacyArrays(
    { id: "hw-sup-t", emtAID: "60076", plnAID: "60076", name: "HW Supply Temp", cat: "Temperature", unitMtl: 95, unitLbr: 1.0,
      showWhen: cfg => {
        const next = normalizeAhuCfg(cfg);
        return next.heatingType !== "none" || next.preheatType !== "none";
      },
      defaultWhen: cfg => {
        const next = normalizeAhuCfg(cfg);
        return next.heatingType !== "none" || next.preheatType !== "none";
      },
      desc: "HW supply temp at heating coil" },
    A, []
  ),
  withLegacyArrays(
    { id: "hw-ret-t", emtAID: "60076", plnAID: "60076", name: "HW Return Temp", cat: "Temperature", unitMtl: 95, unitLbr: 1.0,
      showWhen: cfg => {
        const next = normalizeAhuCfg(cfg);
        return next.heatingType !== "none" || next.preheatType !== "none";
      },
      defaultWhen: cfg => {
        const next = normalizeAhuCfg(cfg);
        return next.heatingType !== "none" || next.preheatType !== "none";
      },
      desc: "HW return temp at heating coil" },
    A, []
  ),
  withLegacyArrays(
    { id: "chw-sup-t", emtAID: "60076", plnAID: "60076", name: "CHW Supply Temp", cat: "Temperature", unitMtl: 95, unitLbr: 1.0,
      showWhen: cfg => normalizeAhuCfg(cfg).coolingType !== "none",
      defaultWhen: cfg => normalizeAhuCfg(cfg).coolingType !== "none",
      desc: "CHW supply temp at cooling coil" },
    A, []
  ),
  withLegacyArrays(
    { id: "chw-ret-t", emtAID: "60076", plnAID: "60076", name: "CHW Return Temp", cat: "Temperature", unitMtl: 95, unitLbr: 1.0,
      showWhen: cfg => normalizeAhuCfg(cfg).coolingType !== "none",
      defaultWhen: cfg => normalizeAhuCfg(cfg).coolingType !== "none",
      desc: "CHW return temp at cooling coil" },
    A, []
  ),
  withLegacyArrays(
    { id: "oa-rh", emtAID: "60066", plnAID: "60066", name: "OA Humidity", cat: "Humidity", unitMtl: 195, unitLbr: 1.0,
      showWhen: () => true, desc: "Outside air relative humidity" },
    A, []
  ),
  withLegacyArrays(
    { id: "sa-rh", emtAID: "60066", plnAID: "60066", name: "SA Humidity", cat: "Humidity", unitMtl: 185, unitLbr: 1.0,
      showWhen: () => true,
      defaultWhen: cfg => {
        const next = normalizeAhuCfg(cfg);
        return next.ahuType === "mixed" || next.ahuType === "doas";
      },
      desc: "Supply air humidity sensor" },
    A, ["mixed", "doas"]
  ),
  withLegacyArrays(
    { id: "ra-rh", emtAID: "60066", plnAID: "60066", name: "RA Humidity", cat: "Humidity", unitMtl: 185, unitLbr: 1.0,
      showWhen: cfg => normalizeAhuCfg(cfg).ahuType !== "doas",
      defaultWhen: cfg => normalizeAhuCfg(cfg).ahuType === "mixed",
      desc: "Return air humidity sensor" },
    ME, M
  ),
  withLegacyArrays(
    { id: "sa-static", emtAID: "60100", plnAID: "60100", name: "SA Static Pressure", cat: "Pressure", unitMtl: 220, unitLbr: 1.5,
      showWhen: () => true, defaultWhen: () => true, desc: "Supply duct static pressure" },
    A, A
  ),
  withLegacyArrays(
    { id: "ra-static", emtAID: "60100", plnAID: "60100", name: "RA Static Pressure", cat: "Pressure", unitMtl: 220, unitLbr: 1.5,
      showWhen: cfg => normalizeAhuCfg(cfg).ahuType !== "doas",
      defaultWhen: cfg => normalizeAhuCfg(cfg).ahuType === "mixed",
      desc: "Return duct static pressure" },
    ME, M
  ),
  withLegacyArrays(
    { id: "bldg-sp", emtAID: "60100", plnAID: "60100", name: "Building Static", cat: "Pressure", unitMtl: 245, unitLbr: 1.75,
      showWhen: () => true,
      defaultWhen: cfg => {
        const next = normalizeAhuCfg(cfg);
        return next.ahuType === "mixed" || next.ahuType === "doas";
      },
      desc: "Building static at exterior wall" },
    A, ["mixed", "doas"]
  ),
  withLegacyArrays(
    { id: "filter-dp", emtAID: "60059", plnAID: "60059", name: "Filter Diff. Pressure", cat: "Pressure", unitMtl: 220, unitLbr: 1.5,
      showWhen: () => true, defaultWhen: () => true, desc: "Differential pressure across filters" },
    A, A
  ),
  withLegacyArrays(
    { id: "oa-damper", emtAID: "60069", plnAID: "60069", name: "OA Damper Actuator", cat: "Actuators", unitMtl: 285, unitLbr: 2.0,
      showWhen: cfg => {
        const next = normalizeAhuCfg(cfg);
        return next.ahuType !== "doas" || next.economizer !== "none";
      },
      defaultWhen: cfg => normalizeAhuCfg(cfg).ahuType !== "doas",
      desc: "Outside air damper actuator" },
    ME, ME
  ),
  withLegacyArrays(
    { id: "ea-damper", emtAID: "60069", plnAID: "60069", name: "Exhaust Damper Act.", cat: "Actuators", unitMtl: 285, unitLbr: 2.0,
      showWhen: cfg => normalizeAhuCfg(cfg).ahuType !== "doas",
      defaultWhen: cfg => normalizeAhuCfg(cfg).ahuType !== "doas",
      desc: "Exhaust air damper actuator" },
    ME, ME
  ),
  withLegacyArrays(
    { id: "ra-damper", emtAID: "60069", plnAID: "60069", name: "RA Damper Actuator", cat: "Actuators", unitMtl: 285, unitLbr: 2.0,
      showWhen: cfg => normalizeAhuCfg(cfg).ahuType === "mixed",
      defaultWhen: cfg => normalizeAhuCfg(cfg).ahuType === "mixed",
      desc: "Return air damper actuator" },
    M, M
  ),
  withLegacyArrays(
    { id: "min-oa-d", emtAID: "60069", plnAID: "60069", name: "MIN OA Damper Act.", cat: "Actuators", unitMtl: 285, unitLbr: 2.0,
      showWhen: cfg => {
        const next = normalizeAhuCfg(cfg);
        return next.ahuType === "mixed" && next.economizer === "modulating";
      },
      desc: "Minimum OA separate blade actuator" },
    M, []
  ),
  withLegacyArrays(
    { id: "htg-valve", groupId: "ahu-htg-actuator", emtAID: "60077", plnAID: "60077", name: "Heating Valve Act.", cat: "Actuators", unitMtl: 315, unitLbr: 2.5,
      showWhen: cfg => normalizeAhuCfg(cfg).heatingType === "hw-prop",
      defaultWhen: cfg => normalizeAhuCfg(cfg).heatingType === "hw-prop",
      desc: "HW heating coil valve actuator" },
    A, A
  ),
  withLegacyArrays(
    { id: "clg-valve", groupId: "ahu-clg-actuator", emtAID: "60077", plnAID: "60077", name: "Cooling Valve Act.", cat: "Actuators", unitMtl: 315, unitLbr: 2.5,
      showWhen: cfg => normalizeAhuCfg(cfg).coolingType === "chw-prop",
      defaultWhen: cfg => normalizeAhuCfg(cfg).coolingType === "chw-prop",
      desc: "CHW cooling coil valve actuator" },
    A, A
  ),
  withLegacyArrays(
    { id: "ph-valve", groupId: "ahu-preheat-actuator", emtAID: "60077", plnAID: "60077", name: "Preheat Valve Act.", cat: "Actuators", unitMtl: 315, unitLbr: 2.5,
      showWhen: cfg => normalizeAhuCfg(cfg).preheatType === "hw-prop",
      defaultWhen: cfg => normalizeAhuCfg(cfg).preheatType === "hw-prop",
      desc: "HW preheat coil valve actuator" },
    A, ["doas", ...E]
  ),
  withLegacyArrays(
    { id: "elec-heat", groupId: "ahu-htg-actuator", emtAID: "60108", plnAID: "60040", name: "Electric Heat Stages", cat: "Actuators", unitMtl: 225, unitLbr: 2.0,
      showWhen: cfg => normalizeAhuCfg(cfg).heatingType === "electric-staged",
      desc: "Electric reheat staging control" },
    A, []
  ),
  withLegacyArrays(
    { id: "wheel-spd", emtAID: "60129", plnAID: "60129", name: "Wheel Speed Control", cat: "Actuators", unitMtl: 385, unitLbr: 2.0,
      showWhen: cfg => normalizeAhuCfg(cfg).heatRecoveryType === "wheel",
      defaultWhen: cfg => normalizeAhuCfg(cfg).heatRecoveryType === "wheel",
      desc: "Heat wheel VFD/speed controller" },
    ["erv-wheel"], ["erv-wheel"]
  ),
  withLegacyArrays(
    { id: "rac-pump", emtAID: "60131", plnAID: "60131", name: "Run-Around Pump Ctrl", cat: "Actuators", unitMtl: 285, unitLbr: 2.0,
      showWhen: cfg => normalizeAhuCfg(cfg).heatRecoveryType === "run-around",
      defaultWhen: cfg => normalizeAhuCfg(cfg).heatRecoveryType === "run-around",
      desc: "Run-around coil pump control" },
    ["erv-rac"], ["erv-rac"]
  ),
  withLegacyArrays(
    { id: "vfd-sf", groupId: "ahu-supply-fan", emtAID: "60129", plnAID: "60129", name: "Supply Fan VFD", cat: "Drives", unitMtl: 850, unitLbr: 4.0,
      showWhen: cfg => normalizeAhuCfg(cfg).supplyFanType === "variable",
      defaultWhen: cfg => normalizeAhuCfg(cfg).supplyFanType === "variable",
      desc: "VFD on supply fan(s)" },
    A, A
  ),
  withLegacyArrays(
    { id: "vfd-rf", groupId: "ahu-return-fan", emtAID: "60129", plnAID: "60129", name: "Return Fan VFD", cat: "Drives", unitMtl: 850, unitLbr: 4.0,
      showWhen: cfg => {
        const next = normalizeAhuCfg(cfg);
        return next.returnFanConfig !== "none" && next.returnFanType === "variable";
      },
      defaultWhen: cfg => {
        const next = normalizeAhuCfg(cfg);
        return next.returnFanConfig !== "none" && next.returnFanType === "variable";
      },
      desc: "VFD on return fan(s)" },
    ME, M
  ),
  withLegacyArrays(
    { id: "freeze", emtAID: "60056", plnAID: "60056", name: "Freezestat", cat: "Safety", unitMtl: 145, unitLbr: 1.5,
      showWhen: () => true, defaultWhen: () => true, desc: "Low-limit freeze protection stat" },
    A, A
  ),
  withLegacyArrays(
    { id: "smoke-sa", emtAID: "60122", plnAID: "60122", name: "Smoke Det. (Supply)", cat: "Safety", unitMtl: 185, unitLbr: 1.5,
      showWhen: () => true, defaultWhen: () => true, desc: "Duct smoke detector, supply stream" },
    A, A
  ),
  withLegacyArrays(
    { id: "smoke-ra", emtAID: "60122", plnAID: "60122", name: "Smoke Det. (Return)", cat: "Safety", unitMtl: 185, unitLbr: 1.5,
      showWhen: cfg => normalizeAhuCfg(cfg).ahuType !== "doas",
      defaultWhen: cfg => normalizeAhuCfg(cfg).ahuType !== "doas",
      desc: "Duct smoke detector, return stream" },
    ME, ME
  ),
  withLegacyArrays(
    { id: "ddc-panel", emtAID: "60087", plnAID: "60087", name: "DDC Control Panel", cat: "Controls", unitMtl: 1850, unitLbr: 8.0,
      showWhen: () => true, defaultWhen: () => true, desc: "Field DDC panel - BACnet MS/TP or IP" },
    A, A
  ),
  withLegacyArrays(
    { id: "uv-light", emtAID: "60123", plnAID: "60123", name: "UV Light Section", cat: "Controls", unitMtl: 485, unitLbr: 2.0,
      showWhen: () => true, desc: "UV-C germicidal section with I/O" },
    A, []
  ),
  withLegacyArrays(
    { id: "pwr-trunk", emtAID: "60135", plnAID: "60052", name: "24V Power Trunk", cat: "Controls", unitMtl: 285, unitLbr: 2.0,
      showWhen: () => true, defaultWhen: () => true, desc: "24VAC transformer + power trunk to DDC controllers", wire: "-" },
    A, A
  ),
  withLegacyArrays(
    { id: "homerun", emtAID: "60016", plnAID: "60016", name: "Home Run Conduit", cat: "Wiring", unitMtl: 185, unitLbr: 2.0,
      showWhen: () => true, defaultWhen: () => true, desc: "3/4\" EMT home run to main panel", wire: "-" },
    A, A
  ),
  withLegacyArrays(
    { id: "fab-damper", emtAID: "60069", plnAID: "60039", name: "Face and Bypass Damper", cat: "Actuators", unitMtl: 0, unitLbr: 0,
      showWhen: cfg => {
        const next = normalizeAhuCfg(cfg);
        return next.coolingType === "chw-2pos" || next.heatingType === "hw-2pos";
      },
      defaultWhen: cfg => {
        const next = normalizeAhuCfg(cfg);
        return next.coolingType === "chw-2pos" || next.heatingType === "hw-2pos";
      },
      desc: "Face and bypass damper actuator for 2-position coils" },
    [], []
  ),
  withLegacyArrays(
    { id: "clg-valve-2pos", groupId: "ahu-clg-actuator", emtAID: "60077", plnAID: "60077", name: "Cooling Valve Act. - Two-Position", cat: "Actuators", unitMtl: 0, unitLbr: 0,
      showWhen: cfg => normalizeAhuCfg(cfg).coolingType === "chw-2pos",
      defaultWhen: cfg => normalizeAhuCfg(cfg).coolingType === "chw-2pos",
      desc: "CHW cooling coil two-position valve actuator" },
    [], []
  ),
  withLegacyArrays(
    { id: "clg-dx-staged", emtAID: "60106", plnAID: "60106", name: "DX Cooling Stages", cat: "Actuators", unitMtl: 0, unitLbr: 0,
      showWhen: cfg => normalizeAhuCfg(cfg).coolingType === "dx-staged",
      desc: "DX cooling staging outputs" },
    [], []
  ),
  withLegacyArrays(
    { id: "htg-valve-2pos", groupId: "ahu-htg-actuator", emtAID: "60077", plnAID: "60077", name: "Heating Valve Act. - Two-Position", cat: "Actuators", unitMtl: 0, unitLbr: 0,
      showWhen: cfg => normalizeAhuCfg(cfg).heatingType === "hw-2pos",
      defaultWhen: cfg => normalizeAhuCfg(cfg).heatingType === "hw-2pos",
      desc: "HW heating coil two-position valve actuator" },
    [], []
  ),
  withLegacyArrays(
    { id: "htg-valve-incr", groupId: "ahu-htg-actuator", emtAID: "60147", plnAID: "60096", name: "Heating Valve Act. - Incremental", cat: "Actuators", unitMtl: 0, unitLbr: 0,
      showWhen: cfg => normalizeAhuCfg(cfg).heatingType === "hw-incr",
      defaultWhen: cfg => normalizeAhuCfg(cfg).heatingType === "hw-incr",
      desc: "HW heating coil incremental valve actuator" },
    [], []
  ),
  withLegacyArrays(
    { id: "htg-steam-valve", groupId: "ahu-htg-actuator", emtAID: "60077", plnAID: "60077", name: "Heating Steam Valve Act.", cat: "Actuators", unitMtl: 0, unitLbr: 0,
      showWhen: cfg => normalizeAhuCfg(cfg).heatingType === "steam-prop",
      defaultWhen: cfg => normalizeAhuCfg(cfg).heatingType === "steam-prop",
      desc: "Steam heating valve actuator" },
    [], []
  ),
  withLegacyArrays(
    { id: "ph-valve-2pos", groupId: "ahu-preheat-actuator", emtAID: "60077", plnAID: "60077", name: "Preheat Valve Act. - Two-Position", cat: "Actuators", unitMtl: 0, unitLbr: 0,
      showWhen: cfg => normalizeAhuCfg(cfg).preheatType === "hw-2pos",
      defaultWhen: cfg => normalizeAhuCfg(cfg).preheatType === "hw-2pos",
      desc: "HW preheat coil two-position valve actuator" },
    [], []
  ),
  withLegacyArrays(
    { id: "ph-steam-valve", groupId: "ahu-preheat-actuator", emtAID: "60077", plnAID: "60077", name: "Preheat Steam Valve Act.", cat: "Actuators", unitMtl: 0, unitLbr: 0,
      showWhen: cfg => normalizeAhuCfg(cfg).preheatType === "steam-prop",
      defaultWhen: cfg => normalizeAhuCfg(cfg).preheatType === "steam-prop",
      desc: "Steam preheat valve actuator" },
    [], []
  ),
  withLegacyArrays(
    { id: "rh-valve", groupId: "ahu-reheat-actuator", emtAID: "60077", plnAID: "60077", name: "Reheat Valve Act. - Proportional", cat: "Actuators", unitMtl: 0, unitLbr: 0,
      showWhen: cfg => normalizeAhuCfg(cfg).reheatType === "hw-prop",
      defaultWhen: cfg => normalizeAhuCfg(cfg).reheatType === "hw-prop",
      desc: "Downstream hot water reheat valve actuator" },
    [], []
  ),
  withLegacyArrays(
    { id: "rh-valve-2pos", groupId: "ahu-reheat-actuator", emtAID: "60077", plnAID: "60077", name: "Reheat Valve Act. - Two-Position", cat: "Actuators", unitMtl: 0, unitLbr: 0,
      showWhen: cfg => normalizeAhuCfg(cfg).reheatType === "hw-2pos",
      defaultWhen: cfg => normalizeAhuCfg(cfg).reheatType === "hw-2pos",
      desc: "Downstream two-position reheat valve actuator" },
    [], []
  ),
  withLegacyArrays(
    { id: "rh-valve-incr", groupId: "ahu-reheat-actuator", emtAID: "60147", plnAID: "60096", name: "Reheat Valve Act. - Incremental", cat: "Actuators", unitMtl: 0, unitLbr: 0,
      showWhen: cfg => normalizeAhuCfg(cfg).reheatType === "hw-incr",
      defaultWhen: cfg => normalizeAhuCfg(cfg).reheatType === "hw-incr",
      desc: "Downstream incremental reheat valve actuator" },
    [], []
  ),
  withLegacyArrays(
    { id: "rh-elec-heat", groupId: "ahu-reheat-actuator", emtAID: "60107", plnAID: "60107", name: "Reheat Electric Stages", cat: "Actuators", unitMtl: 0, unitLbr: 0,
      showWhen: cfg => normalizeAhuCfg(cfg).reheatType === "electric-staged",
      desc: "Downstream electric reheat staging outputs" },
    [], []
  ),
  withLegacyArrays(
    { id: "plate-bypass", emtAID: "60069", plnAID: "60039", name: "Plate HX Bypass Damper", cat: "Actuators", unitMtl: 0, unitLbr: 0,
      showWhen: cfg => normalizeAhuCfg(cfg).heatRecoveryType === "plate",
      desc: "Plate heat exchanger bypass damper actuator" },
    [], []
  ),
  withLegacyArrays(
    { id: "sf-starter", groupId: "ahu-supply-fan", emtAID: "60070", plnAID: "60070", name: "Supply Fan Starter", cat: "Drives", unitMtl: 0, unitLbr: 0,
      showWhen: cfg => normalizeAhuCfg(cfg).supplyFanType === "constant",
      defaultWhen: cfg => normalizeAhuCfg(cfg).supplyFanType === "constant",
      desc: "Constant-speed supply fan start/stop wiring" },
    [], []
  ),
  withLegacyArrays(
    { id: "rf-starter", groupId: "ahu-return-fan", emtAID: "60070", plnAID: "60070", name: "Return Fan Starter", cat: "Drives", unitMtl: 0, unitLbr: 0,
      showWhen: cfg => {
        const next = normalizeAhuCfg(cfg);
        return next.returnFanConfig !== "none" && next.returnFanType === "constant";
      },
      defaultWhen: cfg => {
        const next = normalizeAhuCfg(cfg);
        return next.returnFanConfig !== "none" && next.returnFanType === "constant";
      },
      desc: "Constant-speed return fan start/stop wiring" },
    [], []
  ),
];

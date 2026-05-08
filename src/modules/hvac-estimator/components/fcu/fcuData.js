export const FCU_FAN_TYPES = [
  { id: "single-speed", label: "Single Speed" },
  { id: "three-speed", label: "Three Speed" },
  { id: "variable-speed", label: "Variable Speed" },
  { id: "by-others", label: "By Others" },
];

export const FCU_COIL_TYPES = [
  { id: "none", label: "None" },
  { id: "staged-1", label: "Staged DX - 1" },
  { id: "staged-2", label: "Staged DX - 2" },
  { id: "staged-3", label: "Staged DX - 3" },
  { id: "hw-prop", label: "HW Valve - Proportional" },
  { id: "hw-incr", label: "HW Valve - Incremental" },
  { id: "hw-2pos", label: "HW Valve - Two-Position" },
];

export const FCU_COMMON_COIL_TYPES = [
  { id: "none", label: "None" },
  { id: "hw-prop", label: "Common Coil - Proportional" },
  { id: "hw-incr", label: "Common Coil - Incremental" },
  { id: "hw-2pos", label: "Common Coil - Two-Position" },
];

export const DEFAULT_FCU_CFG = {
  fanType: "single-speed",
  coolingType: "hw-prop",
  heatingType: "hw-prop",
  commonCoilType: "none",
};

export const FCU_STARTER_TEMPLATES = [
  {
    id: "fcu-2pipe",
    label: "FCU 2-Pipe",
    type: "fcu",
    cfg: {
      fanType: "single-speed",
      coolingType: "none",
      heatingType: "none",
      commonCoilType: "hw-prop",
    },
  },
  {
    id: "fcu-4pipe",
    label: "FCU 4-Pipe",
    type: "fcu",
    cfg: {
      fanType: "single-speed",
      coolingType: "hw-prop",
      heatingType: "hw-prop",
      commonCoilType: "none",
    },
  },
  {
    id: "fcu-4pipe-valves",
    label: "FCU 4-Pipe Valves",
    type: "fcu",
    cfg: {
      fanType: "single-speed",
      coolingType: "hw-prop",
      heatingType: "hw-prop",
      commonCoilType: "none",
    },
  },
];

export const getFcuStarterTemplate = (templateId) =>
  FCU_STARTER_TEMPLATES.find(template => template.id === templateId) || null;

export const applyFcuStarterTemplate = (cfg, templateId) => {
  const template = getFcuStarterTemplate(templateId);
  if (!template) return normalizeFcuCfg(cfg);
  return normalizeFcuCfg({ ...(cfg || {}), ...template.cfg });
};

export const getFcuConfigSummary = (cfg) => {
  const next = normalizeFcuCfg(cfg);
  const coolingLabel = next.commonCoilType !== "none"
    ? "Common Coil"
    : next.coolingType === "none"
      ? "Cooling Only"
      : labelFor(FCU_COIL_TYPES, next.coolingType);
  const heatingLabel = next.commonCoilType !== "none"
    ? labelFor(FCU_COMMON_COIL_TYPES, next.commonCoilType)
    : next.heatingType === "none"
      ? "No Heat"
      : labelFor(FCU_COIL_TYPES, next.heatingType);
  const fanLabel = labelFor(FCU_FAN_TYPES, next.fanType);

  return `${coolingLabel} | ${heatingLabel} | ${fanLabel}`;
};

const LEGACY_FAN_SPEED_TO_TYPE = {
  single: "single-speed",
  two: "three-speed",
  three: "three-speed",
};

const COIL_TYPE_TO_LEGACY_ACTUATOR = {
  "hw-incr": "incremental",
};

const STAGED_TYPES = new Set(["staged-1", "staged-2", "staged-3"]);
const VARIABLE_SPEED_BLOCKED_TYPES = new Set(["staged-1", "staged-2", "staged-3", "hw-2pos"]);
const VARIABLE_SPEED_BLOCKED_COMMON_TYPES = new Set(["hw-incr", "hw-2pos"]);

const stageQtyForType = (coilType) => {
  if (!STAGED_TYPES.has(coilType)) return 1;
  return Math.max(1, parseInt(String(coilType).replace("staged-", ""), 10) || 1);
};

const legacyActuatorToCoilType = (actuatorType = "proportional") =>
  actuatorType === "incremental" ? "hw-incr" : "hw-prop";

const syncLegacyAliases = (cfg) => {
  const next = { ...cfg };
  next.pipeType = next.commonCoilType !== "none" ? "twoPipe" : "fourPipe";
  next.fanSpeed = next.fanType === "single-speed" ? "single" : "three";

  const legacySource =
    next.commonCoilType !== "none"
      ? next.commonCoilType
      : next.coolingType !== "none"
        ? next.coolingType
        : next.heatingType;

  next.actuatorType = COIL_TYPE_TO_LEGACY_ACTUATOR[legacySource] || "proportional";
  return next;
};

function labelFor(options, id) {
  return options.find(option => option.id === id)?.label || id;
}

export const normalizeFcuCfg = (cfg) => {
  const next = { ...DEFAULT_FCU_CFG, ...(cfg || {}) };

  if (!cfg?.fanType && cfg?.fanSpeed) {
    next.fanType = LEGACY_FAN_SPEED_TO_TYPE[cfg.fanSpeed] || DEFAULT_FCU_CFG.fanType;
  }

  if (!cfg?.coolingType && !cfg?.heatingType && !cfg?.commonCoilType && cfg?.pipeType) {
    const legacyCoilType = legacyActuatorToCoilType(cfg.actuatorType);
    if (cfg.pipeType === "twoPipe") {
      next.coolingType = "none";
      next.heatingType = "none";
      next.commonCoilType = legacyCoilType;
    } else {
      next.coolingType = legacyCoilType;
      next.heatingType = legacyCoilType;
      next.commonCoilType = "none";
    }
  }

  if (next.commonCoilType !== "none") {
    next.coolingType = "none";
    next.heatingType = "none";
  }

  if (next.fanType === "variable-speed") {
    if (VARIABLE_SPEED_BLOCKED_TYPES.has(next.coolingType)) next.coolingType = "none";
    if (VARIABLE_SPEED_BLOCKED_TYPES.has(next.heatingType)) next.heatingType = "none";
    if (VARIABLE_SPEED_BLOCKED_COMMON_TYPES.has(next.commonCoilType)) next.commonCoilType = "none";
  }

  return syncLegacyAliases(next);
};

export const FCU_COMPONENT_GROUPS = [
  {
    groupId: "fcu-controller",
    label: "FCU Controller Type",
    groupMode: "exclusive",
    required: true,
  },
  {
    groupId: "fcu-cooling-actuator",
    label: "Cooling Coil Actuator Type",
    groupMode: "exclusive",
    required: false,
  },
  {
    groupId: "fcu-heating-actuator",
    label: "Heating Coil Actuator Type",
    groupMode: "exclusive",
    required: false,
  },
  {
    groupId: "fcu-common-coil-actuator",
    label: "Common Coil Actuator Type",
    groupMode: "exclusive",
    required: false,
  },
];

export const getFcuGroup = (groupId, groups = FCU_COMPONENT_GROUPS) =>
  groups.find(group => group.groupId === groupId) || null;

const isExclusiveFcuGroup = (group) => group?.groupMode === "exclusive";

const getSelectionQty = (comp, cfg, existingQty = 1) => {
  if (!comp?.qtyForCfg) return Math.max(1, existingQty || 1);
  return Math.max(1, comp.qtyForCfg(normalizeFcuCfg(cfg)) || 1);
};

export const isFcuComponentVisible = (comp, cfg) =>
  comp.showWhen ? comp.showWhen(normalizeFcuCfg(cfg)) : true;

export const getVisibleFcuComponents = (cfg, comps = FCU_COMPS) =>
  comps.filter(comp => isFcuComponentVisible(comp, cfg));

const hasGroupSelection = (selected, groupId, comps) =>
  selected.some(entry => comps.some(comp => comp.id === entry.id && comp.groupId === groupId));

export const applyFcuDefaultSelections = (selected, cfg, options = {}) => {
  const normalizedCfg = normalizeFcuCfg(cfg);
  const comps = options.components || FCU_COMPS;
  const groups = options.groups || FCU_COMPONENT_GROUPS;
  const blockedIds = new Set(options.blockedIds || []);
  const next = [...selected];
  const selectedIds = new Set(next.map(entry => entry.id));

  for (const comp of comps) {
    if (!comp.defaultWhen || !comp.defaultWhen(normalizedCfg) || blockedIds.has(comp.id) || selectedIds.has(comp.id)) {
      continue;
    }

    if (comp.groupId) {
      const group = getFcuGroup(comp.groupId, groups);
      if (isExclusiveFcuGroup(group) && hasGroupSelection(next, comp.groupId, comps)) {
        continue;
      }
    }

    next.push({ id: comp.id, qty: getSelectionQty(comp, normalizedCfg) });
    selectedIds.add(comp.id);
  }

  return next;
};

export const reconcileFcuSelected = (selected, cfg, options = {}) => {
  const normalizedCfg = normalizeFcuCfg(cfg);
  const comps = options.components || FCU_COMPS;
  const groups = options.groups || FCU_COMPONENT_GROUPS;
  const visibleComponents = getVisibleFcuComponents(normalizedCfg, comps);
  const visibleIds = new Set(visibleComponents.map(comp => comp.id));
  const compById = new Map(comps.map(comp => [comp.id, comp]));
  const takenExclusiveGroups = new Set();
  const next = [];

  for (const entry of selected || []) {
    if (!visibleIds.has(entry.id)) continue;
    const comp = compById.get(entry.id);
    if (!comp?.groupId) {
      next.push({ ...entry, qty: getSelectionQty(comp, normalizedCfg, entry.qty) });
      continue;
    }

    const group = getFcuGroup(comp.groupId, groups);
    if (isExclusiveFcuGroup(group)) {
      if (takenExclusiveGroups.has(comp.groupId)) continue;
      takenExclusiveGroups.add(comp.groupId);
    }

    next.push({ ...entry, qty: getSelectionQty(comp, normalizedCfg, entry.qty) });
  }

  return applyFcuDefaultSelections(next, normalizedCfg, {
    blockedIds: options.blockedIds,
    components: visibleComponents,
    groups,
  });
};

export const toggleFcuComponentSelection = (selected, componentId, options = {}) => {
  const normalizedCfg = normalizeFcuCfg(options.cfg);
  const comps = options.components || FCU_COMPS;
  const groups = options.groups || FCU_COMPONENT_GROUPS;
  const comp = comps.find(entry => entry.id === componentId);

  if (!comp) return selected;

  const isSelected = selected.some(entry => entry.id === componentId);
  if (!comp.groupId) {
    return isSelected
      ? selected.filter(entry => entry.id !== componentId)
      : [...selected, { id: componentId, qty: getSelectionQty(comp, normalizedCfg) }];
  }

  const group = getFcuGroup(comp.groupId, groups);
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
    { id: componentId, qty: getSelectionQty(comp, normalizedCfg) },
  ];
};

export const FCU_COMPS = [
  { id: "fcu-ctrl", groupId: "fcu-controller", emtAID: "60090", plnAID: "60034", name: "FCU Controller", cat: "Controls", def: false,
    defaultWhen: () => true, desc: "DDC fan coil controller" },
  { id: "fcu-tec", groupId: "fcu-controller", emtAID: "60119", plnAID: "60119", name: "FCU Stat Controller", cat: "Controls", def: false,
    desc: "Thermostat combo stat controller (TEC)" },
  { id: "fcu-chw-vlv", groupId: "fcu-cooling-actuator", emtAID: "60077", plnAID: "60077", name: "CHW Valve - Proportional", cat: "Actuators", def: false,
    showWhen: cfg => normalizeFcuCfg(cfg).coolingType === "hw-prop",
    defaultWhen: cfg => normalizeFcuCfg(cfg).coolingType === "hw-prop",
    desc: "Chilled water 2-way proportional valve actuator" },
  { id: "fcu-chw-vlv-incr", groupId: "fcu-cooling-actuator", emtAID: "60147", plnAID: "60096", name: "CHW Valve - Incremental", cat: "Actuators", def: false,
    showWhen: cfg => normalizeFcuCfg(cfg).coolingType === "hw-incr",
    defaultWhen: cfg => normalizeFcuCfg(cfg).coolingType === "hw-incr",
    desc: "Chilled water incremental valve actuator" },
  { id: "fcu-chw-vlv-2pos", groupId: "fcu-cooling-actuator", emtAID: "60077", plnAID: "60077", name: "CHW Valve - Two-Position", cat: "Actuators", def: false,
    showWhen: cfg => normalizeFcuCfg(cfg).coolingType === "hw-2pos",
    defaultWhen: cfg => normalizeFcuCfg(cfg).coolingType === "hw-2pos",
    desc: "Chilled water two-position valve actuator" },
  { id: "fcu-clg-staged", emtAID: "60106", plnAID: "60106", name: "Staged Cooling Output(s)", cat: "Actuators", def: false,
    qtyForCfg: cfg => stageQtyForType(normalizeFcuCfg(cfg).coolingType),
    showWhen: cfg => STAGED_TYPES.has(normalizeFcuCfg(cfg).coolingType),
    defaultWhen: cfg => STAGED_TYPES.has(normalizeFcuCfg(cfg).coolingType),
    desc: "Cooling stages driven from FCU controller outputs" },
  { id: "fcu-hw-vlv", groupId: "fcu-heating-actuator", emtAID: "60077", plnAID: "60077", name: "HW Valve - Proportional", cat: "Actuators", def: false,
    showWhen: cfg => normalizeFcuCfg(cfg).heatingType === "hw-prop",
    defaultWhen: cfg => normalizeFcuCfg(cfg).heatingType === "hw-prop",
    desc: "Hot water proportional heating valve actuator" },
  { id: "fcu-hw-vlv-incr", groupId: "fcu-heating-actuator", emtAID: "60147", plnAID: "60096", name: "HW Valve - Incremental", cat: "Actuators", def: false,
    showWhen: cfg => normalizeFcuCfg(cfg).heatingType === "hw-incr",
    defaultWhen: cfg => normalizeFcuCfg(cfg).heatingType === "hw-incr",
    desc: "Hot water incremental heating valve actuator" },
  { id: "fcu-hw-vlv-2pos", groupId: "fcu-heating-actuator", emtAID: "60077", plnAID: "60077", name: "HW Valve - Two-Position", cat: "Actuators", def: false,
    showWhen: cfg => normalizeFcuCfg(cfg).heatingType === "hw-2pos",
    defaultWhen: cfg => normalizeFcuCfg(cfg).heatingType === "hw-2pos",
    desc: "Hot water two-position heating valve actuator" },
  { id: "fcu-htg-staged", emtAID: "60107", plnAID: "60107", name: "Staged Heating Output(s)", cat: "Actuators", def: false,
    qtyForCfg: cfg => stageQtyForType(normalizeFcuCfg(cfg).heatingType),
    showWhen: cfg => STAGED_TYPES.has(normalizeFcuCfg(cfg).heatingType),
    defaultWhen: cfg => STAGED_TYPES.has(normalizeFcuCfg(cfg).heatingType),
    desc: "Heating stages driven from FCU controller outputs" },
  { id: "fcu-cmn-vlv-prop", groupId: "fcu-common-coil-actuator", emtAID: "60077", plnAID: "60077", name: "Common Coil Valve - Proportional", cat: "Actuators", def: false,
    showWhen: cfg => normalizeFcuCfg(cfg).commonCoilType === "hw-prop",
    defaultWhen: cfg => normalizeFcuCfg(cfg).commonCoilType === "hw-prop",
    desc: "2-pipe common coil proportional valve actuator" },
  { id: "fcu-cmn-vlv-incr", groupId: "fcu-common-coil-actuator", emtAID: "60147", plnAID: "60096", name: "Common Coil Valve - Incremental", cat: "Actuators", def: false,
    showWhen: cfg => normalizeFcuCfg(cfg).commonCoilType === "hw-incr",
    defaultWhen: cfg => normalizeFcuCfg(cfg).commonCoilType === "hw-incr",
    desc: "2-pipe common coil incremental valve actuator" },
  { id: "fcu-cmn-vlv-2pos", groupId: "fcu-common-coil-actuator", emtAID: "60077", plnAID: "60077", name: "Common Coil Valve - Two-Position", cat: "Actuators", def: false,
    showWhen: cfg => normalizeFcuCfg(cfg).commonCoilType === "hw-2pos",
    defaultWhen: cfg => normalizeFcuCfg(cfg).commonCoilType === "hw-2pos",
    desc: "2-pipe common coil two-position valve actuator" },
  { id: "fcu-rm-t", emtAID: "60082", plnAID: "60032", name: "Room Temp Sensor", cat: "Temperature", def: false,
    defaultWhen: () => true, desc: "Wall-mount room temp sensor" },
  { id: "fcu-da-t", emtAID: "60073", plnAID: "60037", name: "Discharge Air Temp", cat: "Temperature", def: false,
    defaultWhen: () => true, desc: "Discharge air temp after coil" },
  { id: "fcu-filter", emtAID: "60059", plnAID: "60059", name: "Filter DP Switch", cat: "Pressure", def: false,
    defaultWhen: () => true, desc: "Differential pressure switch across FCU filter" },
  { id: "fcu-fan-cs", emtAID: "60061", plnAID: "60061", name: "Fan Current Switch", cat: "Safety", def: false,
    showWhen: cfg => normalizeFcuCfg(cfg).fanType !== "by-others",
    desc: "Current switch for fan proof of operation" },
  { id: "fcu-fan-spd-adj", emtAID: "60129", plnAID: "60129", name: "Fan Speed Adjust", cat: "Controls", def: false,
    showWhen: cfg => normalizeFcuCfg(cfg).fanType === "three-speed",
    desc: "3-speed fan adjustment point" },
  { id: "fcu-rh", emtAID: "60066", plnAID: "60066", name: "Room Humidity", cat: "Humidity", def: false,
    desc: "Wall-mount room humidity sensor" },
  { id: "fcu-ddc", emtAID: "60087", plnAID: "60087", name: "DDC Control Panel", cat: "Controls", def: false,
    desc: "Field DDC panel - BACnet" },
  { id: "fcu-pwr-trunk", emtAID: "60135", plnAID: "60052", name: "24V Power Trunk", cat: "Controls", def: false,
    defaultWhen: () => true, desc: "24VAC transformer + power trunk to DDC controllers", wire: "-" },
  { id: "fcu-homerun", emtAID: "60016", plnAID: "60016", name: "Home Run Conduit", cat: "Wiring", def: false,
    defaultWhen: () => true, desc: "EMT home run to main panel", wire: "-" },
  { id: "fcu-condensate", emtAID: "60070", plnAID: "60070", name: "Condensate Alarm", cat: "Safety", def: false,
    showWhen: cfg => {
      const next = normalizeFcuCfg(cfg);
      return next.coolingType !== "none" || next.commonCoilType !== "none";
    },
    desc: "Condensate alarm input" },
  { id: "fcu-sw-switch", emtAID: "60070", plnAID: "60070", name: "Summer-Winter Switch", cat: "Controls", def: false,
    showWhen: cfg => normalizeFcuCfg(cfg).commonCoilType !== "none",
    desc: "2-pipe summer/winter changeover switch" },
  { id: "fcu-lighting-rly", emtAID: "60070", plnAID: "60070", name: "Lighting Relay", cat: "Controls", def: false,
    desc: "Lighting relay / occupied input interface" },
  { id: "fcu-occ-sensor", emtAID: "60082", plnAID: "60032", name: "Zone Occupancy Sensor", cat: "Controls", def: false,
    desc: "Occupancy input for scheduled control sequences" },
  { id: "fcu-unit-enable", emtAID: "60070", plnAID: "60070", name: "Unit Enable Switch", cat: "Controls", def: false,
    desc: "Network unit enable input" },
  { id: "fcu-energy-ho", emtAID: "60070", plnAID: "60070", name: "Energy Hold-Off Switch", cat: "Controls", def: false,
    desc: "Network energy hold-off input" },
  { id: "fcu-smoke", emtAID: "60122", plnAID: "60122", name: "Discharge Air Smoke Detector", cat: "Safety", def: false,
    desc: "Discharge air smoke interlock" },
];

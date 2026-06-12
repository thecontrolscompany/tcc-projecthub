export const RTU_COOLING_TYPES = [
  { id: "none", label: "None" },
  { id: "dx-2stage", label: "DX 2-Stage" },
  { id: "dx-4stage", label: "DX 4-Stage" },
];

export const RTU_HEATING_TYPES = [
  { id: "none", label: "None" },
  { id: "electric-2stage", label: "Electric 2-Stage" },
  { id: "electric-3stage", label: "Electric 3-Stage" },
  { id: "hw-valve", label: "HW Valve" },
];

export const DEFAULT_RTU_CFG = {
  coolingType: "dx-4stage",
  heatingType: "electric-3stage",
  returnFan: false,
};

export const normalizeRtuCfg = (cfg) => {
  const next = { ...DEFAULT_RTU_CFG, ...(cfg || {}) };
  return next;
};

export const RTU_COMPONENT_GROUPS = [
  {
    groupId: "rtu-cooling-stage",
    label: "DX Cooling Stage",
    groupMode: "exclusive",
    required: false,
  },
  {
    groupId: "rtu-heating-type",
    label: "Heating Type",
    groupMode: "exclusive",
    required: false,
  },
];

export const getRtuGroup = (groupId, groups = RTU_COMPONENT_GROUPS) =>
  groups.find(group => group.groupId === groupId) || null;

const isExclusiveRtuGroup = group => group?.groupMode === "exclusive";

const hasGroupSelection = (selected, groupId, comps) =>
  selected.some(entry => comps.some(comp => comp.id === entry.id && comp.groupId === groupId));

const getSelectionQty = (comp, existingQty = 1) => Math.max(1, existingQty || 1);

export const isRtuComponentVisible = (comp, cfg) =>
  comp.showWhen ? comp.showWhen(normalizeRtuCfg(cfg)) : true;

export const getVisibleRtuComponents = (cfg, comps = RTU_COMPS) =>
  comps.filter(comp => isRtuComponentVisible(comp, cfg));

export const applyRtuDefaultSelections = (selected, cfg, options = {}) => {
  const normalizedCfg = normalizeRtuCfg(cfg);
  const comps = options.components || RTU_COMPS;
  const groups = options.groups || RTU_COMPONENT_GROUPS;
  const next = [...selected];
  const selectedIds = new Set(next.map(entry => entry.id));

  for (const comp of comps) {
    if (!comp.defaultWhen || !comp.defaultWhen(normalizedCfg) || selectedIds.has(comp.id)) {
      continue;
    }

    if (comp.groupId) {
      const group = getRtuGroup(comp.groupId, groups);
      if (isExclusiveRtuGroup(group) && hasGroupSelection(next, comp.groupId, comps)) {
        continue;
      }
    }

    next.push({ id: comp.id, qty: getSelectionQty(comp) });
    selectedIds.add(comp.id);
  }

  return next;
};

export const reconcileRtuSelected = (selected, cfg, options = {}) => {
  const normalizedCfg = normalizeRtuCfg(cfg);
  const comps = options.components || RTU_COMPS;
  const groups = options.groups || RTU_COMPONENT_GROUPS;
  const visibleComponents = getVisibleRtuComponents(normalizedCfg, comps);
  const visibleIds = new Set(visibleComponents.map(comp => comp.id));
  const compById = new Map(comps.map(comp => [comp.id, comp]));
  const takenExclusiveGroups = new Set();
  const next = [];

  for (const entry of selected || []) {
    if (!visibleIds.has(entry.id)) continue;
    const comp = compById.get(entry.id);
    if (!comp?.groupId) {
      next.push({ ...entry, qty: getSelectionQty(comp, entry.qty) });
      continue;
    }

    const group = getRtuGroup(comp.groupId, groups);
    if (isExclusiveRtuGroup(group)) {
      if (takenExclusiveGroups.has(comp.groupId)) continue;
      takenExclusiveGroups.add(comp.groupId);
    }

    next.push({ ...entry, qty: getSelectionQty(comp, entry.qty) });
  }

  return applyRtuDefaultSelections(next, normalizedCfg, {
    components: visibleComponents,
    groups,
  });
};

export const toggleRtuComponentSelection = (selected, componentId, options = {}) => {
  const comps = options.components || RTU_COMPS;
  const groups = options.groups || RTU_COMPONENT_GROUPS;
  const comp = comps.find(entry => entry.id === componentId);

  if (!comp) return selected;

  const isSelected = selected.some(entry => entry.id === componentId);
  if (!comp.groupId) {
    return isSelected
      ? selected.filter(entry => entry.id !== componentId)
      : [...selected, { id: componentId, qty: getSelectionQty(comp) }];
  }

  const group = getRtuGroup(comp.groupId, groups);
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
    { id: componentId, qty: getSelectionQty(comp) },
  ];
};

export const RTU_COMPS = [
  // Temperature
  { id:"rtu-oa-t",    emtAID:"60102", plnAID:"60102", name:"OA Temp Sensor",        cat:"Temperature", controlsId: "CTL-DEV-TEMP-DUCT", def:true,  defaultWhen: () => true, desc:"Outside air temp at intake" },
  { id:"rtu-ma-t",    emtAID:"60094", plnAID:"60094", name:"Mixed Air Temp",         cat:"Temperature", controlsId: "CTL-DEV-TEMP-DUCT", def:true,  defaultWhen: () => true, desc:"Mixed air sensor after mixing section" },
  { id:"rtu-sa-t",    emtAID:"60073", plnAID:"60073", name:"Supply Air Temp",        cat:"Temperature", controlsId: "CTL-DEV-TEMP-DUCT", def:true,  defaultWhen: () => true, desc:"Discharge air temp sensor" },
  // Cooling
  { id:"rtu-dx2",     groupId:"rtu-cooling-stage", emtAID:"60106", plnAID:"60106", name:"DX Cooling 2-Stage",     cat:"Controls", controlsId: "CTL-DEV-STAGE-RELAY",    def:false, showWhen: cfg => normalizeRtuCfg(cfg).coolingType === "dx-2stage", defaultWhen: cfg => normalizeRtuCfg(cfg).coolingType === "dx-2stage", desc:"2-stage DX cooling relay outputs" },
  { id:"rtu-dx4",     groupId:"rtu-cooling-stage", emtAID:"60105", plnAID:"60105", name:"DX Cooling 4-Stage",     cat:"Controls", controlsId: "CTL-DEV-STAGE-RELAY",    def:true,  showWhen: cfg => normalizeRtuCfg(cfg).coolingType === "dx-4stage", defaultWhen: cfg => normalizeRtuCfg(cfg).coolingType === "dx-4stage", desc:"4-stage DX cooling relay outputs" },
  { id:"rtu-cond",    emtAID:"60103", plnAID:"60103", name:"Condensing Unit I/O",    cat:"Controls", controlsId: null,    def:true,  showWhen: cfg => normalizeRtuCfg(cfg).coolingType !== "none", defaultWhen: cfg => normalizeRtuCfg(cfg).coolingType !== "none", desc:"Condensing unit start/stop/status" },
  // Heating
  { id:"rtu-htg2",    groupId:"rtu-heating-type", emtAID:"60109", plnAID:"60109", name:"Electric Heat 2-Stage",  cat:"Actuators", controlsId: "CTL-DEV-STAGE-RELAY",   def:false, showWhen: cfg => normalizeRtuCfg(cfg).heatingType === "electric-2stage", defaultWhen: cfg => normalizeRtuCfg(cfg).heatingType === "electric-2stage", desc:"2-stage electric heat relay" },
  { id:"rtu-htg3",    groupId:"rtu-heating-type", emtAID:"60107", plnAID:"60107", name:"Electric Heat 3-Stage",  cat:"Actuators", controlsId: "CTL-DEV-STAGE-RELAY",   def:true,  showWhen: cfg => normalizeRtuCfg(cfg).heatingType === "electric-3stage", defaultWhen: cfg => normalizeRtuCfg(cfg).heatingType === "electric-3stage", desc:"3-stage electric heat relay" },
  { id:"rtu-hw-vlv",  groupId:"rtu-heating-type", emtAID:"60077", plnAID:"60077", name:"HW Heating Valve",       cat:"Actuators", controlsId: "CTL-DEV-ACT-VALVE-MOD",   def:false, showWhen: cfg => normalizeRtuCfg(cfg).heatingType === "hw-valve", defaultWhen: cfg => normalizeRtuCfg(cfg).heatingType === "hw-valve", desc:"Hot water heating valve actuator" },
  // Dampers / Economizer
  { id:"rtu-oa-d",    emtAID:"60069", plnAID:"60069", name:"OA Damper Actuator",     cat:"Actuators", controlsId: "CTL-DEV-ACT-DAMPER-2POS",   def:true,  defaultWhen: () => true, desc:"Economizer OA damper actuator" },
  { id:"rtu-filter",  emtAID:"60059", plnAID:"60059", name:"Filter DP Switch",       cat:"Pressure", controlsId: "CTL-DEV-PRESS-FILTER",    def:true,  defaultWhen: () => true, desc:"Differential pressure across filter" },
  // Fan / Drive
  { id:"rtu-vfd-sf",  emtAID:"60129", plnAID:"60129", name:"Supply Fan VFD",         cat:"Drives", controlsId: "CTL-DEV-VFD-INTERFACE",      def:true,  defaultWhen: () => true, desc:"VFD on supply fan" },
  { id:"rtu-vfd-rf",  emtAID:"60129", plnAID:"60129", name:"Return Fan VFD",         cat:"Drives", controlsId: "CTL-DEV-VFD-INTERFACE",      def:false, showWhen: cfg => normalizeRtuCfg(cfg).returnFan === true, desc:"VFD on return fan" },
  { id:"rtu-sa-sp",   emtAID:"60100", plnAID:"60100", name:"SA Static Pressure",     cat:"Pressure", controlsId: "CTL-DEV-PRESS-DUCT",    def:true,  defaultWhen: () => true, desc:"Supply duct static pressure" },
  // Safety
  { id:"rtu-freeze",  emtAID:"60056", plnAID:"60056", name:"Freezestat",             cat:"Safety", controlsId: "CTL-DEV-FREEZESTAT",      def:true,  defaultWhen: () => true, desc:"Low-limit freeze protection" },
  { id:"rtu-smoke",   emtAID:"60122", plnAID:"60122", name:"Smoke Detector",         cat:"Safety", controlsId: "CTL-DEV-SMOKE",      def:true,  defaultWhen: () => true, desc:"Duct smoke detector" },
  // Controls
  { id:"rtu-ddc",     emtAID:"60087", plnAID:"60087", name:"DDC Control Panel",      cat:"Controls", controlsId: null,    def:true,  defaultWhen: () => true, desc:"Field DDC panel - BACnet" },
  { id:"rtu-pwr-trunk", emtAID:"60135", plnAID:"60052", name:"24V Power Trunk",       cat:"Controls", controlsId: null,    def:false, desc:"24VAC transformer + power trunk to DDC controllers", wire:"-" },
  { id:"rtu-homerun",   emtAID:"60016", plnAID:"60016", name:"Home Run Conduit",       cat:"Wiring", controlsId: null,      def:true,  defaultWhen: () => true, desc:"EMT home run to main panel", wire:"-" },
];


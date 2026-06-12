export const UH_HEATING_TYPES = [
  { id: "hw-valve", label: "HW Valve" },
  { id: "electric-2stage", label: "Electric 2-Stage" },
  { id: "electric-3stage", label: "Electric 3-Stage" },
];

export const DEFAULT_UH_CFG = {
  heatingType: "hw-valve",
};

export const normalizeUhCfg = (cfg) => ({
  ...DEFAULT_UH_CFG,
  ...(cfg || {}),
});

export const UH_COMPONENT_GROUPS = [
  {
    groupId: "uh-heating-type",
    label: "Heating Type",
    groupMode: "exclusive",
    required: true,
  },
];

export const getUhGroup = (groupId, groups = UH_COMPONENT_GROUPS) =>
  groups.find(group => group.groupId === groupId) || null;

const isExclusiveUhGroup = group => group?.groupMode === "exclusive";

const hasGroupSelection = (selected, groupId, comps) =>
  selected.some(entry => comps.some(comp => comp.id === entry.id && comp.groupId === groupId));

const getSelectionQty = (comp, existingQty = 1) => Math.max(1, existingQty || 1);

export const isUhComponentVisible = (comp, cfg) =>
  comp.showWhen ? comp.showWhen(normalizeUhCfg(cfg)) : true;

export const getVisibleUhComponents = (cfg, comps = UH_COMPS) =>
  comps.filter(comp => isUhComponentVisible(comp, cfg));

export const applyUhDefaultSelections = (selected, cfg, options = {}) => {
  const normalizedCfg = normalizeUhCfg(cfg);
  const comps = options.components || UH_COMPS;
  const groups = options.groups || UH_COMPONENT_GROUPS;
  const next = [...selected];
  const selectedIds = new Set(next.map(entry => entry.id));

  for (const comp of comps) {
    if (!comp.defaultWhen || !comp.defaultWhen(normalizedCfg) || selectedIds.has(comp.id)) {
      continue;
    }

    if (comp.groupId) {
      const group = getUhGroup(comp.groupId, groups);
      if (isExclusiveUhGroup(group) && hasGroupSelection(next, comp.groupId, comps)) {
        continue;
      }
    }

    next.push({ id: comp.id, qty: getSelectionQty(comp) });
    selectedIds.add(comp.id);
  }

  return next;
};

export const reconcileUhSelected = (selected, cfg, options = {}) => {
  const normalizedCfg = normalizeUhCfg(cfg);
  const comps = options.components || UH_COMPS;
  const groups = options.groups || UH_COMPONENT_GROUPS;
  const visibleComponents = getVisibleUhComponents(normalizedCfg, comps);
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

    const group = getUhGroup(comp.groupId, groups);
    if (isExclusiveUhGroup(group)) {
      if (takenExclusiveGroups.has(comp.groupId)) continue;
      takenExclusiveGroups.add(comp.groupId);
    }

    next.push({ ...entry, qty: getSelectionQty(comp, entry.qty) });
  }

  return applyUhDefaultSelections(next, normalizedCfg, {
    components: visibleComponents,
    groups,
  });
};

export const toggleUhComponentSelection = (selected, componentId, options = {}) => {
  const comps = options.components || UH_COMPS;
  const groups = options.groups || UH_COMPONENT_GROUPS;
  const comp = comps.find(entry => entry.id === componentId);

  if (!comp) return selected;

  const isSelected = selected.some(entry => entry.id === componentId);
  if (!comp.groupId) {
    return isSelected
      ? selected.filter(entry => entry.id !== componentId)
      : [...selected, { id: componentId, qty: getSelectionQty(comp) }];
  }

  const group = getUhGroup(comp.groupId, groups);
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

export const UH_COMPS = [
  // Controls
  { id:"uh-ctrl",     emtAID:"60087", plnAID:"60087", name:"DDC Control Panel",      cat:"Controls", controlsId: null,    def:true,  defaultWhen: () => true, desc:"Field DDC panel - BACnet" },
  // Heating
  { id:"uh-hw-vlv",   groupId:"uh-heating-type", emtAID:"60077", plnAID:"60077", name:"HW Valve Actuator",      cat:"Actuators", controlsId: "CTL-DEV-ACT-VALVE-MOD",   def:true,  showWhen: cfg => normalizeUhCfg(cfg).heatingType === "hw-valve", defaultWhen: cfg => normalizeUhCfg(cfg).heatingType === "hw-valve", desc:"Hot water valve actuator" },
  { id:"uh-htg2",     groupId:"uh-heating-type", emtAID:"60109", plnAID:"60109", name:"Electric Heat 2-Stage",  cat:"Actuators", controlsId: "CTL-DEV-STAGE-RELAY",   def:false, showWhen: cfg => normalizeUhCfg(cfg).heatingType === "electric-2stage", defaultWhen: cfg => normalizeUhCfg(cfg).heatingType === "electric-2stage", desc:"2-stage electric heat relay" },
  { id:"uh-htg3",     groupId:"uh-heating-type", emtAID:"60107", plnAID:"60107", name:"Electric Heat 3-Stage",  cat:"Actuators", controlsId: "CTL-DEV-STAGE-RELAY",   def:false, showWhen: cfg => normalizeUhCfg(cfg).heatingType === "electric-3stage", defaultWhen: cfg => normalizeUhCfg(cfg).heatingType === "electric-3stage", desc:"3-stage electric heat relay" },
  // Fan Status
  { id:"uh-fan-cs",   emtAID:"60061", plnAID:"60061", name:"Fan Current Switch",     cat:"Safety", controlsId: "CTL-DEV-FAN-STATUS",      def:true,  defaultWhen: () => true, desc:"Current switch for fan proof" },
  // Temperature
  { id:"uh-sp-t",     emtAID:"60076", plnAID:"60076", name:"HW Supply Temp",         cat:"Temperature", controlsId: "CTL-DEV-TEMP-PIPE", def:false, showWhen: cfg => normalizeUhCfg(cfg).heatingType === "hw-valve", desc:"Hot water supply temp sensor" },
  { id:"uh-rm-t",     emtAID:"60082", plnAID:"60032", name:"Room Temp Sensor",       cat:"Temperature", controlsId: "CTL-DEV-TEMP-SPACE", def:true,  defaultWhen: () => true, desc:"Wall-mount room temp sensor" },
  // Wiring
  { id:"uh-pwr-trunk", emtAID:"60135", plnAID:"60052", name:"24V Power Trunk",       cat:"Controls", controlsId: null,    def:false, desc:"24VAC transformer + power trunk to DDC controllers", wire:"-" },
  { id:"uh-homerun",   emtAID:"60016", plnAID:"60016", name:"Home Run Conduit",       cat:"Wiring", controlsId: null,      def:true,  defaultWhen: () => true, desc:"EMT home run to main panel", wire:"-" },
];


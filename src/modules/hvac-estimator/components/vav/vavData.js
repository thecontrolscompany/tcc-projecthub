export const COMM_WIRE = [
  { id:"ms-tp",  label:"MS/TP Serial (18/2 shielded)", unitMtl:0.38, unitLbr:0.012 },
  { id:"cat6",   label:"CAT6 + RJ45 crimps (x2)",      unitMtl:0.52, unitLbr:0.015, crimpMtl:2.40, crimpLbr:0.25 },
  { id:"cat6s",  label:"CAT6 Shielded + RJ45 crimps",  unitMtl:0.78, unitLbr:0.018, crimpMtl:3.20, crimpLbr:0.30 },
];

export const getVavGroup = (groupId, groups = VAV_COMPONENT_GROUPS) =>
  groups.find(group => group.groupId === groupId) || null;

export const isVavComponentVisible = (comp, cfg) =>
  comp.showWhen ? comp.showWhen(normalizeVavCfg(cfg)) : true;

export const getVisibleVavComponents = (cfg, comps = VAV_COMPS) =>
  comps.filter(comp => isVavComponentVisible(comp, cfg));

const isExclusiveVavGroup = (group) => group?.groupMode === "exclusive";
const hasGroupSelection = (selected, groupId, comps) =>
  selected.some(entry => comps.some(comp => comp.id === entry.id && comp.groupId === groupId));

export const applyVavDefaultSelections = (selected, cfg, options = {}) => {
  const comps = options.components || VAV_COMPS;
  const groups = options.groups || VAV_COMPONENT_GROUPS;
  const blockedIds = new Set(options.blockedIds || []);
  const next = [...selected];
  const selectedIds = new Set(next.map(entry => entry.id));

  for (const comp of comps) {
    if (!comp.defaultWhen || !comp.defaultWhen(cfg) || blockedIds.has(comp.id) || selectedIds.has(comp.id)) {
      continue;
    }

    if (comp.groupId) {
      const group = getVavGroup(comp.groupId, groups);
      if (isExclusiveVavGroup(group) && hasGroupSelection(next, comp.groupId, comps)) {
        continue;
      }
    }

    next.push({ id: comp.id, qty: 1 });
    selectedIds.add(comp.id);
  }

  return next;
};

export const reconcileVavSelected = (selected, cfg, options = {}) => {
  const comps = options.components || VAV_COMPS;
  const groups = options.groups || VAV_COMPONENT_GROUPS;
  const visibleComponents = getVisibleVavComponents(cfg, comps);
  const visibleIds = new Set(visibleComponents.map(comp => comp.id));
  const compById = new Map(comps.map(comp => [comp.id, comp]));
  const takenExclusiveGroups = new Set();
  const next = [];

  for (const entry of selected) {
    if (!visibleIds.has(entry.id)) continue;
    const comp = compById.get(entry.id);
    if (!comp?.groupId) {
      next.push(entry);
      continue;
    }

    const group = getVavGroup(comp.groupId, groups);
    if (isExclusiveVavGroup(group)) {
      if (takenExclusiveGroups.has(comp.groupId)) continue;
      takenExclusiveGroups.add(comp.groupId);
    }
    next.push(entry);
  }

  return applyVavDefaultSelections(next, cfg, {
    blockedIds: options.blockedIds,
    components: visibleComponents,
    groups,
  });
};

export const toggleVavComponentSelection = (selected, componentId, options = {}) => {
  const comps = options.components || VAV_COMPS;
  const groups = options.groups || VAV_COMPONENT_GROUPS;
  const comp = comps.find(entry => entry.id === componentId);

  if (!comp) return selected;

  const isSelected = selected.some(entry => entry.id === componentId);
  if (!comp.groupId) {
    return isSelected
      ? selected.filter(entry => entry.id !== componentId)
      : [...selected, { id: componentId, qty: 1 }];
  }

  const group = getVavGroup(comp.groupId, groups);
  const otherMemberIds = new Set(
    comps
      .filter(entry => entry.groupId === comp.groupId && entry.id !== componentId)
      .map(entry => entry.id)
  );
  const next = selected.filter(entry => !otherMemberIds.has(entry.id));

  if (isSelected) {
    if (group?.required) return next;
    return next.filter(entry => entry.id !== componentId);
  }

  return [
    ...next.filter(entry => entry.id !== componentId),
    { id: componentId, qty: 1 },
  ];
};

export const VAV_DUCT_TYPES = [
  { id:"single", label:"Single Duct" },
  { id:"dual",   label:"Dual Duct" },
];

export const VAV_HEAT_TYPES = [
  { id:"valve",        label:"Valve" },
  { id:"electric",     label:"Electric" },
  { id:"cooling-only", label:"Cooling Only" },
];

export const VAV_FAN_TYPES = [
  { id:"none",     label:"None" },
  { id:"series",   label:"Series" },
  { id:"parallel", label:"Parallel" },
];

export const VAV_ACTUATOR_TYPES = [
  { id:"integrated",   label:"Integrated" },
  { id:"proportional", label:"Proportional" },
  { id:"incremental",  label:"Incremental" },
];

export const VAV_RADIANT_TYPES = [
  { id:"no",  label:"No" },
  { id:"yes", label:"Yes" },
];

export const VAV_STARTER_TEMPLATES = [
  {
    id: "vav-cooling-only",
    label: "VAV Cooling Only",
    type: "vav",
    cfg: {
      heatType: "cooling-only",
      fanType: "none",
      actuatorType: "integrated",
    },
  },
  {
    id: "vav-hw-reheat",
    label: "VAV HW Reheat",
    type: "vav",
    cfg: {
      heatType: "valve",
      fanType: "none",
      actuatorType: "integrated",
    },
  },
  {
    id: "vav-electric-reheat",
    label: "VAV Electric Reheat",
    type: "vav",
    cfg: {
      heatType: "electric",
      fanType: "none",
      actuatorType: "integrated",
    },
  },
  {
    id: "vav-parallel-fan",
    label: "VAV Parallel Fan",
    type: "vav",
    cfg: {
      heatType: "valve",
      fanType: "parallel",
      actuatorType: "integrated",
    },
  },
];

export const getVavStarterTemplate = (templateId) =>
  VAV_STARTER_TEMPLATES.find(template => template.id === templateId) || null;

export const applyVavStarterTemplate = (cfg, templateId) => {
  const template = getVavStarterTemplate(templateId);
  if (!template) return normalizeVavCfg(cfg);
  return normalizeVavCfg({ ...(cfg || {}), ...template.cfg });
};

const DEFAULT_VAV_CFG = {
  ductType: "single",
  heatType: "valve",
  fanType: "none",
  actuatorType: "integrated",
  radiant: "no",
  powerMode: "built-in",
  commMode: "legacy-223",
  damperIntegration: "integrated",
  flowIntegration: "integrated",
  commRunFt: 40,
};

export const normalizeVavCfg = (cfg) => {
  const next = { ...DEFAULT_VAV_CFG, ...(cfg || {}) };
  next.heatType = next.heatType || next.heating || DEFAULT_VAV_CFG.heatType;
  next.actuatorType = cfg?.actuatorType || (cfg?.damperIntegration === "field" ? "proportional" : DEFAULT_VAV_CFG.actuatorType);
  next.damperIntegration = next.actuatorType === "integrated" ? "integrated" : "field";
  return next;
};

export const VAV_COMPONENT_GROUPS = [
  {
    groupId: "vav-actuator-type",
    label: "VAV Actuator Type",
    groupMode: "exclusive",
    required: false,
  },
  {
    groupId: "reheat-actuator",
    label: "Reheat Actuator Type",
    groupMode: "exclusive",
    required: false,
  },
];

export const VAV_ZONE_ASSEMBLIES = [
  { emtAID:"60002", plnAID:"60002", label:"Panel - Mount an Small Size" },
  { emtAID:"60013", plnAID:"60013", label:"3/4\" EMT down the wall to a Unit Vent" },
  { emtAID:"227",   plnAID:"227",   label:"Mount a Device Only (Generic)" },
  { emtAID:"9",     plnAID:"9",     label:"3/4\" EMT Conduit (enter the number of feet, EMT only no cable)" },
  { emtAID:"60058", plnAID:"60026", label:"Low Limit / Safety" },
  { emtAID:"60069", plnAID:"60039", label:"Damper Actuator" },
  { emtAID:"60071", plnAID:"60071", label:"Relay - General (Mount & Term)" },
  { emtAID:"60073", plnAID:"60037", label:"Duct Sensors (8 in)." },
  { emtAID:"60081", plnAID:"60089", label:"Valve Actuator" },
  { emtAID:"60082", plnAID:"60032", label:"Room Sensor and Wall Stub Up. Can be Plenum. (50' Length)" },
  { emtAID:"60085", plnAID:"60085", label:"Transformer. Field Mount" },
  { emtAID:"60087", plnAID:"60087", label:"Controller. Set the Address and Terminate the Trunk." },
  { emtAID:"60090", plnAID:"60034", label:"Controller FCU/UV" },
  { emtAID:"60092", plnAID:"60036", label:"Controller VMA +Cable+Term" },
  { emtAID:"60094", plnAID:"60094", label:"Roof Top Unit - Mixed Air Sensor" },
  { emtAID:"60097", plnAID:"60097", label:"Room Stat. Line Voltage" },
  { emtAID:"60108", plnAID:"60040", label:"Electric Heating - 3 Stages" },
  { emtAID:"60119", plnAID:"60045", label:"Controller Stat Combo (i.e. TEC)" },
  { emtAID:"60137", plnAID:"60047", label:"Exhaust fan start/stop/status" },
  { emtAID:"85",    plnAID:"74",    label:"Cable Footage (Cable Only) enter the number of feet)" },
  { emtAID:"60168", plnAID:"60167", label:"Misc Zone point (Generic)" },
  { emtAID:"60171", plnAID:"60171", label:"Wireless Bus Coordinator (i.e. 1810)" },
  { emtAID:"60172", plnAID:"60172", label:"Wireless Reciever Located @ Cntrl (i.e. 1811)" },
  { emtAID:"60174", plnAID:"60173", label:"Wireless Reciever Not Located @ Cntrl (i.e. 1811)" },
  { emtAID:"60175", plnAID:"60175", label:"Wireless Wall Stat" },
  { emtAID:"162",   plnAID:"161",   label:"CAT5 Cable (includes supports every 10' if Plenum)" },
  { emtAID:"162",   plnAID:"851",   label:"CAT5 Cable (includes NO supports)" },
  { emtAID:"852",   plnAID:"854",   label:"CAT6 Cable (includes supports every 10' if Plenum)" },
  { emtAID:"852",   plnAID:"852",   label:"CAT6 Cable (includes NO supports)" },
  { emtAID:"920",   plnAID:"920",   label:"Termination.22 to 16.AWG" },
  { emtAID:"60103", plnAID:"60042", label:"DX Wiring to Condensing Unit. Can be Plenum. (50' Length)" },
  { emtAID:"190",   plnAID:"190",   label:"RJ 45 Termination" },
  { emtAID:"5000",  plnAID:"5000",  label:"User Defined Material" },
  { emtAID:"5001",  plnAID:"5001",  label:"User Defined Hours" },
];

export const VAV_COMPS = [
  { id:"vav-ctrl",    emtAID:"60092", plnAID:"60036", name:"VAV Controller",         cat:"Controls", controlsId: null,    unitMtl:425, unitLbr:2.5,  sym:"DDC", def:true,
    pos:{x:300,y:52},  anc:{x:300,y:178}, desc:"DDC controller — mounts on VAV box" },
  { id:"vav-act",     groupId:"vav-actuator-type", emtAID:"60069", plnAID:"60039", name:"Damper Actuator - Proportional", cat:"Actuators", controlsId: "CTL-AO", unitMtl:265, unitLbr:1.5, sym:"ACT", def:false,
    showWhen: cfg => normalizeVavCfg(cfg).actuatorType === "proportional",
    defaultWhen: cfg => normalizeVavCfg(cfg).actuatorType === "proportional",
    pos:{x:178,y:220}, anc:{x:210,y:220}, desc:"Spring-return actuator on damper shaft" },
  { id:"vav-act-incr", groupId:"vav-actuator-type", emtAID:"60147", plnAID:"60096", name:"Damper Actuator - Incremental", cat:"Actuators", controlsId: "CTL-BO", unitMtl:325, unitLbr:1.9, sym:"INC", def:false,
    showWhen: cfg => normalizeVavCfg(cfg).actuatorType === "incremental",
    defaultWhen: cfg => normalizeVavCfg(cfg).actuatorType === "incremental",
    pos:{x:178,y:220}, anc:{x:210,y:220}, desc:"Incremental actuator on damper shaft" },
  { id:"flow-sensor", emtAID:"60060", plnAID:"60028", name:"Flow/Velocity Sensor",    cat:"Pressure", controlsId: "CTL-AI",    unitMtl:185, unitLbr:1.0,  sym:"DP",  def:false,
    pos:{x:58,y:168},  anc:{x:128,y:202}, desc:"Differential pressure pickup at inlet" },
  { id:"zn-temp",     emtAID:"60082", plnAID:"60032", name:"Zone Temp Sensor",        cat:"Temperature", controlsId: "CTL-AI", unitMtl:125, unitLbr:0.75, sym:"T",   def:true,
    pos:{x:490,y:52},  anc:{x:490,y:178}, desc:"Wall-mount temp sensor in zone" },
  { id:"zn-co2",      emtAID:"60082", plnAID:"60032", name:"Zone Temp + CO2",         cat:"Air Quality", controlsId: "CTL-AI", unitMtl:345, unitLbr:0.75, sym:"T+C", def:false,
    pos:{x:570,y:52},  anc:{x:490,y:178}, desc:"Combination temp + CO2 wall sensor" },
  { id:"elec-heat",   emtAID:"60108", plnAID:"60040", name:"Electric Heat Stages",    cat:"Actuators", controlsId: "CTL-BO",   unitMtl:225, unitLbr:2.0,  sym:"EH",  def:false,
    showWhen: cfg => normalizeVavCfg(cfg).heatType === "electric",
    pos:{x:444,y:300}, anc:{x:445,y:248}, desc:"Electric reheat staging control" },
  { id:"rh-valve",    groupId:"reheat-actuator", emtAID:"60081", plnAID:"60033", name:"Reheat Valve - Proportional", cat:"Actuators", controlsId: "CTL-AO", unitMtl:265, unitLbr:1.5, sym:"V", def:false,
    showWhen: cfg => normalizeVavCfg(cfg).heatType === "valve",
    defaultWhen: cfg => normalizeVavCfg(cfg).heatType === "valve",
    pos:{x:410,y:300}, anc:{x:380,y:248}, desc:"HW reheat valve on discharge coil" },
  { id:"rh-valve-2pos", groupId:"reheat-actuator", emtAID:"60089", plnAID:"60035", name:"Reheat Valve - Two-Position", cat:"Actuators", controlsId: "CTL-BO", unitMtl:235, unitLbr:1.25, sym:"2P", def:false,
    showWhen: cfg => normalizeVavCfg(cfg).heatType === "valve",
    pos:{x:444,y:300}, anc:{x:445,y:248}, desc:"Two-position hot water reheat valve actuator" },
  { id:"rh-valve-incr", groupId:"reheat-actuator", emtAID:"60081", plnAID:"60033", name:"Reheat Valve - Incremental", cat:"Actuators", controlsId: "CTL-BO", unitMtl:265, unitLbr:1.5, sym:"INC", def:false,
    showWhen: cfg => normalizeVavCfg(cfg).heatType === "valve",
    pos:{x:478,y:300}, anc:{x:510,y:248}, desc:"Incremental hot water reheat valve actuator" },
  { id:"disch-temp",  emtAID:"60093", plnAID:"60037", name:"Discharge Air Temp",      cat:"Temperature", controlsId: "CTL-AI", unitMtl:125, unitLbr:0.75, sym:"T",   def:true,
    pos:{x:510,y:195}, anc:{x:476,y:213}, desc:"Discharge temp sensor after reheat" },
  { id:"rad-htg",     emtAID:"60168", plnAID:"60167", name:"Radiant Heat Interface",  cat:"Controls", controlsId: null,    unitMtl:145, unitLbr:0.75, sym:"RAD", def:false,
    showWhen: cfg => normalizeVavCfg(cfg).radiant === "yes",
    defaultWhen: cfg => normalizeVavCfg(cfg).radiant === "yes",
    desc:"Generic radiant heat enable / monitoring point for radiant zone heat" },
  { id:"vav-power",     emtAID:"60085", plnAID:"60085", name:"24V Zone Power",          cat:"Wiring", controlsId: null,      unitMtl:45,  unitLbr:0.5,  sym:"PWR", def:false, hidden:true,
    pos:{x:220,y:300}, anc:{x:265,y:248}, desc:"24VAC transformer power feed" },
  { id:"vav-pwr-trunk", emtAID:"60135", plnAID:"60052", name:"24V Power Trunk",          cat:"Controls", controlsId: null,    unitMtl:285, unitLbr:2.0,  sym:"TR",  def:false,
    desc:"24VAC transformer + power trunk to VAV controllers", wire:"—" },
];

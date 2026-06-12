export const DEFAULT_VRF_CFG = {
  vrfRole: "full",
};

export const normalizeVrfCfg = (cfg) => ({
  ...DEFAULT_VRF_CFG,
  ...(cfg || {}),
});

const getSelectionQty = (comp, existingQty = 1) => Math.max(1, existingQty || 1);

export const isVrfComponentVisible = (comp, cfg) =>
  comp.showWhen ? comp.showWhen(normalizeVrfCfg(cfg)) : true;

export const getVisibleVrfComponents = (cfg, comps = VRF_COMPS) =>
  comps.filter((comp) => isVrfComponentVisible(comp, cfg));

const DEFAULT_VRF_IDS_BY_ROLE = {
  idu: [
    "vrf-gateway",
    "vrf-indoor",
    "vrf-zone",
    "vrf-comm",
    "vrf-bacnet",
    "vrf-float",
    "vrf-homerun",
  ],
  odu: [
    "vrf-gateway",
    "vrf-cond",
    "vrf-bacnet",
    "vrf-homerun",
  ],
  full: [
    "vrf-gateway",
    "vrf-indoor",
    "vrf-zone",
    "vrf-comm",
    "vrf-bacnet",
    "vrf-cond",
    "vrf-float",
    "vrf-homerun",
  ],
};

export const buildDefaultVrfSelected = (cfg, options = {}) => {
  const normalizedCfg = normalizeVrfCfg(cfg);
  const comps = options.components || VRF_COMPS;
  const visibleComponents = getVisibleVrfComponents(normalizedCfg, comps);
  const defaultIds = new Set(DEFAULT_VRF_IDS_BY_ROLE[normalizedCfg.vrfRole] || DEFAULT_VRF_IDS_BY_ROLE.full);

  return visibleComponents
    .filter((comp) => defaultIds.has(comp.id))
    .map((comp) => ({ id: comp.id, qty: getSelectionQty(comp) }));
};

export const reconcileVrfSelected = (selected, cfg, options = {}) => {
  const normalizedCfg = normalizeVrfCfg(cfg);
  const comps = options.components || VRF_COMPS;
  const visibleComponents = getVisibleVrfComponents(normalizedCfg, comps);
  const visibleIds = new Set(visibleComponents.map((comp) => comp.id));
  const compById = new Map(comps.map((comp) => [comp.id, comp]));
  const next = [];

  for (const entry of selected || []) {
    if (!visibleIds.has(entry.id)) continue;
    const comp = compById.get(entry.id);
    next.push({ ...entry, qty: getSelectionQty(comp, entry.qty) });
  }

  return next;
};

export const VRF_COMPS = [
  { id:"vrf-gateway",   emtAID:"60087", plnAID:"60087", name:"VRF Gateway Controller", cat:"Controls", controlsId: null,    def:true,  desc:"Supervisory controller or BACnet gateway" },
  { id:"vrf-indoor",    emtAID:"60092", plnAID:"60036", name:"Indoor Unit Controller",  cat:"Controls", controlsId: null,    def:true,  desc:"Controller for fan coil or cassette indoor unit" },
  { id:"vrf-zone",      emtAID:"60082", plnAID:"60032", name:"Zone Temp Sensor",        cat:"Temperature", controlsId: "CTL-DEV-TEMP-SPACE", def:true,  desc:"Wall-mounted zone sensor" },
  { id:"vrf-dat",       emtAID:"60073", plnAID:"60037", name:"Supply Air Temp",         cat:"Temperature", controlsId: "CTL-DEV-TEMP-DUCT", def:false, desc:"Discharge or leaving air temperature" },
  { id:"vrf-comm",      emtAID:"162",   plnAID:"161",   name:"VRF Comm Bus",            cat:"Controls", controlsId: null,    def:true,  desc:"Manufacturer communication bus wiring" },
  { id:"vrf-bacnet",    emtAID:"60119", plnAID:"60045", name:"BACnet Integration",      cat:"Controls", controlsId: null,    def:true,  desc:"Front-end integration point list" },
  { id:"vrf-cond",      emtAID:"60103", plnAID:"60042", name:"Outdoor Condenser I/O",   cat:"Controls", controlsId: null,    def:true,  desc:"Outdoor unit enable, alarm, and status" },
  { id:"vrf-branch",    emtAID:"60081", plnAID:"60089", name:"Branch Selector Control", cat:"Actuators", controlsId: "CTL-DEV-VRF-BRANCH",   def:false, desc:"Branch selector or valve box controls" },
  { id:"vrf-leak",      emtAID:"60168", plnAID:"60167", name:"Refrigerant Leak Sensor", cat:"Safety", controlsId: "CTL-DEV-REFRIG-LEAK",      def:false, desc:"Leak monitoring input" },
  { id:"vrf-float",     emtAID:"60058", plnAID:"60026", name:"Condensate Float Safety", cat:"Safety", controlsId: "CTL-DEV-CONDENSATE",      def:true,  desc:"Overflow shutdown safety" },
  { id:"vrf-pwr-trunk", emtAID:"60135", plnAID:"60052", name:"24V Power Trunk",         cat:"Controls", controlsId: null,    def:false, desc:"Transformer and low-voltage power trunk", wire:"-" },
  { id:"vrf-homerun",   emtAID:"60016", plnAID:"60016", name:"Home Run Conduit",        cat:"Wiring", controlsId: null,      def:true,  desc:"EMT home run to panel", wire:"-" },
];



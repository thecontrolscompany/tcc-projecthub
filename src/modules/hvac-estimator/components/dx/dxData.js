export const DEFAULT_DX_CFG = {
  dxMode: "heat-pump-mode",
  systemType: "heat-pump",
};

function resolveDxMode(cfg = {}) {
  if (cfg.dxMode) return cfg.dxMode;
  if (cfg.systemType === "cooling-only") return "cooling-only-mode";
  if (cfg.systemType === "furnace") return "furnace-mode";
  return "heat-pump-mode";
}

function resolveDxSystemType(dxMode) {
  if (dxMode === "cooling-only-mode") return "cooling-only";
  if (dxMode === "furnace-mode") return "furnace";
  return "heat-pump";
}

export const normalizeDxCfg = (cfg) => {
  const merged = {
    ...DEFAULT_DX_CFG,
    ...(cfg || {}),
  };
  const dxMode = resolveDxMode(merged);
  return {
    ...merged,
    dxMode,
    systemType: resolveDxSystemType(dxMode),
  };
};

const getSelectionQty = (comp, existingQty = 1) => Math.max(1, existingQty || 1);

export const isDxComponentVisible = (comp, cfg) =>
  comp.showWhen ? comp.showWhen(normalizeDxCfg(cfg)) : true;

export const getVisibleDxComponents = (cfg, comps = DX_COMPS) =>
  comps.filter(comp => isDxComponentVisible(comp, cfg));

export const applyDxDefaultSelections = (selected, cfg, options = {}) => {
  const normalizedCfg = normalizeDxCfg(cfg);
  const comps = options.components || DX_COMPS;
  const next = [...selected];
  const selectedIds = new Set(next.map(entry => entry.id));

  for (const comp of comps) {
    const shouldSelectByDefault = !!comp.def || (comp.defaultWhen ? comp.defaultWhen(normalizedCfg) : false);
    if (!shouldSelectByDefault || selectedIds.has(comp.id)) {
      continue;
    }

    next.push({ id: comp.id, qty: getSelectionQty(comp) });
    selectedIds.add(comp.id);
  }

  return next;
};

export const reconcileDxSelected = (selected, cfg, options = {}) => {
  const normalizedCfg = normalizeDxCfg(cfg);
  const comps = options.components || DX_COMPS;
  const visibleComponents = getVisibleDxComponents(normalizedCfg, comps);
  const visibleIds = new Set(visibleComponents.map(comp => comp.id));
  const compById = new Map(comps.map(comp => [comp.id, comp]));
  const next = [];

  for (const entry of selected || []) {
    if (!visibleIds.has(entry.id)) continue;
    const comp = compById.get(entry.id);
    next.push({ ...entry, qty: getSelectionQty(comp, entry.qty) });
  }

  return next;
};

export const buildDefaultDxSelected = (cfg, options = {}) => {
  const normalizedCfg = normalizeDxCfg(cfg);
  const comps = options.components || DX_COMPS;
  const visibleComponents = getVisibleDxComponents(normalizedCfg, comps);
  return applyDxDefaultSelections([], normalizedCfg, {
    components: visibleComponents,
  });
};

export const DX_COMPS = [
  { id:"dx-ddc",        emtAID:"60087", plnAID:"60087", name:"DX Unit Controller",      cat:"Controls", controlsId: null,    def:true,  desc:"Field-mounted controller for split system or heat pump" },
  { id:"dx-zone",       emtAID:"60082", plnAID:"60032", name:"Zone Temp Sensor",         cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Wall-mounted zone sensor" },
  { id:"dx-dat",        emtAID:"60073", plnAID:"60037", name:"Discharge Air Temp",       cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Supply air discharge sensor" },
  { id:"dx-cond",       emtAID:"60103", plnAID:"60042", name:"Outdoor Unit I/O",         cat:"Controls", controlsId: null,    def:true,  desc:"Start, status, and safety interface to outdoor section" },
  { id:"dx-heatpump",   emtAID:"60071", plnAID:"60071", name:"Heat Pump Changeover",     cat:"Controls", controlsId: null,    def:false, showWhen: cfg => normalizeDxCfg(cfg).dxMode === "heat-pump-mode", defaultWhen: cfg => normalizeDxCfg(cfg).dxMode === "heat-pump-mode", desc:"Reversing valve and heat pump enable control" },
  { id:"dx-aux-heat",   emtAID:"60108", plnAID:"60040", name:"Aux Heat Control",         cat:"Actuators", controlsId: "CTL-BO",   def:false, showWhen: cfg => ["heat-pump-mode", "furnace-mode"].includes(normalizeDxCfg(cfg).dxMode), defaultWhen: cfg => ["heat-pump-mode", "furnace-mode"].includes(normalizeDxCfg(cfg).dxMode), desc:"Electric or staged auxiliary heat outputs" },
  { id:"dx-float",      emtAID:"60058", plnAID:"60026", name:"Condensate Float Safety",  cat:"Safety", controlsId: "CTL-BI",      def:true,  desc:"Overflow shutdown safety switch" },
  { id:"dx-filter",     emtAID:"60059", plnAID:"60059", name:"Filter DP Switch",         cat:"Pressure", controlsId: "CTL-AI",    def:false, desc:"Differential pressure across filter" },
  { id:"dx-smoke",      emtAID:"60122", plnAID:"60122", name:"Smoke Shutdown",           cat:"Safety", controlsId: "CTL-BI",      def:false, desc:"Duct smoke shutdown interlock" },
  { id:"dx-pwr-trunk",  emtAID:"60135", plnAID:"60052", name:"24V Power Trunk",          cat:"Controls", controlsId: null,    def:false, desc:"24VAC transformer and power trunk", wire:"-" },
  { id:"dx-homerun",    emtAID:"60016", plnAID:"60016", name:"Home Run Conduit",         cat:"Wiring", controlsId: null,      def:true,  desc:"EMT home run to panel", wire:"-" },
];


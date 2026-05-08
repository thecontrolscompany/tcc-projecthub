export const NETWORK_COMPS = [
  // Panels
  { id:"net-panel-emt", emtAID:"60004", plnAID:"60004", name:"Network Panel (EMT)",      cat:"Controls",  def:true,  desc:"BACnet network panel — EMT complete" },
  { id:"net-panel-pln", emtAID:"60003", plnAID:"60003", name:"Network Panel (Plenum)",   cat:"Controls",  def:false, desc:"BACnet network panel — Plenum complete" },
  { id:"net-panel-only",emtAID:"60002", plnAID:"60002", name:"Network Panel (Panel Only)",cat:"Controls", def:false, desc:"Panel enclosure only — no wiring" },
  // Ethernet
  { id:"net-cat6",      emtAID:"852",   plnAID:"854",   name:"CAT6 Cable",               cat:"Wiring",    def:true,  desc:"CAT6 ethernet cable per foot" },
  { id:"net-cat6a",     emtAID:"853",   plnAID:"855",   name:"CAT6a Cable",              cat:"Wiring",    def:false, desc:"CAT6a ethernet cable per foot" },
  { id:"net-cat5",      emtAID:"162",   plnAID:"161",   name:"CAT5 Cable",               cat:"Wiring",    def:false, desc:"CAT5 ethernet cable per foot" },
  // Fiber
  { id:"net-fiber-2mm", emtAID:"860",   plnAID:"860",   name:"Fiber 2-Strand MM",        cat:"Wiring",    def:false, desc:"2-strand multimode plenum fiber" },
  { id:"net-fiber-4mm", emtAID:"861",   plnAID:"861",   name:"Fiber 4-Strand MM",        cat:"Wiring",    def:false, desc:"4-strand multimode plenum fiber" },
  { id:"net-fiber-term",emtAID:"214",   plnAID:"214",   name:"Fiber Termination",        cat:"Wiring",    def:false, desc:"Fiber prep and termination per end" },
  // Wireless
  { id:"net-wireless",  emtAID:"60171", plnAID:"60171", name:"Wireless Bus Coordinator", cat:"Controls",  def:false, desc:"Wireless bus coordinator (i.e. 1810)" },
  { id:"net-rcvr-ctrl", emtAID:"60172", plnAID:"60172", name:"Wireless Rcvr @ Ctrl",     cat:"Controls",  def:false, desc:"Wireless receiver at controller" },
  { id:"net-rcvr-rem",  emtAID:"60174", plnAID:"60173", name:"Wireless Rcvr Remote",     cat:"Controls",  def:false, desc:"Wireless receiver not at controller" },
  { id:"net-wall-stat", emtAID:"60175", plnAID:"60175", name:"Wireless Wall Stat",       cat:"Controls",  def:false, desc:"Wireless wall thermostat" },
  // Exhaust Fan (most common standalone)
  { id:"net-ef",        emtAID:"60137", plnAID:"60047", name:"Exhaust Fan Start/Stop",   cat:"Controls",  def:false, desc:"Exhaust fan start/stop/status" },
];
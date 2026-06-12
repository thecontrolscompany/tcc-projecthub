export const PLANT_TYPES = [
  { id:"chiller-air",   label:"Air Cooled Chiller",      icon:"❄️",  desc:"Air cooled chiller — start/stop, status, alarms, temps" },
  { id:"chiller-water", label:"Water Cooled Chiller",     icon:"💧",  desc:"Water cooled chiller — includes condenser water I/O" },
  { id:"cooling-tower", label:"Cooling Tower",            icon:"🌊",  desc:"Cooling tower fans, bypass valve, temps" },
  { id:"boiler-hw",     label:"Hot Water Boiler",         icon:"🔥",  desc:"HW boiler — burner control, supply/return temps" },
  { id:"boiler-steam",  label:"Steam Boiler",             icon:"♨️",  desc:"Steam boiler — burner control, steam pressure" },
  { id:"pumping-chw",   label:"CHW Pumping",              icon:"⚙️",  desc:"Chilled water primary/secondary pumps" },
  { id:"pumping-hw",    label:"HW Pumping",               icon:"⚙️",  desc:"Hot water circulating pumps" },
  { id:"pumping-cond",  label:"Condenser Water Pumping",  icon:"⚙️",  desc:"Condenser water pumps for water cooled chiller" },
];

export const PLANT_COMPS = {

  "chiller-air": [
    { id:"ach-io",       emtAID:"60111", plnAID:"60111", name:"Chiller Start/Stop/Status", cat:"Controls", controlsId: null,    def:true,  desc:"Chiller enable, run status, alarm" },
    { id:"ach-amps",     emtAID:"60113", plnAID:"60113", name:"Chiller Amp Monitor",       cat:"Controls", controlsId: null,    def:true,  desc:"Chiller amp monitoring via CT" },
    { id:"ach-chw-sup",  emtAID:"60076", plnAID:"60076", name:"CHW Supply Temp",           cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Chilled water supply temp sensor" },
    { id:"ach-chw-ret",  emtAID:"60076", plnAID:"60076", name:"CHW Return Temp",           cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Chilled water return temp sensor" },
    { id:"ach-iso-vlv",  emtAID:"60114", plnAID:"60114", name:"Isolation Valve",           cat:"Actuators", controlsId: "CTL-AO",   def:true,  desc:"CHW isolation valve with end switch" },
    { id:"ach-flow",     emtAID:"60152", plnAID:"60152", name:"Flow Meter",                cat:"Pressure", controlsId: "CTL-AI",    def:false, desc:"Insertion flow meter in CHW piping" },
    { id:"ach-ddc",      emtAID:"60087", plnAID:"60087", name:"DDC Control Panel",         cat:"Controls", controlsId: null,    def:true,  desc:"Plant DDC panel — BACnet" },
    { id:"ach-pwr-trunk",emtAID:"60135", plnAID:"60052", name:"24V Power Trunk",           cat:"Controls", controlsId: null,    def:true,  desc:"24VAC transformer + power trunk to DDC controllers", wire:"—" },
    { id:"ach-homerun",  emtAID:"60012", plnAID:"60012", name:"Home Run Conduit",          cat:"Wiring", controlsId: null,      def:true,  desc:"Conduit run to central plant panel", wire:"—" },
  ],

  "chiller-water": [
    { id:"wch-io",       emtAID:"60111", plnAID:"60111", name:"Chiller Start/Stop/Status", cat:"Controls", controlsId: null,    def:true,  desc:"Chiller enable, run status, alarm" },
    { id:"wch-amps",     emtAID:"60113", plnAID:"60113", name:"Chiller Amp Monitor",       cat:"Controls", controlsId: null,    def:true,  desc:"Chiller amp monitoring via CT" },
    { id:"wch-chw-sup",  emtAID:"60076", plnAID:"60076", name:"CHW Supply Temp",           cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Chilled water supply temp sensor" },
    { id:"wch-chw-ret",  emtAID:"60076", plnAID:"60076", name:"CHW Return Temp",           cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Chilled water return temp sensor" },
    { id:"wch-cond-sup", emtAID:"60076", plnAID:"60076", name:"Condenser Supply Temp",     cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Condenser water supply temp" },
    { id:"wch-cond-ret", emtAID:"60076", plnAID:"60076", name:"Condenser Return Temp",     cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Condenser water return temp" },
    { id:"wch-iso-vlv",  emtAID:"60114", plnAID:"60114", name:"CHW Isolation Valve",       cat:"Actuators", controlsId: "CTL-AO",   def:true,  desc:"CHW isolation valve with end switch" },
    { id:"wch-flow",     emtAID:"60152", plnAID:"60152", name:"Flow Meter",                cat:"Pressure", controlsId: "CTL-AI",    def:false, desc:"Insertion flow meter in CHW piping" },
    { id:"wch-ddc",      emtAID:"60087", plnAID:"60087", name:"DDC Control Panel",         cat:"Controls", controlsId: null,    def:true,  desc:"Plant DDC panel — BACnet" },
    { id:"wch-pwr-trunk",emtAID:"60135", plnAID:"60052", name:"24V Power Trunk",           cat:"Controls", controlsId: null,    def:true,  desc:"24VAC transformer + power trunk to DDC controllers", wire:"—" },
    { id:"wch-homerun",  emtAID:"60012", plnAID:"60012", name:"Home Run Conduit",          cat:"Wiring", controlsId: null,      def:true,  desc:"Conduit run to central plant panel", wire:"—" },
  ],

  "cooling-tower": [
    { id:"ct-fan-ss",    emtAID:"60131", plnAID:"60131", name:"CT Fan Start/Stop",         cat:"Controls", controlsId: null,    def:true,  desc:"Cooling tower fan start/stop/status" },
    { id:"ct-byp-vlv",   emtAID:"60115", plnAID:"60115", name:"Bypass Valve",              cat:"Actuators", controlsId: "CTL-AO",   def:true,  desc:"Condenser water bypass valve + wiring" },
    { id:"ct-sup-t",     emtAID:"60076", plnAID:"60076", name:"CW Supply Temp",            cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Condenser water supply temp" },
    { id:"ct-ret-t",     emtAID:"60076", plnAID:"60076", name:"CW Return Temp",            cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Condenser water return temp" },
    { id:"ct-vfd",       emtAID:"60129", plnAID:"60129", name:"CT Fan VFD",                cat:"Drives", controlsId: "CTL-AO",      def:false, desc:"Variable frequency drive on CT fan" },
    { id:"ct-pwr-trunk", emtAID:"60135", plnAID:"60052", name:"24V Power Trunk",           cat:"Controls", controlsId: null,    def:true,  desc:"24VAC transformer + power trunk to DDC controllers", wire:"—" },
    { id:"ct-homerun",   emtAID:"60012", plnAID:"60012", name:"Home Run Conduit",          cat:"Wiring", controlsId: null,      def:true,  desc:"Conduit run to central plant panel", wire:"—" },
  ],

  "boiler-hw": [
    { id:"bhw-burner",   emtAID:"60110", plnAID:"60110", name:"Boiler Burner Control",     cat:"Controls", controlsId: null,    def:true,  desc:"Boiler burner enable/status/alarm" },
    { id:"bhw-sup-t",    emtAID:"60076", plnAID:"60076", name:"HW Supply Temp",            cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Hot water supply temp sensor" },
    { id:"bhw-ret-t",    emtAID:"60076", plnAID:"60076", name:"HW Return Temp",            cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Hot water return temp sensor" },
    { id:"bhw-iso-vlv",  emtAID:"60114", plnAID:"60114", name:"Isolation Valve",           cat:"Actuators", controlsId: "CTL-AO",   def:false, desc:"HW isolation valve with end switch" },
    { id:"bhw-flow",     emtAID:"60152", plnAID:"60152", name:"Flow Meter",                cat:"Pressure", controlsId: "CTL-AI",    def:false, desc:"Insertion flow meter in HW piping" },
    { id:"bhw-ddc",      emtAID:"60087", plnAID:"60087", name:"DDC Control Panel",         cat:"Controls", controlsId: null,    def:true,  desc:"Plant DDC panel — BACnet" },
    { id:"bhw-pwr-trunk",emtAID:"60135", plnAID:"60052", name:"24V Power Trunk",           cat:"Controls", controlsId: null,    def:true,  desc:"24VAC transformer + power trunk to DDC controllers", wire:"—" },
    { id:"bhw-homerun",  emtAID:"60012", plnAID:"60012", name:"Home Run Conduit",          cat:"Wiring", controlsId: null,      def:true,  desc:"Conduit run to central plant panel", wire:"—" },
  ],

  "boiler-steam": [
    { id:"bst-burner",   emtAID:"60110", plnAID:"60110", name:"Boiler Burner Control",     cat:"Controls", controlsId: null,    def:true,  desc:"Boiler burner enable/status/alarm" },
    { id:"bst-press",    emtAID:"60112", plnAID:"60112", name:"Steam Pressure",            cat:"Pressure", controlsId: "CTL-AI",    def:true,  desc:"Boiler steam pressure + cable" },
    { id:"bst-sup-t",    emtAID:"60076", plnAID:"60076", name:"Steam Supply Temp",         cat:"Temperature", controlsId: "CTL-AI", def:false, desc:"Steam supply temp sensor" },
    { id:"bst-ddc",      emtAID:"60087", plnAID:"60087", name:"DDC Control Panel",         cat:"Controls", controlsId: null,    def:true,  desc:"Plant DDC panel — BACnet" },
    { id:"bst-pwr-trunk",emtAID:"60135", plnAID:"60052", name:"24V Power Trunk",           cat:"Controls", controlsId: null,    def:true,  desc:"24VAC transformer + power trunk to DDC controllers", wire:"—" },
    { id:"bst-homerun",  emtAID:"60012", plnAID:"60012", name:"Home Run Conduit",          cat:"Wiring", controlsId: null,      def:true,  desc:"Conduit run to central plant panel", wire:"—" },
  ],

  "pumping-chw": [
    { id:"pchw-pump1",    emtAID:"60131", plnAID:"60131", name:"CHW Pump 1 Start/Stop",    cat:"Controls", controlsId: null,    def:true,  desc:"Primary CHW pump start/stop/status" },
    { id:"pchw-pump2",    emtAID:"60131", plnAID:"60131", name:"CHW Pump 2 Start/Stop",    cat:"Controls", controlsId: null,    def:false, desc:"Secondary CHW pump start/stop/status" },
    { id:"pchw-vfd1",     emtAID:"60129", plnAID:"60129", name:"CHW Pump 1 VFD",           cat:"Drives", controlsId: "CTL-AO",      def:true,  desc:"VFD on primary CHW pump" },
    { id:"pchw-vfd2",     emtAID:"60129", plnAID:"60129", name:"CHW Pump 2 VFD",           cat:"Drives", controlsId: "CTL-AO",      def:false, desc:"VFD on secondary CHW pump" },
    { id:"pchw-dp",       emtAID:"60100", plnAID:"60100", name:"CHW Diff Pressure",        cat:"Pressure", controlsId: "CTL-AI",    def:true,  desc:"Differential pressure across CHW system" },
    { id:"pchw-sup-t",    emtAID:"60076", plnAID:"60076", name:"CHW Supply Temp",          cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Chilled water supply temp" },
    { id:"pchw-ret-t",    emtAID:"60076", plnAID:"60076", name:"CHW Return Temp",          cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Chilled water return temp" },
    { id:"pchw-pwr-trunk",emtAID:"60135", plnAID:"60052", name:"24V Power Trunk",          cat:"Controls", controlsId: null,    def:true,  desc:"24VAC transformer + power trunk to DDC controllers", wire:"—" },
    { id:"pchw-homerun",  emtAID:"60012", plnAID:"60012", name:"Home Run Conduit",         cat:"Wiring", controlsId: null,      def:true,  desc:"Conduit run to central plant panel", wire:"—" },
  ],

  "pumping-hw": [
    { id:"phw-pump1",    emtAID:"60131", plnAID:"60131", name:"HW Pump 1 Start/Stop",      cat:"Controls", controlsId: null,    def:true,  desc:"Primary HW pump start/stop/status" },
    { id:"phw-pump2",    emtAID:"60131", plnAID:"60131", name:"HW Pump 2 Start/Stop",      cat:"Controls", controlsId: null,    def:false, desc:"Secondary HW pump start/stop/status" },
    { id:"phw-vfd1",     emtAID:"60129", plnAID:"60129", name:"HW Pump 1 VFD",             cat:"Drives", controlsId: "CTL-AO",      def:true,  desc:"VFD on primary HW pump" },
    { id:"phw-vfd2",     emtAID:"60129", plnAID:"60129", name:"HW Pump 2 VFD",             cat:"Drives", controlsId: "CTL-AO",      def:false, desc:"VFD on secondary HW pump" },
    { id:"phw-dp",       emtAID:"60100", plnAID:"60100", name:"HW Diff Pressure",          cat:"Pressure", controlsId: "CTL-AI",    def:true,  desc:"Differential pressure across HW system" },
    { id:"phw-sup-t",    emtAID:"60076", plnAID:"60076", name:"HW Supply Temp",            cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Hot water supply temp" },
    { id:"phw-ret-t",    emtAID:"60076", plnAID:"60076", name:"HW Return Temp",            cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Hot water return temp" },
    { id:"phw-pwr-trunk",emtAID:"60135", plnAID:"60052", name:"24V Power Trunk",           cat:"Controls", controlsId: null,    def:true,  desc:"24VAC transformer + power trunk to DDC controllers", wire:"—" },
    { id:"phw-homerun",  emtAID:"60012", plnAID:"60012", name:"Home Run Conduit",          cat:"Wiring", controlsId: null,      def:true,  desc:"Conduit run to central plant panel", wire:"—" },
  ],

  "pumping-cond": [
    { id:"pcw-pump1",    emtAID:"60131", plnAID:"60131", name:"CW Pump 1 Start/Stop",      cat:"Controls", controlsId: null,    def:true,  desc:"Primary condenser pump start/stop/status" },
    { id:"pcw-pump2",    emtAID:"60131", plnAID:"60131", name:"CW Pump 2 Start/Stop",      cat:"Controls", controlsId: null,    def:false, desc:"Secondary condenser pump start/stop/status" },
    { id:"pcw-vfd1",     emtAID:"60129", plnAID:"60129", name:"CW Pump 1 VFD",             cat:"Drives", controlsId: "CTL-AO",      def:false, desc:"VFD on primary condenser pump" },
    { id:"pcw-sup-t",    emtAID:"60076", plnAID:"60076", name:"CW Supply Temp",            cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Condenser water supply temp" },
    { id:"pcw-ret-t",    emtAID:"60076", plnAID:"60076", name:"CW Return Temp",            cat:"Temperature", controlsId: "CTL-AI", def:true,  desc:"Condenser water return temp" },
    { id:"pcw-pwr-trunk",emtAID:"60135", plnAID:"60052", name:"24V Power Trunk",           cat:"Controls", controlsId: null,    def:true,  desc:"24VAC transformer + power trunk to DDC controllers", wire:"—" },
    { id:"pcw-homerun",  emtAID:"60012", plnAID:"60012", name:"Home Run Conduit",          cat:"Wiring", controlsId: null,      def:true,  desc:"Conduit run to central plant panel", wire:"—" },
  ],
};


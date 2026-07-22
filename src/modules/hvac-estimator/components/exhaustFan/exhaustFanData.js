export const EXHAUST_FAN_COMPS = [
  { id: "ef-start-stop", emtAID: "60137", plnAID: "60047", name: "Exhaust Fan Start/Stop/Status", cat: "Controls", controlsId: null, def: true, desc: "Exhaust fan enable, run status, and alarm" },
  { id: "ef-hoa-switch", emtAID: "60139", plnAID: "60139", name: "Hand/Off/Auto Switch", cat: "Controls", controlsId: null, def: false, desc: "Local HOA switch for fan control" },
  { id: "ef-vfd", emtAID: "60129", plnAID: "60129", name: "Exhaust Fan VFD", cat: "Drives", controlsId: "CTL-DEV-VFD-INTERFACE", def: false, desc: "Variable frequency drive for exhaust fan speed control" },
  { id: "ef-damper", emtAID: "60069", plnAID: "60069", name: "Damper Actuator", cat: "Actuators", controlsId: null, def: false, desc: "Damper actuator for exhaust airflow control" },
  { id: "ef-interlock", emtAID: "60123", plnAID: "60123", name: "Hardwire Interlock", cat: "Controls", controlsId: null, def: false, desc: "Hardwired exhaust fan interlock" },
  { id: "ef-room-temp", emtAID: "60032", plnAID: "60032", name: "Room Temp Sensor", cat: "Temperature", controlsId: null, def: false, desc: "Room temperature sensor for thermostat-controlled exhaust" },
];


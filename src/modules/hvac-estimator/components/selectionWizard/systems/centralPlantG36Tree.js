const coolingG36Tree = [
  {
    id: "cpg36-cooling-plant-layout-13",
    label: "Plant layout Configuration",
    scope: "mechanical",
    required: true,
    items: [
      {
        id: "cpg36-cooling-chiller-configuration-1100",
        label: "Chiller Configuration",
        type: "radio",
        defaultOption: "parallel-1101",
        options: [
          { id: "parallel-1101", label: "Parallel" },
          { id: "series-1102", label: "Series" },
        ],
      },
      {
        id: "cpg36-cooling-quantity-of-chillers-1001",
        label: "Quantity Of Chillers",
        type: "radio",
        defaultOption: "two-1020",
        options: [
          { id: "one-1010", label: "One" },
          { id: "two-1020", label: "Two" },
          { id: "three-1030", label: "Three" },
          { id: "four-1040", label: "Four" },
          { id: "five-1050", label: "Five" },
          { id: "six-1060", label: "Six" },
          { id: "seven-1070", label: "Seven" },
          { id: "eight-1080", label: "Eight" },
        ],
      },
      { id: "cpg36-cooling-secondary-pumping-5002", label: "Secondary Pumping", type: "check", defaultChecked: false },
      { id: "cpg36-cooling-integrated-waterside-economizer-7001", label: "Integrated Waterside Economizer", type: "check", defaultChecked: false },
    ],
  },
  {
    id: "cpg36-cooling-chillers-1000",
    label: "Chillers",
    scope: "mechanical",
    required: false,
    items: [
      { id: "cpg36-cooling-chiller-status-1270", label: "Chiller Status", type: "check", defaultChecked: true },
      { id: "cpg36-cooling-chiller-maintenance-switch-1280", label: "Chiller Maintenance Switch", type: "check", defaultChecked: false },
      { id: "cpg36-cooling-totalize-chiller-runtime-1290", label: "Totalize Chiller Runtime", type: "check", defaultChecked: true },
      { id: "cpg36-cooling-chw-isolation-valve-6025", label: "CHW Isolation Valve", type: "check", defaultChecked: false },
      { id: "cpg36-cooling-cw-isolation-valve-6035", label: "CW Isolation Valve", type: "check", defaultChecked: false },
    ],
  },
  {
    id: "cpg36-cooling-general-options-6500",
    label: "General Options",
    scope: "optional-hardware",
    required: false,
    items: [
      { id: "cpg36-cooling-primary-supply-temperature-6080", label: "Primary Supply Temperature", type: "check", defaultChecked: true },
      { id: "cpg36-cooling-primary-return-temperature-6090", label: "Primary Return Temperature", type: "check", defaultChecked: true },
      { id: "cpg36-cooling-primary-flow-sensor-6100", label: "Primary Flow Sensor", type: "check", defaultChecked: true },
      { id: "cpg36-cooling-system-gauge-pressure-6150", label: "System Gauge Pressure", type: "check", defaultChecked: false },
    ],
  },
];

const heatingG36Tree = [
  {
    id: "cpg36-heating-plant-layout-13",
    label: "Plant layout Configuration",
    scope: "mechanical",
    required: true,
    items: [
      {
        id: "cpg36-heating-boiler-configuration-1100",
        label: "Boiler Configuration",
        type: "radio",
        defaultOption: "condensing-only-1101",
        options: [
          { id: "condensing-only-1101", label: "Condensing Only" },
          { id: "non-condensing-only-1102", label: "Non-condensing Only" },
          { id: "hybrid-plant-1103", label: "Hybrid Plant" },
        ],
      },
      {
        id: "cpg36-heating-quantity-of-boilers-1001",
        label: "Quantity Of Boilers",
        type: "radio",
        defaultOption: "two-1020",
        options: [
          { id: "one-1010", label: "One" },
          { id: "two-1020", label: "Two" },
          { id: "three-1030", label: "Three" },
          { id: "four-1040", label: "Four" },
          { id: "five-1050", label: "Five" },
          { id: "six-1060", label: "Six" },
          { id: "seven-1070", label: "Seven" },
          { id: "eight-1080", label: "Eight" },
        ],
      },
      { id: "cpg36-heating-minimum-flow-bypass-valve-3000", label: "Minimum Flow Bypass Valve", type: "check", defaultChecked: false },
      { id: "cpg36-heating-secondary-pumping-5002", label: "Secondary Pumping", type: "check", defaultChecked: false },
    ],
  },
  {
    id: "cpg36-heating-boilers-1000",
    label: "Boilers",
    scope: "mechanical",
    required: false,
    items: [
      { id: "cpg36-heating-boiler-status-1270", label: "Boiler Status", type: "check", defaultChecked: true },
      { id: "cpg36-heating-boiler-maintenance-switch-1280", label: "Boiler Maintenance Switch", type: "check", defaultChecked: true },
      { id: "cpg36-heating-totalize-boiler-runtime-1290", label: "Totalize Boiler Runtime", type: "check", defaultChecked: true },
      { id: "cpg36-heating-isolation-valve-6025", label: "Isolation Valve", type: "check", defaultChecked: false },
    ],
  },
  {
    id: "cpg36-heating-general-options-6500",
    label: "General Options",
    scope: "optional-hardware",
    required: false,
    items: [
      { id: "cpg36-heating-primary-hw-supply-temperature-6502", label: "Primary HW Supply Temperature", type: "check", defaultChecked: true },
      { id: "cpg36-heating-primary-hw-return-temperature-6503", label: "Primary HW Return Temperature", type: "check", defaultChecked: true },
      { id: "cpg36-heating-total-plant-natural-gas-flow-6504", label: "Total Plant Natural Gas Flow", type: "check", defaultChecked: false },
      { id: "cpg36-heating-mechanical-room-temperature-6505", label: "Mechanical Room Temperature", type: "check", defaultChecked: false },
    ],
  },
];

export const centralPlantG36Tree = {
  id: "central-plant-g36",
  label: "Central Plant (Guideline 36)",
  abbr: "CPG36",
  color: "#7C3AED",
  description: "G36-compliant central cooling and heating plant.",
  systemType: "central-plant-g36",
  configurations: [
    { id: "cooling-g36", label: "Central Cooling for G36" },
    { id: "heating-g36", label: "Central Heating for G36" },
  ],
  mechanicalTreesByConfig: {
    "heating-g36": heatingG36Tree,
  },
  mechanicalTree: coolingG36Tree,
};

const singleDuctTree = [
  {
    id: "vav-sd-supply-damper-actuator-4",
    label: "Supply Damper Actuator",
    scope: "mechanical",
    required: true,
    items: [
      {
        id: "dam-type-4",
        label: "Actuator Type",
        type: "radio",
        defaultOption: "integrated-70",
        options: [
          { id: "integrated-70", label: "Integrated" },
          { id: "proportional-71", label: "Proportional" },
          { id: "incremental-72", label: "Incremental" },
        ],
      },
      {
        id: "vav-sd-supply-damper-integrated-feedback-16000",
        label: "Integrated Feedback",
        type: "check",
        defaultChecked: false,
        showWhen: { itemId: "dam-type-4", value: "integrated-70" },
      },
    ],
  },
  {
    id: "vav-sd-exhaust-damper-actuator-5",
    label: "Exhaust Damper Actuator",
    scope: "mechanical",
    required: false,
    items: [
      {
        id: "vav-sd-exhaust-damper-enabled-5",
        label: "Include Exhaust Damper Actuator",
        type: "check",
        defaultChecked: false,
        conflictsWithItem: "box-fan-type-7",
        conflictNoneValue: "none-0",
      },
      {
        id: "vav-sd-exhaust-damper-type-5",
        label: "Actuator Type",
        type: "radio",
        defaultOption: "proportional-74",
        showWhen: { itemId: "vav-sd-exhaust-damper-enabled-5", value: true },
        options: [
          { id: "proportional-74", label: "Proportional" },
          { id: "incremental-75", label: "Incremental" },
        ],
      },
    ],
  },
  {
    id: "vav-sd-box-fan-7",
    label: "Box Fan",
    scope: "mechanical",
    required: false,
    items: [
      {
        id: "box-fan-type-7",
        label: "Box Fan Type",
        type: "radio",
        defaultOption: "none-0",
        conflictsWithItem: "vav-sd-exhaust-damper-enabled-5",
        conflictNoneValue: false,
        options: [
          { id: "none-0", label: "None" },
          { id: "parallel-single-speed-8", label: "Parallel Fan Single Speed" },
          { id: "parallel-variable-speed-3000", label: "Parallel Fan Variable Speed" },
          { id: "series-single-speed-68", label: "Series Fan Single Speed" },
          { id: "series-variable-speed-9", label: "Series Fan Variable Speed" },
        ],
      },
      {
        id: "vav-sd-box-fan-parallel-control-45",
        label: "Parallel Fan Control",
        type: "radio",
        defaultOption: "temperature-based-45",
        showWhen: { itemId: "box-fan-type-7", value: "parallel-single-speed-8" },
        options: [
          { id: "temperature-based-45", label: "Temperature Based" },
          { id: "flow-based-46", label: "Flow Based" },
        ],
      },
      {
        id: "vav-sd-box-fan-series-enable-500",
        label: "Series Fan Enable",
        type: "check",
        defaultChecked: true,
        showWhen: { itemId: "box-fan-type-7", value: "series-variable-speed-9" },
      },
      {
        id: "vav-sd-box-fan-status-444",
        label: "Fan Status",
        type: "check",
        defaultChecked: false,
        showWhen: { itemId: "box-fan-type-7", notValue: "none-0" },
      },
    ],
  },
  {
    id: "vav-sd-coils-10",
    label: "Coils",
    scope: "mechanical",
    required: false,
    items: [
      { id: "vav-sd-box-heating-enabled-11", label: "Box Heating", type: "check", defaultChecked: true },
      {
        id: "vav-sd-box-heating-group-11",
        label: "Box Heating Options",
        type: "group",
        showWhen: { itemId: "vav-sd-box-heating-enabled-11", value: true },
        items: [
          {
            id: "vav-sd-box-heating-type-11",
            label: "Heating Type",
            type: "radio",
            defaultOption: "hot-water-13",
            options: [
              { id: "electric-staged-12", label: "Electric Staged" },
              { id: "hot-water-13", label: "Hot Water" },
              { id: "packaged-coil-scr-445", label: "Packaged Coil (SCR)" },
            ],
          },
          {
            id: "vav-sd-box-heating-stages-12",
            label: "Electric Stages",
            type: "radio",
            defaultOption: "two-stages-77",
            showWhen: { itemId: "vav-sd-box-heating-type-11", value: "electric-staged-12" },
            options: [
              { id: "one-stage-76", label: "One Stage" },
              { id: "two-stages-77", label: "Two Stages" },
              { id: "three-stages-78", label: "Three Stages" },
            ],
          },
          {
            id: "vav-sd-box-heating-output-13",
            label: "Hot Water Output",
            type: "radio",
            defaultOption: "proportional-output-79",
            showWhen: { itemId: "vav-sd-box-heating-type-11", value: "hot-water-13" },
            options: [
              { id: "proportional-output-79", label: "Proportional Output" },
              { id: "incremental-output-80", label: "Incremental Output" },
              { id: "two-position-output-81", label: "Two Position Output" },
            ],
          },
          {
            id: "vav-sd-box-heating-enable-bo-447",
            label: "Include Heating Enable BO",
            type: "check",
            defaultChecked: false,
            showWhen: { itemId: "vav-sd-box-heating-type-11", value: "packaged-coil-scr-445" },
          },
        ],
      },
      { id: "vav-sd-supplemental-heating-enabled-17", label: "Supplemental Heating", type: "check", defaultChecked: false },
      {
        id: "vav-sd-supplemental-heating-group-17",
        label: "Supplemental Heating Options",
        type: "group",
        showWhen: { itemId: "vav-sd-supplemental-heating-enabled-17", value: true },
        items: [
          {
            id: "vav-sd-supplemental-heating-type-17",
            label: "Heating Type",
            type: "radio",
            defaultOption: "hot-water-steam-23",
            options: [
              { id: "electric-stage-18", label: "Electric Stage" },
              { id: "hot-water-steam-23", label: "Hot Water or Steam" },
              { id: "packaged-coil-scr-446", label: "Packaged Coil (SCR)" },
            ],
          },
          {
            id: "vav-sd-supplemental-heating-output-23",
            label: "Valve Output",
            type: "radio",
            defaultOption: "proportional-output-82",
            showWhen: { itemId: "vav-sd-supplemental-heating-type-17", value: "hot-water-steam-23" },
            options: [
              { id: "proportional-output-82", label: "Proportional Output" },
              { id: "incremental-output-83", label: "Incremental Output" },
              { id: "two-position-output-84", label: "Two Position Output" },
            ],
          },
          {
            id: "vav-sd-supplemental-heating-enable-bo-448",
            label: "Include Heating Enable BO",
            type: "check",
            defaultChecked: false,
            showWhen: { itemId: "vav-sd-supplemental-heating-type-17", value: "packaged-coil-scr-446" },
          },
        ],
      },
    ],
  },
  {
    id: "vav-sd-sensors-31",
    label: "Sensors",
    scope: "mechanical",
    required: true,
    items: [
      { id: "vav-sd-supply-air-temperature-14", label: "Supply Air Temperature", type: "check", defaultChecked: false },
      {
        id: "vav-sd-supply-air-morning-warmup-15",
        label: "Used for Morning Warm-up",
        type: "check",
        defaultChecked: false,
        showWhen: { itemId: "vav-sd-supply-air-temperature-14", value: true },
      },
      { id: "vav-sd-discharge-air-temperature-501", label: "Discharge Air Temperature", type: "check", defaultChecked: false },
      {
        id: "vav-sd-zone-group-88",
        label: "Zone",
        type: "group",
        items: [
          {
            id: "vav-sd-zone-temperature-group-89",
            label: "Temperature",
            type: "group",
            items: [
              { id: "vav-sd-zone-setpoint-adjust-91", label: "Setpoint Adjust", type: "check", defaultChecked: true },
              {
                id: "vav-sd-zone-setpoint-adjust-type-92",
                label: "Setpoint Adjust Type",
                type: "radio",
                defaultOption: "common-setpoint-adjust-92",
                showWhen: { itemId: "vav-sd-zone-setpoint-adjust-91", value: true },
                options: [
                  { id: "common-setpoint-adjust-92", label: "Common Setpoint Adjust" },
                  { id: "warm-cool-adjust-93", label: "Warm Cool Adjust" },
                ],
              },
              { id: "vav-sd-zone-temp-occ-support-94", label: "Temp Occ Support", type: "check", defaultChecked: false },
            ],
          },
          { id: "vav-sd-zone-humidity-105", label: "Humidity", type: "check", defaultChecked: false },
          { id: "vav-sd-zone-occupancy-35", label: "Occupancy", type: "check", defaultChecked: false },
          { id: "vav-sd-zone-co2-96", label: "CO2 Sensor", type: "check", defaultChecked: false },
          {
            id: "vav-sd-zone-co2-min-flow-reset-63",
            label: "Used for Minimum Flow Reset",
            type: "check",
            defaultChecked: false,
            showWhen: { itemId: "vav-sd-zone-co2-96", value: true },
          },
        ],
      },
    ],
  },
  {
    id: "vav-sd-misc-502",
    label: "Misc",
    scope: "mechanical",
    required: false,
    items: [
      { id: "vav-sd-energy-hold-off-switch-36", label: "Energy Hold Off Switch", type: "check", defaultChecked: false },
      { id: "vav-sd-unit-enable-switch-37", label: "Unit Enable Switch", type: "check", defaultChecked: false },
    ],
  },
  {
    id: "vav-sd-guideline-36-3600",
    label: "Guideline 36",
    scope: "mechanical",
    hidden: true,
    required: false,
    items: [
      { id: "vav-sd-guideline-36-enabled-3600", label: "Enable Guideline 36", type: "check", defaultChecked: false },
      {
        id: "vav-sd-min-occ-flow-group-3001",
        label: "Min Occ Flow Setpoint Calculation",
        type: "group",
        showWhen: { itemId: "vav-sd-guideline-36-enabled-3600", value: true },
        items: [
          {
            id: "vav-sd-min-occ-flow-type-3001",
            label: "Calculation Method",
            type: "radio",
            defaultOption: "ashrae-62-1-3003",
            options: [
              { id: "ca-title-24-3002", label: "CA Title 24" },
              { id: "ashrae-62-1-3003", label: "ASHRAE 62.1" },
            ],
          },
          { id: "vav-sd-time-averaged-ventilation-3014", label: "Time Averaged Ventilation", type: "check", defaultChecked: false },
        ],
      },
    ],
  },
  {
    id: "vav-sd-n2-compatibility-options-15010",
    label: "N2 Compatibility Options",
    scope: "mechanical",
    required: false,
    items: [
      { id: "vav-sd-n2-enabled-15010", label: "Enable N2 Compatibility Options", type: "check", defaultChecked: false },
      {
        id: "vav-sd-n2-replacement-15010",
        label: "Replacement Mode",
        type: "radio",
        defaultOption: "replacing-vma1400-series-controller-15003",
        showWhen: { itemId: "vav-sd-n2-enabled-15010", value: true },
        options: [
          { id: "replacing-vma1400-series-controller-15003", label: "Replacing VMA1400 Series Controller" },
          { id: "replacing-vav-series-controller-15004", label: "Replacing VAV Series Controller" },
        ],
      },
    ],
  },
  {
    id: "vav-sd-optional-equipment-28",
    label: "Optional Equipment",
    scope: "optional-hardware",
    required: false,
    items: [
      { id: "vav-sd-lighting-29", label: "Lighting", type: "check", defaultChecked: false },
      { id: "vav-sd-calibration-solenoid-2001", label: "Calibration Solenoid Valve (BO)", type: "check", defaultChecked: false },
    ],
  },
  {
    id: "vav-sd-box-reheat-coil-control-2200",
    label: "Box Reheat Coil Control",
    scope: "control",
    required: false,
    items: [
      {
        id: "vav-sd-box-reheat-control-2200",
        label: "Control Mode",
        type: "radio",
        defaultOption: "zone-control-2210",
        options: [
          { id: "zone-control-2210", label: "Zone Control" },
          { id: "dat-reset-by-zone-control-2220", label: "Discharge Air Reset by Zone Control" },
        ],
      },
      { id: "vav-sd-heating-flow-reset-2221", label: "Heating Flow Reset", type: "check", defaultChecked: false },
    ],
  },
  {
    id: "vav-sd-occupancy-control-49",
    label: "Occupancy",
    scope: "control",
    required: false,
    items: [
      {
        id: "vav-sd-occupancy-mode-49",
        label: "Occupancy Mode",
        type: "radio",
        defaultOption: "scheduled-occupancy-49",
        options: [
          { id: "always-occupied-504", label: "Always Occupied" },
          { id: "scheduled-occupancy-49", label: "Scheduled Occupancy" },
        ],
      },
      {
        id: "vav-sd-override-support-50",
        label: "Override Support",
        type: "check",
        defaultChecked: false,
        showWhen: { itemId: "vav-sd-occupancy-mode-49", value: "scheduled-occupancy-49" },
      },
    ],
  },
  {
    id: "vav-sd-heating-priority-64",
    label: "Heating Priority",
    scope: "control",
    required: false,
    items: [
      {
        id: "vav-sd-heating-priority-64",
        label: "Priority",
        type: "radio",
        defaultOption: "box-heating-used-first-65",
        options: [
          { id: "box-heating-used-first-65", label: "Box Heating Used First" },
          { id: "supplemental-heating-used-first-66", label: "Supplemental Heating Used First" },
        ],
      },
    ],
  },
  {
    id: "vav-sd-optional-features-51",
    label: "Optional Features",
    scope: "control",
    required: false,
    items: [
      { id: "vav-sd-smoke-control-support-2105", label: "Smoke Control Support (UL-864-UUKL)", type: "check", defaultChecked: false },
      { id: "vav-sd-unit-enable-503", label: "Unit Enable", type: "check", defaultChecked: true },
      { id: "vav-sd-power-fail-restart-62", label: "Power Fail Restart Logic", type: "check", defaultChecked: false },
      { id: "vav-sd-energy-hold-off-52", label: "Energy Hold Off", type: "check", defaultChecked: false },
      { id: "vav-sd-network-warmup-cooldown-54", label: "Network Warmup-Cooldown Support", type: "check", defaultChecked: true },
      { id: "vav-sd-zone-low-limit-58", label: "Zone Low Limit Support", type: "check", defaultChecked: false },
      { id: "vav-sd-summer-winter-shift-59", label: "Summer-Winter Compensation Setpoint Shift", type: "check", defaultChecked: false },
    ],
  },
  {
    id: "vav-sd-additional-features-guideline-36-3008",
    label: "Additional Features (Guideline 36)",
    scope: "control",
    hidden: true,
    required: false,
    items: [
      { id: "vav-sd-system-request-generation-3005", label: "System Request Generation", type: "check", defaultChecked: false },
      { id: "vav-sd-request-accumulation-3006", label: "Request Accumulation", type: "check", defaultChecked: false },
      { id: "vav-sd-system-ok-3007", label: "System OK", type: "check", defaultChecked: false },
      { id: "vav-sd-window-switch-3010", label: "Window Switch", type: "check", defaultChecked: false },
      { id: "vav-sd-warmup-cooldown-3011", label: "Warmup-Cooldown", type: "check", defaultChecked: false },
      { id: "vav-sd-terminal-unit-alarms-3012", label: "Terminal Unit Alarms", type: "check", defaultChecked: false },
      { id: "vav-sd-generic-thermal-zone-alarms-3013", label: "Generic Thermal Zone Alarms", type: "check", defaultChecked: false },
    ],
  },
];

const dualDuctTree = [
  {
    id: "vav-dd-cold-deck-damper-4",
    label: "Cold Deck Damper Actuator",
    scope: "mechanical",
    required: true,
    items: [
      {
        id: "vav-dd-cold-deck-actuator-4",
        label: "Actuator Type",
        type: "radio",
        defaultOption: "integrated-70",
        options: [
          { id: "integrated-70", label: "Integrated" },
          { id: "proportional-71", label: "Proportional" },
          { id: "incremental-72", label: "Incremental" },
        ],
      },
    ],
  },
  {
    id: "vav-dd-hot-deck-damper-5",
    label: "Hot Deck Damper Actuator",
    scope: "mechanical",
    required: true,
    items: [
      {
        id: "vav-dd-hot-deck-actuator-5",
        label: "Actuator Type",
        type: "radio",
        defaultOption: "integrated-73",
        options: [
          { id: "integrated-73", label: "Integrated" },
          { id: "proportional-74", label: "Proportional" },
          { id: "incremental-75", label: "Incremental" },
        ],
      },
    ],
  },
  {
    id: "vav-dd-flow-sensor-locations-6",
    label: "Flow Sensor Locations",
    scope: "mechanical",
    required: true,
    items: [
      {
        id: "vav-dd-flow-sensor-locations-6",
        label: "Sensor Scheme",
        type: "radio",
        defaultOption: "cold-hot-deck-sensors",
        options: [
          { id: "cold-hot-deck-sensors", label: "Cold and Hot Deck Sensors" },
          { id: "cold-deck-only", label: "Cold Deck Sensor Only" },
          { id: "integrated-flow-calculation", label: "Integrated Flow Calculation" },
        ],
      },
    ],
  },
  {
    id: "vav-dd-exhaust-damper-7",
    label: "Exhaust Damper Actuator",
    scope: "mechanical",
    required: false,
    items: [
      { id: "vav-dd-exhaust-damper-7", label: "Include Exhaust Damper", type: "check", defaultChecked: false },
      {
        id: "vav-dd-exhaust-damper-type-7",
        label: "Actuator Type",
        type: "radio",
        defaultOption: "proportional",
        showWhen: { itemId: "vav-dd-exhaust-damper-7", value: true },
        options: [
          { id: "proportional", label: "Proportional" },
          { id: "incremental", label: "Incremental" },
          { id: "two-position", label: "Two-Position" },
        ],
      },
    ],
  },
  {
    id: "vav-dd-coils-10",
    label: "Coils",
    scope: "mechanical",
    required: false,
    items: [
      {
        id: "vav-dd-heat-type-10",
        label: "Heating Type",
        type: "radio",
        defaultOption: "none",
        options: [
          { id: "none", label: "None" },
          { id: "electric", label: "Electric" },
          { id: "hot-water-steam", label: "Hot Water / Steam" },
        ],
      },
    ],
  },
  {
    id: "vav-dd-sensors-31",
    label: "Sensors",
    scope: "mechanical",
    required: true,
    items: [
      { id: "vav-dd-zone-temperature", label: "Zone Temperature Sensor", type: "check", defaultChecked: true },
      { id: "vav-dd-discharge-air-temperature", label: "Discharge Air Temperature", type: "check", defaultChecked: false },
      { id: "vav-dd-zone-co2", label: "Zone CO2 Sensor", type: "check", defaultChecked: false },
    ],
  },
  {
    id: "vav-dd-misc-502",
    label: "Misc",
    scope: "mechanical",
    required: false,
    items: [
      { id: "vav-dd-energy-hold-off-switch", label: "Energy Hold Off Switch", type: "check", defaultChecked: false },
      { id: "vav-dd-unit-enable-switch", label: "Unit Enable Switch", type: "check", defaultChecked: false },
    ],
  },
  {
    id: "vav-dd-control-scheme-2200",
    label: "Control Scheme",
    scope: "control",
    required: false,
    items: [
      {
        id: "vav-dd-control-scheme-2200",
        label: "Control Scheme",
        type: "radio",
        defaultOption: "dual-duct-mixing",
        options: [
          { id: "dual-duct-mixing", label: "Dual Duct Mixing" },
          { id: "cold-deck-priority", label: "Cold Deck Priority" },
        ],
      },
    ],
  },
  {
    id: "vav-dd-occupancy-49",
    label: "Occupancy",
    scope: "control",
    required: false,
    items: [
      {
        id: "vav-dd-occupancy-mode-49",
        label: "Occupancy Mode",
        type: "radio",
        defaultOption: "scheduled",
        options: [
          { id: "always", label: "Always Occupied" },
          { id: "scheduled", label: "Scheduled Occupancy" },
        ],
      },
    ],
  },
  {
    id: "vav-dd-optional-features-51",
    label: "Optional Features",
    scope: "control",
    required: false,
    items: [
      { id: "vav-dd-unit-enable", label: "Unit Enable", type: "check", defaultChecked: true },
      { id: "vav-dd-network-warmup-cooldown", label: "Network Warmup-Cooldown Support", type: "check", defaultChecked: true },
    ],
  },
  {
    id: "vav-dd-n2-compatibility-options-15010",
    label: "N2 Compatibility Options",
    scope: "mechanical",
    required: false,
    items: [
      { id: "vav-dd-n2-enabled-15010", label: "Enable N2 Compatibility Options", type: "check", defaultChecked: false },
    ],
  },
  {
    id: "vav-dd-optional-equipment-28",
    label: "Optional Equipment",
    scope: "optional-hardware",
    required: false,
    items: [
      { id: "vav-dd-lighting-29", label: "Lighting", type: "check", defaultChecked: false },
      { id: "vav-dd-calibration-solenoid-2001", label: "Calibration Solenoid Valve (BO)", type: "check", defaultChecked: false },
    ],
  },
];

export const vavTree = {
  id: "vav",
  label: "Variable Air Volume",
  abbr: "VAV",
  color: "#2563EB",
  description: "Single-duct and dual-duct VAV box applications derived from CCT selection-tree data.",
  systemType: "vav",
  configurations: [
    { id: "sd-standard", label: "Single Duct - Standard", description: "Pressure-independent zone control, reheat coil, no box fan" },
    { id: "sd-parallel", label: "Single Duct - Parallel Fan", description: "Zone reheat with intermittent parallel fan-powered box" },
    { id: "sd-series", label: "Single Duct - Series Fan", description: "Zone reheat with constant-volume series fan-powered box" },
    { id: "dd", label: "Dual Duct", description: "Separate cold deck and hot deck dampers, no reheat coil" },
  ],
  mechanicalTreesByConfig: {
    dd: dualDuctTree,
  },
  mechanicalTree: singleDuctTree,
};

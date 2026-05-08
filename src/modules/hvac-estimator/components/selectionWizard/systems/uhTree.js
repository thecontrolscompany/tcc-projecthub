export const uhTree = {
  id: "uh",
  label: "Unit Heater / Unit Ventilator",
  abbr: "UH",
  color: "#9333EA",
  description: "Unit ventilator selection tree derived from the CCT SQL UnitVentilator application.",
  systemType: "uh",
  configurations: [
    { id: "hw-uh", label: "Hot Water Unit Heater", description: "Fan-coil unit heater with two-position or modulating HW valve" },
    { id: "elec-uh", label: "Electric Unit Heater", description: "Unit heater with staged electric resistance heating elements" },
    { id: "gas-uh", label: "Gas Unit Heater", description: "Unit heater with gas burner — enable/disable control" },
    { id: "uv", label: "Unit Ventilator", description: "Variable speed unit ventilator with hot water heating coil" },
  ],
  mechanicalTree: [
    {
      id: "uh-supply-fan-3",
      label: "Supply Fan",
      scope: "mechanical",
      required: true,
      items: [
        {
          id: "uh-fan-type-3",
          label: "Fan Speed",
          type: "radio",
          defaultOption: "single-speed-4",
          options: [
            { id: "single-speed-4", label: "Single Speed" },
            { id: "three-speed-5", label: "Three Speed" },
            { id: "variable-speed-6", label: "Variable Speed" },
            { id: "fan-control-by-others-79", label: "Fan Control by Others" },
          ],
        },
        { id: "uh-fan-status-7", label: "Fan Status", type: "check", defaultChecked: false },
      ],
    },
    {
      id: "uh-coils-13",
      label: "Coils",
      scope: "mechanical",
      required: true,
      items: [
        { id: "uh-cooling-enabled-14", label: "Cooling", type: "check", defaultChecked: true },
        {
          id: "uh-cooling-group-14",
          label: "Cooling Options",
          type: "group",
          showWhen: { itemId: "uh-cooling-enabled-14", value: true },
          items: [
            { id: "uh-condensate-alarm-62", label: "Condensate Alarm", type: "check", defaultChecked: false },
            {
              id: "uh-condensate-shutdown-63",
              label: "Shutdown on Alarm",
              type: "check",
              defaultChecked: false,
              showWhen: { itemId: "uh-condensate-alarm-62", value: true },
            },
            { id: "uh-cooling-lockout-oa-551", label: "Cooling Lockout from Outdoor Air", type: "check", defaultChecked: false },
            {
              id: "uh-cooling-type-14",
              label: "Cooling Type",
              type: "radio",
              defaultOption: "cold-water-16",
              options: [
                { id: "dx-cooling-15", label: "DX Cooling" },
                { id: "cold-water-16", label: "Cold Water" },
              ],
            },
            {
              id: "uh-dx-cooling-stages-15",
              label: "DX Cooling Stages",
              type: "radio",
              defaultOption: "one-stage-142",
              showWhen: { itemId: "uh-cooling-type-14", value: "dx-cooling-15" },
              options: [
                { id: "one-stage-142", label: "One Stage" },
                { id: "two-stages-143", label: "Two Stages" },
                { id: "three-stages-144", label: "Three Stages" },
              ],
            },
            {
              id: "uh-cold-water-actuator-16",
              label: "Cold Water Actuator",
              type: "radio",
              defaultOption: "proportional-actuator-145",
              showWhen: { itemId: "uh-cooling-type-14", value: "cold-water-16" },
              options: [
                { id: "proportional-actuator-145", label: "Proportional Actuator" },
                { id: "incremental-actuator-146", label: "Incremental Actuator" },
                { id: "two-position-actuator-147", label: "Two Position Actuator" },
              ],
            },
          ],
        },
        { id: "uh-heating-enabled-17", label: "Heating", type: "check", defaultChecked: true },
        {
          id: "uh-heating-group-17",
          label: "Heating Options",
          type: "group",
          showWhen: { itemId: "uh-heating-enabled-17", value: true },
          items: [
            {
              id: "uh-heat-type-13",
              label: "Heating Type",
              type: "radio",
              defaultOption: "hot-water-steam-20",
              options: [
                { id: "electric-staged-18", label: "Electric Staged" },
                { id: "hot-water-steam-20", label: "Hot Water or Steam" },
              ],
            },
            { id: "uh-heating-lockout-oa-552", label: "Heating Lockout from Outdoor Air", type: "check", defaultChecked: false },
            {
              id: "uh-electric-heating-stages-18",
              label: "Electric Heating Stages",
              type: "radio",
              defaultOption: "one-stage-148",
              showWhen: { itemId: "uh-heat-type-13", value: "electric-staged-18" },
              options: [
                { id: "one-stage-148", label: "One Stage" },
                { id: "two-stages-149", label: "Two Stages" },
                { id: "three-stages-150", label: "Three Stages" },
              ],
            },
            {
              id: "uh-hot-water-steam-actuator-20",
              label: "Hot Water / Steam Actuator",
              type: "radio",
              defaultOption: "proportional-actuator-151",
              showWhen: { itemId: "uh-heat-type-13", value: "hot-water-steam-20" },
              options: [
                { id: "proportional-actuator-151", label: "Proportional Actuator" },
                { id: "incremental-actuator-152", label: "Incremental Actuator" },
                { id: "two-position-actuator-153", label: "Two Position Actuator" },
              ],
            },
          ],
        },
        { id: "uh-common-heating-cooling-22", label: "Common Heating-Cooling", type: "check", defaultChecked: false },
      ],
    },
    {
      id: "uh-sensors-28",
      label: "Sensors",
      scope: "mechanical",
      required: true,
      items: [
        {
          id: "uh-outdoor-air-group-200",
          label: "Outdoor Air",
          type: "group",
          items: [
            { id: "uh-outdoor-air-temperature-51", label: "Temperature", type: "check", defaultChecked: false },
            { id: "uh-outdoor-air-humidity-34", label: "Humidity", type: "check", defaultChecked: false },
          ],
        },
        { id: "uh-mixed-air-temperature-36", label: "Mixed Air Temperature", type: "check", defaultChecked: false },
        { id: "uh-discharge-air-temperature-35", label: "Discharge Air Temperature", type: "check", defaultChecked: false },
        {
          id: "uh-zone-group-88",
          label: "Zone",
          type: "group",
          items: [
            { id: "uh-zone-humidity-105", label: "Humidity", type: "check", defaultChecked: false },
            { id: "uh-zone-occupancy-30", label: "Occupancy", type: "check", defaultChecked: false },
          ],
        },
      ],
    },
    {
      id: "uh-misc-131",
      label: "Misc",
      scope: "mechanical",
      required: false,
      items: [
        { id: "uh-energy-hold-off-switch-31", label: "Energy Hold Off Switch", type: "check", defaultChecked: false },
        { id: "uh-unit-enable-switch-32", label: "Unit Enable Switch", type: "check", defaultChecked: false },
      ],
    },
    {
      id: "uh-n2-compatibility-options-15060",
      label: "N2 Compatibility Options",
      scope: "mechanical",
      required: false,
      items: [
        { id: "uh-n2-enabled-15060", label: "Enable N2 Compatibility Options", type: "check", defaultChecked: false },
      ],
    },
    {
      id: "uh-optional-equipment-24",
      label: "Optional Equipment",
      scope: "optional-hardware",
      required: false,
      items: [
        { id: "uh-filter-switch-1211", label: "Filter Switch", type: "check", defaultChecked: true },
        { id: "uh-lighting-26", label: "Lighting", type: "check", defaultChecked: false },
      ],
    },
    {
      id: "uh-monitored-safeties-130",
      label: "Monitored Safeties",
      scope: "optional-hardware",
      required: false,
      items: [
        { id: "uh-discharge-air-smoke-detector-52", label: "Discharge Air Smoke Detector", type: "check", defaultChecked: false },
        { id: "uh-low-limit-temperature-switch-129", label: "Low Limit Temperature Switch", type: "check", defaultChecked: true },
      ],
    },
    {
      id: "uh-position-feedback-201",
      label: "Position Feedback",
      scope: "optional-hardware",
      required: false,
      items: [
        {
          id: "uh-modulated-damper-feedback-210",
          label: "Modulated Damper Outputs",
          type: "radio",
          defaultOption: "no-position-feedback-211",
          options: [
            { id: "no-position-feedback-211", label: "No Position Feedback" },
            { id: "analog-input-per-output-212", label: "Analog Input per Output" },
            { id: "binary-input-per-output-213", label: "Binary Input per Output" },
          ],
        },
        {
          id: "uh-modulated-valve-feedback-220",
          label: "Modulated Valve Outputs",
          type: "radio",
          defaultOption: "no-position-feedback-221",
          options: [
            { id: "no-position-feedback-221", label: "No Position Feedback" },
            { id: "analog-input-per-output-222", label: "Analog Input per Output" },
            { id: "binary-input-per-output-223", label: "Binary Input per Output" },
          ],
        },
      ],
    },
    {
      id: "uh-ashrae-cycle-control-39",
      label: "ASHRAE Cycle Control",
      scope: "control",
      required: false,
      items: [
        {
          id: "uh-ashrae-cycle-control-39",
          label: "Cycle",
          type: "radio",
          defaultOption: "ashrae-cycle-ii-41",
          options: [
            { id: "ashrae-cycle-i-40", label: "ASHRAE Cycle I" },
            { id: "ashrae-cycle-ii-41", label: "ASHRAE Cycle II" },
            { id: "ashrae-cycle-iii-42", label: "ASHRAE Cycle III" },
            { id: "ashrae-cycle-w-43", label: "ASHRAE Cycle W" },
          ],
        },
      ],
    },
    {
      id: "uh-occupancy-49",
      label: "Occupancy",
      scope: "control",
      required: false,
      items: [
        {
          id: "uh-occupancy-mode-49",
          label: "Occupancy Mode",
          type: "radio",
          defaultOption: "scheduled-occupancy-49",
          options: [
            { id: "always-occupied-2499", label: "Always Occupied" },
            { id: "scheduled-occupancy-49", label: "Scheduled Occupancy" },
          ],
        },
      ],
    },
    {
      id: "uh-economizer-suitability-69",
      label: "Economizer Suitability",
      scope: "control",
      required: false,
      items: [{ id: "uh-economizer-suitability-69", label: "Economizer Suitability", type: "check", defaultChecked: true }],
    },
    {
      id: "uh-optional-features-53",
      label: "Optional Features",
      scope: "control",
      required: false,
      items: [
        { id: "uh-unit-enable-55", label: "Unit Enable", type: "check", defaultChecked: true },
        { id: "uh-power-fail-restart-64", label: "Power Fail Restart Logic", type: "check", defaultChecked: false },
      ],
    },
  ],
};

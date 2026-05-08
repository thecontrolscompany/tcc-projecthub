export const dxTree = {
  id: "dx",
  label: "Split / DX System",
  abbr: "DX",
  color: "#DC2626",
  description: "Heat-pump based DX selection tree derived from the CCT SQL heat-pump application.",
  systemType: "dx",
  configurations: [
    { id: "cooling-only", label: "Cooling Only", description: "DX split system — cooling only, no heating stage" },
    { id: "heat-pump", label: "Heat Pump", description: "Reversible refrigerant cycle for heating and cooling" },
    { id: "furnace", label: "DX with Furnace", description: "DX cooling with gas furnace heating in air handler" },
  ],
  mechanicalTree: [
    {
      id: "dx-supply-fan-3",
      label: "Supply Fan",
      scope: "mechanical",
      required: true,
      items: [
        {
          id: "dx-supply-fan-type-3",
          label: "Fan Speed",
          type: "radio",
          defaultOption: "single-speed-4",
          options: [
            { id: "single-speed-4", label: "Single Speed" },
            { id: "three-speed-5", label: "Three Speed" },
            { id: "variable-speed-6", label: "Variable Speed" },
            { id: "fan-control-by-others-71", label: "Fan Control by Others" },
          ],
        },
        { id: "dx-fan-status-7", label: "Fan Status", type: "check", defaultChecked: false },
      ],
    },
    {
      id: "dx-exhaust-fan-5800",
      label: "Exhaust Fan",
      scope: "mechanical",
      required: false,
      items: [
        { id: "dx-toilet-exhaust-fan-5810", label: "Toilet Exhaust Fan", type: "check", defaultChecked: false },
        { id: "dx-general-exhaust-fan-5840", label: "General Exhaust Fan", type: "check", defaultChecked: false },
      ],
    },
    {
      id: "dx-coils-13",
      label: "Coils",
      scope: "mechanical",
      required: true,
      items: [
        {
          id: "dx-mode-2",
          label: "Operating Mode",
          type: "radio",
          defaultOption: "heat-pump-mode",
          options: [
            { id: "cooling-only-mode", label: "Cooling Only" },
            { id: "heat-pump-mode", label: "Heat Pump" },
            { id: "furnace-mode", label: "DX with Furnace" },
          ],
        },
        { id: "dx-condensate-alarm-65", label: "Condensate Alarm", type: "check", defaultChecked: false },
        {
          id: "dx-condensate-shutdown-66",
          label: "Shutdown on Alarm",
          type: "check",
          defaultChecked: false,
          showWhen: { itemId: "dx-condensate-alarm-65", value: true },
        },
        { id: "dx-isolation-valve-6000", label: "Isolation Valve", type: "check", defaultChecked: false },
        {
          id: "dx-isolation-valve-status-6001",
          label: "Isolation Valve Status",
          type: "check",
          defaultChecked: false,
          showWhen: { itemId: "dx-isolation-valve-6000", value: true },
        },
        { id: "dx-two-compressors-reversing-valves-19", label: "Two Compressors-Reversing Valves", type: "check", defaultChecked: false },
        { id: "dx-supplemental-heating-20", label: "Supplemental Heating", type: "check", defaultChecked: false },
        {
          id: "dx-supplemental-heating-stages-20",
          label: "Supplemental Heating Stages",
          type: "radio",
          defaultOption: "one-stage-58",
          showWhen: { itemId: "dx-supplemental-heating-20", value: true },
          options: [
            { id: "one-stage-58", label: "One Stage" },
            { id: "two-stages-59", label: "Two Stages" },
          ],
        },
      ],
    },
    {
      id: "dx-sensors-24",
      label: "Sensors",
      scope: "mechanical",
      required: true,
      items: [
        {
          id: "dx-outdoor-air-group-28",
          label: "Outdoor Air",
          type: "group",
          items: [
            { id: "dx-outdoor-air-temperature-29", label: "Temperature", type: "check", defaultChecked: false },
            { id: "dx-outdoor-air-humidity-30", label: "Humidity", type: "check", defaultChecked: false },
          ],
        },
        { id: "dx-discharge-air-temperature-33", label: "Discharge Air Temperature", type: "check", defaultChecked: false },
        {
          id: "dx-zone-group-25",
          label: "Zone",
          type: "group",
          items: [
            {
              id: "dx-zone-temperature-group-60",
              label: "Temperature",
              type: "group",
              items: [
                { id: "dx-zone-setpoint-adjust-61", label: "Setpoint Adjust", type: "check", defaultChecked: true },
                {
                  id: "dx-zone-setpoint-adjust-type-62",
                  label: "Setpoint Adjust Type",
                  type: "radio",
                  defaultOption: "common-setpoint-adjust-62",
                  showWhen: { itemId: "dx-zone-setpoint-adjust-61", value: true },
                  options: [
                    { id: "common-setpoint-adjust-62", label: "Common Setpoint Adjust" },
                    { id: "warm-cool-adjust-63", label: "Warm Cool Adjust" },
                  ],
                },
                { id: "dx-zone-temp-occ-support-64", label: "Temp Occ Support", type: "check", defaultChecked: false },
                { id: "dx-zone-fan-speed-adjust-96", label: "Fan Speed Adjust", type: "check", defaultChecked: false },
              ],
            },
            { id: "dx-zone-humidity-27", label: "Humidity", type: "check", defaultChecked: false },
            { id: "dx-zone-occupancy-35", label: "Occupancy", type: "check", defaultChecked: false },
          ],
        },
        { id: "dx-entering-water-temperature-6010", label: "Entering Water Temperature", type: "check", defaultChecked: false },
        { id: "dx-leaving-water-temperature-6011", label: "Leaving Water Temperature", type: "check", defaultChecked: false },
      ],
    },
    {
      id: "dx-misc-34",
      label: "Misc",
      scope: "mechanical",
      required: false,
      items: [
        { id: "dx-energy-hold-off-switch-37", label: "Energy Hold Off Switch", type: "check", defaultChecked: false },
        { id: "dx-unit-enable-switch-36", label: "Unit Enable Switch", type: "check", defaultChecked: false },
      ],
    },
    {
      id: "dx-n2-compatibility-options-15050",
      label: "N2 Compatibility Options",
      scope: "mechanical",
      required: false,
      items: [
        { id: "dx-n2-enabled-15050", label: "Enable N2 Compatibility Options", type: "check", defaultChecked: false },
      ],
    },
    {
      id: "dx-optional-equipment-21",
      label: "Optional Equipment",
      scope: "optional-hardware",
      required: false,
      items: [
        { id: "dx-filter-switch-22", label: "Filter Switch", type: "check", defaultChecked: false },
        { id: "dx-lighting-23", label: "Lighting", type: "check", defaultChecked: false },
      ],
    },
    {
      id: "dx-monitored-safeties-100",
      label: "Monitored Safeties",
      scope: "optional-hardware",
      required: false,
      items: [
        { id: "dx-discharge-air-smoke-detector-38", label: "Discharge Air Smoke Detector", type: "check", defaultChecked: false },
      ],
    },
    {
      id: "dx-position-feedback-200",
      label: "Position Feedback",
      scope: "optional-hardware",
      required: false,
      items: [
        {
          id: "dx-modulated-damper-outputs-210",
          label: "Modulated Damper Outputs",
          type: "radio",
          defaultOption: "no-position-feedback-211",
          options: [
            { id: "no-position-feedback-211", label: "No Position Feedback" },
            { id: "analog-input-per-output-212", label: "Analog Input per Output" },
            { id: "binary-input-per-output-213", label: "Binary Input per Output" },
          ],
        },
      ],
    },
    {
      id: "dx-cycle-during-occupied-74",
      label: "Cycle During Occupied",
      scope: "control",
      required: false,
      items: [{ id: "dx-cycle-during-occupied-74", label: "Cycle During Occupied", type: "check", defaultChecked: false }],
    },
    {
      id: "dx-turn-fan-off-loss-airflow-89",
      label: "Turn Fan Off on Loss of Airflow",
      scope: "control",
      required: false,
      items: [{ id: "dx-turn-fan-off-loss-airflow-89", label: "Turn Fan Off on Loss of Airflow", type: "check", defaultChecked: false }],
    },
    {
      id: "dx-occupancy-45",
      label: "Occupancy",
      scope: "control",
      required: false,
      items: [
        {
          id: "dx-occupancy-mode-45",
          label: "Occupancy Mode",
          type: "radio",
          defaultOption: "scheduled-occupancy-45",
          options: [
            { id: "always-occupied-2499", label: "Always Occupied" },
            { id: "scheduled-occupancy-45", label: "Scheduled Occupancy" },
          ],
        },
      ],
    },
    {
      id: "dx-economizer-suitability-76",
      label: "Economizer Suitability",
      scope: "control",
      required: false,
      items: [{ id: "dx-economizer-suitability-76", label: "Economizer Suitability", type: "check", defaultChecked: true }],
    },
    {
      id: "dx-reversing-valve-outputs-110",
      label: "Reversing Valve Output(s)",
      scope: "control",
      required: false,
      items: [
        {
          id: "dx-reversing-valve-outputs-110",
          label: "Reversing Valve State",
          type: "radio",
          defaultOption: "on-for-cooling-111",
          options: [
            { id: "on-for-cooling-111", label: "On for Cooling" },
            { id: "on-for-heating-112", label: "On for Heating" },
          ],
        },
      ],
    },
    {
      id: "dx-optional-features-49",
      label: "Optional Features",
      scope: "control",
      required: false,
      items: [
        { id: "dx-unit-enable-51", label: "Unit Enable", type: "check", defaultChecked: true },
        { id: "dx-power-fail-restart-90", label: "Power Fail Restart Logic", type: "check", defaultChecked: false },
        { id: "dx-energy-hold-off-50", label: "Energy Hold Off", type: "check", defaultChecked: false },
      ],
    },
  ],
};

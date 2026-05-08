function quantityOptions(baseId, labels) {
  return labels.map(([id, label]) => ({ id, label }));
}

export const monitoringOnlyTree = {
  id: "monitoring-only",
  label: "Monitoring / Supervisory Only",
  abbr: "MON",
  color: "#64748B",
  description: "Points-only monitoring and supervisory control without direct equipment control.",
  systemType: "monitoring-only",
  configurations: [{ id: "standard", label: "Monitoring Only" }],
  mechanicalTree: [
    {
      id: "mon-general-point-monitoring-100",
      label: "General Point Monitoring",
      scope: "mechanical",
      required: true,
      items: [
        {
          id: "mon-zone-items-102",
          label: "Zone Items",
          type: "group",
          items: [
            { id: "mon-zone-temperature-sensor-110", label: "Zone Temperature Sensor (AI)", type: "check", defaultChecked: false },
            {
              id: "mon-zone-temperature-quantity-110",
              label: "Zone Temperature Quantity",
              type: "radio",
              defaultOption: "one-sensor-111",
              showWhen: { itemId: "mon-zone-temperature-sensor-110", value: true },
              options: quantityOptions("zone-temp", [
                ["one-sensor-111", "1 Sensor (1 AI)"],
                ["two-sensors-112", "2 Sensors (2 AI's)"],
                ["three-sensors-113", "3 Sensors (3 AI's)"],
                ["four-sensors-114", "4 Sensors (4 AI's)"],
                ["five-sensors-115", "5 Sensors (5 AI's)"],
                ["six-sensors-116", "6 Sensors (6 AI's)"],
              ]),
            },
            { id: "mon-zone-humidity-sensor-120", label: "Zone Humidity Sensor (AI)", type: "check", defaultChecked: false },
            { id: "mon-zone-co2-sensor-130", label: "Zone CO2 Sensor (AI)", type: "check", defaultChecked: false },
          ],
        },
        {
          id: "mon-outdoor-air-items-140",
          label: "Outdoor Air Items",
          type: "group",
          items: [
            { id: "mon-outdoor-air-temperature-141", label: "Temperature Sensor (AI)", type: "check", defaultChecked: false },
            { id: "mon-outdoor-air-humidity-142", label: "Humidity Sensor (AI)", type: "check", defaultChecked: false },
            { id: "mon-outdoor-air-dew-point-143", label: "Dew Point Sensor (AI)", type: "check", defaultChecked: false },
            { id: "mon-outdoor-air-wind-speed-144", label: "Wind Speed (AI)", type: "check", defaultChecked: false },
            { id: "mon-outdoor-air-wind-direction-145", label: "Wind Direction (AI)", type: "check", defaultChecked: false },
            { id: "mon-outdoor-air-co2-146", label: "CO2 Sensor (AI)", type: "check", defaultChecked: false },
            { id: "mon-snow-detector-147", label: "Snow Detector (BI)", type: "check", defaultChecked: false },
            { id: "mon-freeze-detector-148", label: "Freeze Detector (BI)", type: "check", defaultChecked: false },
          ],
        },
        {
          id: "mon-duct-items-150",
          label: "Duct Items",
          type: "group",
          items: [
            { id: "mon-duct-temperature-sensor-151", label: "Duct Temperature Sensor (AI)", type: "check", defaultChecked: false },
            { id: "mon-duct-pressure-sensor-152", label: "Duct Pressure Sensor (AI)", type: "check", defaultChecked: false },
            { id: "mon-high-duct-pressure-switch-153", label: "High Duct Pressure Switch (BI)", type: "check", defaultChecked: false },
            { id: "mon-low-duct-pressure-switch-154", label: "Low Duct Pressure Switch (BI)", type: "check", defaultChecked: false },
            { id: "mon-filter-status-diff-pressure-switch-280", label: "Filter Status Diff Pressure Switch (BI)", type: "check", defaultChecked: false },
          ],
        },
        {
          id: "mon-pipe-mounted-items-170",
          label: "Pipe Mounted Items",
          type: "group",
          items: [
            { id: "mon-pipe-temperature-sensor-171", label: "Temperature Sensor (AI)", type: "check", defaultChecked: false },
            { id: "mon-water-flow-status-switch-190", label: "Water Flow Status Switch (BI)", type: "check", defaultChecked: false },
            { id: "mon-water-flow-sensor-200", label: "Water Flow Sensor (AI)", type: "check", defaultChecked: false },
            { id: "mon-steam-pressure-609", label: "Steam Pressure (AI)", type: "check", defaultChecked: false },
            { id: "mon-water-pressure-610", label: "Water Pressure (AI)", type: "check", defaultChecked: false },
            { id: "mon-btu-meter-330", label: "BTU Meter (AI)", type: "check", defaultChecked: false },
          ],
        },
        {
          id: "mon-generator-items-210",
          label: "Generator Items",
          type: "group",
          items: [
            { id: "mon-generator-status-211", label: "Monitor Status (BI)", type: "check", defaultChecked: false },
            { id: "mon-generator-alarm-212", label: "Monitor Alarm (BI)", type: "check", defaultChecked: false },
            { id: "mon-generator-trouble-213", label: "Monitor Trouble (BI)", type: "check", defaultChecked: false },
            { id: "mon-generator-fuel-level-214", label: "Monitor Fuel Level (AI)", type: "check", defaultChecked: false },
          ],
        },
        {
          id: "mon-electrical-power-items-215",
          label: "Electrical Power Items",
          type: "group",
          items: [
            { id: "mon-electrical-status-221", label: "Monitor Status (BI)", type: "check", defaultChecked: false },
            { id: "mon-electrical-fault-222", label: "Monitor Fault (BI)", type: "check", defaultChecked: false },
            { id: "mon-electrical-current-223", label: "Monitor Current (3 AI)", type: "check", defaultChecked: false },
            { id: "mon-electrical-voltage-224", label: "Monitor Voltage (3 AI)", type: "check", defaultChecked: false },
            { id: "mon-electrical-kw-226", label: "Monitor KW (AI)", type: "check", defaultChecked: false },
          ],
        },
      ],
    },
    {
      id: "mon-control-root-20",
      label: "Control Outputs",
      scope: "control",
      required: false,
      items: [],
    },
  ],
};

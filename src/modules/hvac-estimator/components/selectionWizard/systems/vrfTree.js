export const vrfTree = {
  id: "vrf",
  label: "VRF System",
  abbr: "VRF",
  color: "#047857",
  description: "Variable refrigerant flow system with indoor-unit or outdoor-unit focused controls scope.",
  systemType: "vrf",
  configurations: [
    { id: "idu", label: "Indoor Units", description: "Controls scope covers indoor units and zone-level I/O only" },
    { id: "odu", label: "Outdoor Unit", description: "Controls scope covers the outdoor condensing unit only" },
    { id: "full", label: "Full System", description: "Controls scope covers both indoor units and outdoor unit" },
  ],
  mechanicalTree: [
    {
      id: "role", label: "VRF Scope", scope: "mechanical", required: true,
      items: [
        { id: "vrf-role", label: "Primary Scope", type: "radio", defaultOption: "full",
          options: [
            { id: "indoor-units", label: "Indoor Units" },
            { id: "outdoor-unit", label: "Outdoor Unit" },
            { id: "full", label: "Full System" },
          ],
        },
      ],
    },
    {
      id: "integration", label: "Integration", scope: "mechanical", required: false,
      items: [
        { id: "vrf-gateway", label: "BACnet / Gateway Integration", type: "check", defaultChecked: true },
        { id: "vrf-local", label: "Local Unit Controllers", type: "check", defaultChecked: true },
      ],
    },
    {
      id: "sensors", label: "Sensors", scope: "mechanical", required: false,
      items: [
        { id: "vrf-zone-temp", label: "Zone Temperature Sensor", type: "check", defaultChecked: true },
        { id: "vrf-oa-temp", label: "Outdoor Air Temperature", type: "check", defaultChecked: false },
      ],
    },
  ],
};

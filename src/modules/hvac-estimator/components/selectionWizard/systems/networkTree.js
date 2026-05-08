export const networkTree = {
  id: "network",
  label: "Network",
  abbr: "NET",
  color: "#059669",
  description: "Network infrastructure and panel scope for BAS communications, paneling, and field integration.",
  systemType: "network",
  configurations: [
    { id: "standard", label: "Standard Network Scope" },
  ],
  mechanicalTree: [
    {
      id: "panels", label: "Panels", scope: "mechanical", required: true,
      items: [
        { id: "net-panel", label: "Network Panel", type: "check", defaultChecked: true },
        { id: "net-power", label: "Power Supply", type: "check", defaultChecked: true },
      ],
    },
    {
      id: "bus", label: "Communication Bus", scope: "mechanical", required: true,
      items: [
        { id: "net-bus-type", label: "Bus Type", type: "radio", defaultOption: "mstp",
          options: [
            { id: "mstp", label: "BACnet MS/TP" },
            { id: "ip", label: "BACnet/IP" },
            { id: "mixed", label: "Mixed Network" },
          ],
        },
      ],
    },
    {
      id: "extras", label: "Optional Items", scope: "mechanical", required: false,
      items: [
        { id: "net-wireless", label: "Wireless Gateway", type: "check", defaultChecked: false },
        { id: "net-surge", label: "Surge Protection", type: "check", defaultChecked: false },
      ],
    },
  ],
};

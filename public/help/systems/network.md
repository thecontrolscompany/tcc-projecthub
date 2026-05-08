# Network

Controls scope for the BAS network infrastructure: controllers, field panels, gateways, and communication wiring.

## What Network Items Cover

The Network system type is used for:

- **Field panels / BACnet routers** — NAE, NCE, or equivalent field controllers
- **Ethernet switches** — managed switches for BACnet/IP networks
- **Gateways** — protocol translation (Modbus, LonWorks, DALI, etc.)
- **Head-end / workstation** — supervisory controllers or JACE devices
- **Trunk wiring** — MS/TP or BACnet/IP backbone cabling

## Usage

Network items typically represent a single network device or a segment of backbone infrastructure. Add one item per device or per network segment as appropriate for the estimate structure.

## Notes

- Network items use a static component list — there are no configuration-driven visibility rules. All components are optional and default to unselected.
- Use the **Add Assembly** button to pull additional assemblies from the full catalog for site-specific network hardware.
- Network scope is often job-specific. The standard component list covers common device types; custom assemblies handle everything else.

---

*Full system reference in progress.*

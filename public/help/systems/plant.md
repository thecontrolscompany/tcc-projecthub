# Central Plant

Controls scope for central plant equipment: chillers, boilers, cooling towers, pumps, and plant-level sequencing.

## Configurations

Plant items are added by equipment type. Each piece of equipment is a separate line item.

| Equipment | Description |
|---|---|
| Chiller | Chilled water plant controller and associated I/O |
| Boiler | Hot water or steam boiler controller |
| Cooling tower | Cooling tower fan, valve, and level controls |
| Primary pump | Variable or constant speed pump with VFD |
| Secondary pump | Variable speed distribution pump |
| Heat exchanger | Plate or shell-and-tube isolation HX |

## Notes

- Plant scope varies significantly by system complexity. A simple chiller plant differs substantially from a large campus central plant with multiple chillers, towers, and variable primary flow.
- Plant type selection sets the component template. Review all selections — plant items often require custom assembly additions for site-specific equipment.
- The plant system type does not currently have cfg-level rule-driven component visibility. Component selection is fully manual after choosing the plant type.

---

*Full system reference in progress.*

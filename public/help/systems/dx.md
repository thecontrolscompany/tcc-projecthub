# DX / Heat Pump

Controls scope for split-system DX and heat pump equipment: DDC or standalone controller, sensors, and safety inputs.

## Configurations

| Configuration | Description |
|---|---|
| DX cooling only | Split-system cooling, no heat |
| DX with aux heat | Split-system cooling with auxiliary electric heat strip |
| Heat pump | Reversible heat pump |
| Heat pump with aux heat | Heat pump with auxiliary electric heat for low-ambient backup |

## Key Configuration Dimensions

- **DX type** — straight cool, heat pump

## Default Components

- DDC controller
- Supply air temperature sensor
- Return air temperature sensor

Heat pump systems additionally default:

- Heat pump reversing valve control
- Auxiliary heat element (if aux heat configured)

## Notes

- The `dx-heatpump` and `dx-aux-heat` components only default when the heat pump configuration is selected. They do not appear for straight-cool DX systems.

---

*Full system reference in progress.*

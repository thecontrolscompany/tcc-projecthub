# FCU — Fan Coil Unit

Controls scope for fan coil units: DDC controller, valves, sensors, and wiring.

## Configurations

| Configuration | Description |
|---|---|
| 2-pipe cooling | Chilled water coil only |
| 2-pipe heating | Hot water coil only |
| 4-pipe | Separate chilled water and hot water coils |
| Heat pump | Reversible refrigerant coil |

## Key Configuration Dimensions

- **Coil type** — 2-pipe cooling, 2-pipe heating, 4-pipe, heat pump
- **Valve type** — 2-way, 3-way
- **Fan speeds** — single, multi-speed, ECM

## Default Components

The following are always selected by default:

- DDC controller
- Discharge air temperature sensor
- Filter differential pressure switch

Additional defaults based on configuration:

- Chilled water valve (2-pipe cooling or 4-pipe)
- Hot water valve (2-pipe heating or 4-pipe)

## Optional Hardware

- Room temperature sensor (may be remote)
- Occupancy sensor
- Zone humidity sensor

## Notes

- The discharge air temperature sensor and filter DP switch default on for all FCU configurations.
- Valve assembly selection depends on pipe configuration and valve type.

---

*Full system reference in progress.*

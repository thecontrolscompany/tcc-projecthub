# AHU — Air Handling Unit

Controls scope for air handling units: DDC controller, sensors, actuators, and associated wiring.

## Configurations

| Configuration | Description |
|---|---|
| MASD | Mixed-air single-duct — single supply fan, mixed air damper section |
| MADD | Mixed-air dual-duct — hot deck and cold deck |
| OASD | 100% outside air single-duct — no return air damper section |

## Key Configuration Dimensions

- **AHU type** — MASD, MADD, OASD (drives major component visibility)
- **Cooling type** — chilled water, DX, none
- **Heating type** — hot water, electric, gas, none
- **Preheat type** — hot water, electric, none
- **Reheat type** — hot water, electric, none
- **Supply fan config** — VFD, constant volume
- **Return/exhaust fan** — VFD, constant volume, none

## Default Components

The following are selected by default when the system is created:

- DDC controller
- Supply air temperature sensor
- Mixed air temperature sensor (MASD/MADD only)
- Return air temperature sensor
- Outside air temperature sensor
- Supply air static pressure sensor
- Supply air humidity sensor
- VFD (if fan config includes VFD)
- Water temperature sensors (if hot water or chilled water coil configured)

## Optional Hardware

- Return air CO2 / IAQ sensor
- Outside air CFM station
- Smoke detectors (supply and return)
- Freeze stat
- Face-and-bypass damper actuator
- Humidifier (steam or evaporative)

## Notes

- Water temperature sensors (supply and return) default automatically when the corresponding coil type is configured. HW sensors appear for hot water heating or preheat; CHW sensors appear for chilled water cooling.
- ERV/HRV integration is handled through the preheat/heat recovery configuration.

---

*Full system reference in progress. See the selection wizard for complete configuration options.*

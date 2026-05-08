# RTU — Rooftop Unit

Controls scope for packaged rooftop units: DDC controller, sensors, and economizer controls.

## Configurations

| Configuration | Description |
|---|---|
| Gas/electric, cooling only | Standard RTU with DX cooling and gas or electric heat |
| Heat pump | Reversible RTU with auxiliary electric heat |
| Cooling only | DX cooling, no heat |

## Key Configuration Dimensions

- **Heat type** — gas, electric, heat pump, none
- **Economizer** — none, dry-bulb, enthalpy
- **Fan config** — constant volume, VFD

## Default Components

- DDC controller
- Supply air temperature sensor
- Return air temperature sensor
- Outside air temperature sensor (with economizer)
- Economizer damper actuator (if economizer configured)

## Optional Hardware

- CO2 sensor
- Supply air static pressure sensor
- VFD (if variable volume)
- Smoke detector

---

*Full system reference in progress.*

# VAV — Variable Air Volume

Controls scope for VAV terminal units: DDC controller, actuator, sensors, and reheat hardware.

## Configurations

| Configuration | Description |
|---|---|
| Single duct, no heat | Pressure-independent VAV box, cooling only |
| Single duct, HW reheat | VAV box with hot water reheat coil and valve |
| Single duct, electric reheat | VAV box with electric resistance reheat |
| Fan-powered series | Series fan-powered VAV (constant fan) |
| Fan-powered parallel | Parallel fan-powered VAV (intermittent fan) |

## Key Configuration Dimensions

- **Duct type** — single duct, fan-powered series, fan-powered parallel
- **Heat type** — none, hot water valve, electric
- **Fan type** — none, ECM, PSC (for fan-powered types)
- **Actuator type** — proportional, two-position, incremental (for reheat valve)

## Default Components

- DDC controller
- Flow sensor (Pitot tube or balometer-style)
- Zone temperature sensor
- Actuator (damper actuator)
- Reheat valve actuator (if HW reheat configured)

## Optional Hardware

- CO2 / IAQ sensor
- Occupancy sensor
- Zone humidity sensor
- Local setpoint adjustment

## Notes

- Reheat actuator type is an exclusive group: only one of proportional, two-position, or incremental can be selected at a time.
- Fan components (VFD, motor, relay) appear only when a fan-powered configuration is selected.

---

*Full system reference in progress.*

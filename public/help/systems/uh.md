# Unit Heater / Unit Ventilator

Controls scope for unit heaters and unit ventilators: thermostat or DDC controller, valve, and safety controls.

## Configurations

| Configuration | Description |
|---|---|
| Hot water unit heater | HW coil with control valve |
| Electric unit heater | Electric element with thermostat or DDC control |
| Gas unit heater | Gas-fired with ignition control |
| Unit ventilator | Mixed air unit with cooling and heating coils |

## Key Configuration Dimensions

- **Heat type** — hot water, electric, gas

## Default Components

- Controller / thermostat
- Hot water valve (if HW configured)

## Notes

- Unit heaters are typically lower complexity than AHU or FCU scope. Many jobs use a simple thermostat with a zone valve rather than full DDC.
- For unit ventilators with cooling capability, see the FCU system type instead.

---

*Full system reference in progress.*

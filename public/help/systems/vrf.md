# VRF — Variable Refrigerant Flow

Controls scope for VRF systems: integration controllers, indoor unit controls, and outdoor unit monitoring.

## Configurations

| Configuration | Description |
|---|---|
| Full system | ODU + all IDUs as a single estimate item |
| Indoor unit (IDU) | Individual indoor unit controls only |
| Outdoor unit (ODU) | Outdoor unit monitoring and integration only |

## Key Configuration Dimensions

- **VRF role** — IDU, ODU, full (drives which components are active)

## Default Components

**IDU role:**
- Indoor unit controller / interface module
- Zone temperature sensor

**ODU role:**
- Outdoor unit gateway/integration module
- Equipment monitoring points

**Full system:**
- All IDU and ODU components

## Notes

- VRF systems often use manufacturer-provided controls with BACnet or proprietary integration. The assembly selection should reflect the actual integration method (native protocol vs. third-party gateway).
- Component defaults are role-driven — selecting IDU only role suppresses ODU components and vice versa.

---

*Full system reference in progress.*

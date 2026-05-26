# Task 107 — AI Parser: Device-by-Others Rules + Home-Run Conduit

## Problem

The AI scope parser treats every estimate as a prime-contractor scope. When TCC is a subcontractor (e.g. Siemens furnishes all devices), the estimate inflates by 60–80% because:

1. **Sensors Siemens installs are included as TCC assemblies.** The Siemens SOW explicitly states "Siemens is responsible for supplying, installing, and wiring the discharge air temperature sensor and room temperature sensor" for all DXR FCUs and VAVs. The AI still generates `Duct Temp` and `Temp Sensor Room BACnet` assemblies for every one — 47 VAVs × 2 sensors = 94 assemblies TCC won't touch. Same problem for AFMS and valve actuators "installed by mechanical contractor."

2. **Home-run conduit is nearly $0.** The Network/BAS Backbone only gets one System Network Panel entry (~$885). On a 50-system project in a multi-story building, home-run conduit and cable distribution is realistically $8k–$12k and should scale with scope size.

3. **No distinction between "furnished by others, TCC installs" vs "furnished by others, party also installs."** Both cases incorrectly get the full supply+install assembly.

## File to Edit

`src/modules/hvac-estimator/ai/takeoffServer.js` — `buildScopeTakeoffPrompt` function.

## Changes Required

In the `return [...]` array inside `buildScopeTakeoffPrompt`, after the existing `"ASSEMBLY COUNT RULES..."` block and before `"The baseScopeName should be..."`, insert the following strings:

```
"DEVICE-BY-OTHERS RULES — scan every sentence of the scope for ownership language before generating assemblies:",
"- If the scope states a device is furnished by a named party AND that same party is also responsible for installing and wiring it: include ZERO assemblies for it. It is not TCC work.",
"  Applies to: discharge air temp sensors, room/space temp sensors, AFMS units, and valve actuators when the scope explicitly says another party installs them.",
"- If a device is furnished by the prime contractor but TCC physically mounts and wires it to the BAS: include ONE Control/Status assembly as the install-labor proxy — do NOT use the full supply+install assembly.",
"- If a device is furnished by the prime but the mechanical contractor installs it (explicitly stated): include ZERO assemblies. TCC's only work is the BACnet cable run, which is already covered by VSD Start/Stop/Status/Speed or Control/Status.",
"- VFD/VSD BACnet integration (VSD Start/Stop/Status/Speed): always include regardless of who furnishes the drive — TCC always runs the BACnet cable.",
"HOME-RUN CONDUIT RULE:",
"- Count the total number of systems you are outputting (not counting the Network/BAS Backbone itself).",
"- In the Network / BAS Backbone system, add a point named 'Home Run Conduit Allowance' with assemblyName 'Home Run Conduit' and qty equal to the total system count (minimum 10). This represents EMT conduit runs from field devices back to panels.",
"- In the same system, add a point named 'Inter-Panel Cabling' with assemblyName 'Control/Status' and qty equal to the number of systems that have their own dedicated control panel (AHUs, large FCUs, plant systems).",
```

## Expected Outcome

On re-run of the UWF Stadium Siemens SOW:
- VAV and DXR FCU discharge/room temp sensors should be absent (Siemens installs them)
- AFMS entries should be absent (mechanical contractor installs)
- Valve actuator assemblies should be absent for AHU and FCU systems (mechanical contractor)
- Network/BAS Backbone should include Home Run Conduit qty ~30 and Inter-Panel Cabling qty ~5–8
- Total estimate should move from ~$166k toward ~$90–100k for a sub-scope on this project

## Commit

Commit only `src/modules/hvac-estimator/ai/takeoffServer.js`. Push to main.

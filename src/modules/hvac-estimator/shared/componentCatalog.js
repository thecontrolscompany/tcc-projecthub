import { AHU_COMPS } from "../components/ahu/ahuData.js";
import { DX_COMPS } from "../components/dx/dxData.js";
import { FCU_COMPS } from "../components/fcu/fcuData.js";
import { NETWORK_COMPS } from "../components/network/networkData.js";
import { PLANT_COMPS } from "../components/plant/plantData.js";
import { RTU_COMPS } from "../components/rtu/rtuData.js";
import { UH_COMPS } from "../components/uh/uhData.js";
import { VAV_COMPS } from "../components/vav/vavData.js";
import { VRF_COMPS } from "../components/vrf/vrfData.js";
import { EXHAUST_FAN_COMPS } from "../components/exhaustFan/exhaustFanData.js";

const EQUIPMENT_GROUPS = [
  { type: "ahu", label: "AHU", components: AHU_COMPS },
  { type: "vav", label: "VAV", components: VAV_COMPS },
  { type: "rtu", label: "RTU", components: RTU_COMPS },
  { type: "dx", label: "DX/HP", components: DX_COMPS },
  { type: "vrf", label: "VRF", components: VRF_COMPS },
  { type: "fcu", label: "FCU", components: FCU_COMPS },
  { type: "uh", label: "UH", components: UH_COMPS },
  { type: "plant", label: "Plant", components: Object.values(PLANT_COMPS).flat() },
  { type: "network", label: "Network", components: NETWORK_COMPS },
  { type: "exhaust-fan", label: "Exhaust Fan", components: EXHAUST_FAN_COMPS },
];

function getComponentDisplayLabel(component) {
  return component.label || component.name || component.id;
}

export function getAllEquipmentComponents(overridesByKey = {}) {
  return EQUIPMENT_GROUPS.flatMap((group) =>
    group.components.map((component) => ({
      ...component,
      componentKey: `${group.type}:${component.id}`,
      builtInControlsId: component.controlsId ?? null,
      controlsId: (() => {
        const overrideValue = overridesByKey?.[`${group.type}:${component.id}`];
        return typeof overrideValue === "string" && overrideValue.trim() ? overrideValue.trim() : component.controlsId ?? null;
      })(),
      controlsOverridden: (() => {
        const overrideValue = overridesByKey?.[`${group.type}:${component.id}`];
        return (
          typeof overrideValue === "string" &&
          Boolean(overrideValue.trim()) &&
          overrideValue.trim() !== String(component.controlsId ?? "")
        );
      })(),
      sourceType: group.type,
      sourceLabel: group.label,
    })),
  );
}

export function getCustomComponentOptions() {
  return getAllEquipmentComponents().map((component) => ({
    id: component.id,
    label: `${component.sourceLabel} - ${getComponentDisplayLabel(component)}`,
    type: component.sourceType,
    typeLabel: component.sourceLabel,
    component,
  }));
}

import { AHU_COMPS, AHU_COMPANION_POINTS, normalizeAhuCfg } from "@/modules/hvac-estimator/components/ahu/ahuData";
import { normalizeVavCfg } from "@/modules/hvac-estimator/components/vav/vavData";
import type { ProjectHubSystemKey } from "@/data/projecthub/projecthub-data";

export type EstimatorSelectionEntry = {
  id: string;
  qty: number;
};

export type ProjectHubGraphicsSource = {
  systemKey: ProjectHubSystemKey;
  selectedOntologyIds: string[];
  selectedSelectionIds: string[];
  selectedSelectionLabelsById: Record<string, string>;
  selectedSelectionRolesById: Record<string, string>;
  selectedTemplateKeysBySelectionId: Record<string, string[]>;
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

function toDisplayLabel(value: string) {
  const tokens = value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return tokens
    .map((token) => {
      const upper = token.toUpperCase();
      if (/^(VFD|OA|RA|EA|SA|DA|CHW|HW|PH|CLG|RH|MAD|MOAD|GEF|RAT|DAT|DAP|RAP|CWS|CWR|CHWS|CHWR|FB)$/i.test(upper)) {
        return upper;
      }
      return upper.slice(0, 1) + upper.slice(1).toLowerCase();
    })
    .join(" ");
}

const VAV_ONTOLOGY_BY_COMPONENT: Record<string, string[]> = {
  "vav-act": ["damper_position"],
  "vav-act-incr": ["damper_position"],
  "flow-sensor": ["supply_air_flow"],
  "vav-ctrl": ["zone_setpoint", "supply_air_flow_setpoint"],
  "zn-temp": ["zone_temperature"],
  "zn-co2": ["zone_temperature"],
  "disch-temp": ["supply_air_temperature"],
  "elec-heat": ["heating_output"],
  "rh-valve": ["heating_output"],
  "rh-valve-2pos": ["heating_output"],
  "rh-valve-incr": ["heating_output"],
};

const AHU_ONTOLOGY_BY_COMPONENT: Record<string, string[]> = {
  "oa-temp": ["outdoor_air_temperature"],
  "oa-rh": ["outdoor_air_humidity"],
  "oa-damper": ["mixed_air_damper_position"],
  "ea-damper": ["mixed_air_damper_position"],
  "ra-damper": ["mixed_air_damper_position"],
  "min-oa-d": ["mixed_air_damper_position"],
  "fab-damper": ["mixed_air_damper_position"],
  "plate-bypass": ["mixed_air_damper_position"],
  "filter-dp": ["prefilter_status"],
  "ph-valve": ["preheat_output"],
  "ph-valve-2pos": ["preheat_output"],
  "ph-steam-valve": ["preheat_output"],
  "htg-valve": ["heating_output"],
  "htg-valve-2pos": ["heating_output"],
  "htg-valve-incr": ["heating_output"],
  "htg-steam-valve": ["heating_output"],
  "rh-valve": ["heating_output"],
  "rh-valve-2pos": ["heating_output"],
  "rh-valve-incr": ["heating_output"],
  "rh-elec-heat": ["heating_output"],
  "clg-valve": ["cooling_output"],
  "clg-valve-2pos": ["cooling_output"],
  "clg-dx-staged": ["cooling_output"],
  "sa-temp": ["supply_air_temperature", "discharge_air_temperature"],
  "ra-temp": ["return_air_temperature"],
  "sa-static": ["discharge_air_pressure_setpoint"],
  "sf-starter": ["supply_fan_command"],
  "vfd-sf": ["supply_fan_command", "vfd_fault"],
  "rf-starter": ["return_fan_command"],
  "vfd-rf": ["return_fan_command"],
};

const AHU_COMPANION_TEMPLATE_KEYS_BY_COMPONENT: Record<string, string[]> = {
  "htg-valve-position": ["PH-POS"],
  "clg-valve-position": ["CLG-POS"],
  "rh-valve-position": ["RH-POS"],
  "mixed-air-damper-position": ["MOAD-C"],
};

const AHU_TEMPLATE_KEYS_BY_SELECTION_ID: Record<string, string[]> = {
  "oa-temp": ["CC-T"],
  "ma-temp": ["MA-T"],
  "sa-temp": ["DA-T", "DAT-SP"],
  "ra-temp": ["RA-T", "RAT-SP"],
  "hw-sup-t": ["PHWL-T"],
  "hw-ret-t": ["PHWE-T"],
  "chw-sup-t": ["CCWE-T"],
  "chw-ret-t": ["CCWL-T"],
  "oa-rh": ["RH-O"],
  "ra-rh": ["RA-H", "RAH-SP"],
  "sa-static": ["DAP-SP"],
  "ra-static": ["RAP-SP"],
  "oa-damper": ["MOAD-S", "MOAD-C"],
  "ra-damper": ["MAD-O"],
  "ea-damper": ["GEF-S"],
  "min-oa-d": ["MOAD-S", "MOAD-C"],
  "filter-dp": ["PFILT-S", "FFILT-S"],
  "ph-valve": ["PH-O"],
  "ph-valve-2pos": ["PH-O"],
  "ph-steam-valve": ["PH-O"],
  "htg-valve": ["PH-O"],
  "htg-valve-2pos": ["PH-O"],
  "htg-valve-incr": ["PH-O"],
  "htg-steam-valve": ["PH-O"],
  "rh-valve": ["RH-O"],
  "rh-valve-2pos": ["RH-O"],
  "rh-valve-incr": ["RH-O"],
  "rh-elec-heat": ["RH-O"],
  "clg-valve": ["CLG-O", "CLG-POS", "CC-T"],
  "clg-valve-2pos": ["CLG-O", "CLG-POS", "CC-T"],
  "clg-dx-staged": [],
  "vfd-sf": ["SF-C", "SF-S", "SF-O"],
  "sf-starter": ["SF-C", "SF-S", "SF-O"],
  "vfd-rf": ["RF-C", "RF-S", "RF-O"],
  "rf-starter": ["RF-C", "RF-S", "RF-O"],
  "smoke-sa": ["DA-SD"],
  "smoke-ra": ["RA-SD"],
  "htg-valve-position": ["PH-POS"],
  "clg-valve-position": ["CLG-POS"],
  "rh-valve-position": ["RH-POS"],
  "mixed-air-damper-position": ["MOAD-C"],
};

const AHU_SELECTION_LABELS_BY_ID: Record<string, string> = Object.fromEntries([
  ...AHU_COMPS.map((comp) => [comp.id, comp.name]),
  ...AHU_COMPANION_POINTS.map((point) => [point.companionPointId, point.companionLabel]),
]);

const AHU_SELECTION_ROLES_BY_ID: Record<string, string> = Object.fromEntries([
  ...AHU_COMPS.map((comp) => [comp.id, comp.cat || ""]),
  ...AHU_COMPANION_POINTS.map((point) => [point.companionPointId, point.companionRole]),
]);

const FCU_ONTOLOGY_BY_COMPONENT: Record<string, string[]> = {
  "fcu-ctrl": ["zone_setpoint"],
  "fcu-tec": ["zone_setpoint"],
  "fcu-da-t": ["supply_air_temperature"],
  "fcu-fan-cs": ["supply_fan_status"],
  "fcu-fan-spd-adj": ["supply_fan_status"],
};

const PLANT_ONTOLOGY_BY_COMPONENT: Record<string, Record<string, string[]>> = {
  "chiller-air": {
    "ach-io": ["chiller_enable", "chiller_status"],
    "ach-chw-sup": ["chilled_water_supply_temperature"],
    "ach-chw-ret": ["chilled_water_return_temperature"],
    "ach-iso-vlv": ["chilled_water_isolation_valve_command"],
    "ach-flow": ["chilled_water_differential_pressure"],
  },
  "chiller-water": {
    "wch-io": ["chiller_enable", "chiller_status"],
    "wch-chw-sup": ["chilled_water_supply_temperature"],
    "wch-chw-ret": ["chilled_water_return_temperature"],
    "wch-cond-sup": ["condenser_water_entering_temperature"],
    "wch-cond-ret": ["condenser_water_leaving_temperature"],
    "wch-iso-vlv": ["chilled_water_isolation_valve_command"],
    "wch-flow": ["chilled_water_differential_pressure"],
  },
  "boiler-hw": {
    "bhw-sup-t": ["primary_hot_water_supply_temperature"],
    "bhw-ret-t": ["primary_hot_water_return_temperature"],
  },
  "boiler-steam": {
    "bst-press": ["steam_pressure"],
  },
};

export function resolveProjectHubGraphicsSource(type: string, cfg: Record<string, unknown>, selected: EstimatorSelectionEntry[]): ProjectHubGraphicsSource | null {
  const normalizedSelected = unique(selected.map((entry) => entry.id));

  if (type === "vav") {
    const normalized = normalizeVavCfg(cfg);
    const systemKey: ProjectHubSystemKey = normalized.fanType === "parallel" ? "vav_parallel_fan" : "vav_single_duct";
    const selectedOntologyIds = unique([
      ...normalizedSelected.flatMap((id) => VAV_ONTOLOGY_BY_COMPONENT[id] || []),
      ...(normalized.fanType === "parallel" ? ["supply_fan_status"] : []),
    ]);
    const selectedSelectionIds = normalizedSelected;
    return {
      systemKey,
      selectedOntologyIds,
      selectedSelectionIds,
      selectedSelectionLabelsById: Object.fromEntries(selectedSelectionIds.map((id) => [id, toDisplayLabel(id)])),
      selectedSelectionRolesById: Object.fromEntries(selectedSelectionIds.map((id) => [id, ""])),
      selectedTemplateKeysBySelectionId: Object.fromEntries(selectedSelectionIds.map((id) => [id, []])),
    };
  }

  if (type === "ahu") {
    const normalized = normalizeAhuCfg(cfg);
    if (normalized.ahuType !== "mixed") {
      return null;
    }
    const systemKey: ProjectHubSystemKey =
      normalized.returnFanConfig === "dual" || normalized.supplyFanConfig === "dual"
        ? "mixed_air_dual_point_ahu"
        : "mixed_air_single_point_ahu";
    const selectedOntologyIds = unique(
      [
        ...normalizedSelected.flatMap((id) => AHU_ONTOLOGY_BY_COMPONENT[id] || []),
        ...normalizedSelected.flatMap((id) => AHU_COMPANION_TEMPLATE_KEYS_BY_COMPONENT[id] || []),
      ]
    );
    const selectedSelectionIds = normalizedSelected;
    return {
      systemKey,
      selectedOntologyIds,
      selectedSelectionIds,
      selectedSelectionLabelsById: Object.fromEntries(
        selectedSelectionIds.map((id) => [id, AHU_SELECTION_LABELS_BY_ID[id] || toDisplayLabel(id)])
      ),
      selectedSelectionRolesById: Object.fromEntries(
        selectedSelectionIds.map((id) => [id, AHU_SELECTION_ROLES_BY_ID[id] || ""])
      ),
      selectedTemplateKeysBySelectionId: Object.fromEntries(
        selectedSelectionIds.map((id) => [id, unique(AHU_TEMPLATE_KEYS_BY_SELECTION_ID[id] || [])])
      ),
    };
  }

  if (type === "fcu") {
    const systemKey: ProjectHubSystemKey = "fcu_single_point";
    const selectedOntologyIds = unique(
      normalizedSelected.flatMap((id) => FCU_ONTOLOGY_BY_COMPONENT[id] || [])
    );
    const selectedSelectionIds = normalizedSelected;
    return {
      systemKey,
      selectedOntologyIds,
      selectedSelectionIds,
      selectedSelectionLabelsById: Object.fromEntries(selectedSelectionIds.map((id) => [id, toDisplayLabel(id)])),
      selectedSelectionRolesById: Object.fromEntries(selectedSelectionIds.map((id) => [id, ""])),
      selectedTemplateKeysBySelectionId: Object.fromEntries(selectedSelectionIds.map((id) => [id, []])),
    };
  }

  if (type === "plant") {
    const plantType = String(cfg?.plantType || "");
    const systemKey =
      plantType === "chiller-water"
        ? "dual_chiller_cws"
        : plantType === "chiller-air"
          ? "single_chiller_primary_chws_free_cooling"
          : plantType === "boiler-steam" || plantType === "boiler-hw"
            ? "two_steam_hx_hot_water"
            : null;

    if (!systemKey) return null;

    const selectedOntologyIds = unique(
      normalizedSelected.flatMap((id) => (PLANT_ONTOLOGY_BY_COMPONENT[plantType]?.[id] || []))
    );
    const selectedSelectionIds = normalizedSelected;
    return {
      systemKey,
      selectedOntologyIds,
      selectedSelectionIds,
      selectedSelectionLabelsById: Object.fromEntries(selectedSelectionIds.map((id) => [id, toDisplayLabel(id)])),
      selectedSelectionRolesById: Object.fromEntries(selectedSelectionIds.map((id) => [id, ""])),
      selectedTemplateKeysBySelectionId: Object.fromEntries(selectedSelectionIds.map((id) => [id, []])),
    };
  }

  return null;
}

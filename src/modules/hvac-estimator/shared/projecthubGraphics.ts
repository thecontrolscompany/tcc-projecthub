import { normalizeAhuCfg } from "@/modules/hvac-estimator/components/ahu/ahuData";
import { normalizeVavCfg } from "@/modules/hvac-estimator/components/vav/vavData";
import type { ProjectHubSystemKey } from "@/data/projecthub/projecthub-data";

export type EstimatorSelectionEntry = {
  id: string;
  qty: number;
};

export type ProjectHubGraphicsSource = {
  systemKey: ProjectHubSystemKey;
  selectedOntologyIds: string[];
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

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
  "oa-damper": ["mixed_air_damper_position"],
  "ea-damper": ["mixed_air_damper_position"],
  "ra-damper": ["mixed_air_damper_position"],
  "min-oa-d": ["mixed_air_damper_position"],
  "fab-damper": ["mixed_air_damper_position"],
  "plate-bypass": ["mixed_air_damper_position"],
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
};

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
    return { systemKey, selectedOntologyIds };
  }

  if (type === "ahu") {
    const normalized = normalizeAhuCfg(cfg);
    const systemKey: ProjectHubSystemKey =
      normalized.returnFanConfig === "dual" || normalized.supplyFanConfig === "dual"
        ? "mixed_air_dual_point_ahu"
        : "mixed_air_single_point_ahu";
    const selectedOntologyIds = unique(
      normalizedSelected.flatMap((id) => AHU_ONTOLOGY_BY_COMPONENT[id] || [])
    );
    return { systemKey, selectedOntologyIds };
  }

  if (type === "fcu") {
    const systemKey: ProjectHubSystemKey = "fcu_single_point";
    const selectedOntologyIds = unique(
      normalizedSelected.flatMap((id) => FCU_ONTOLOGY_BY_COMPONENT[id] || [])
    );
    return { systemKey, selectedOntologyIds };
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
    return { systemKey, selectedOntologyIds };
  }

  return null;
}

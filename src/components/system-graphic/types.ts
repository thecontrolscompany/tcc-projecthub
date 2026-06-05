export type DeviceType =
  | 'supply_fan' | 'return_fan' | 'exhaust_fan' | 'fan'
  | 'cooling_coil' | 'heating_coil' | 'preheat_coil' | 'steam_coil' | 'coil'
  | 'chw_valve' | 'hw_valve' | 'steam_valve' | 'valve_2way' | 'valve_3way' | 'valve'
  | 'oa_damper' | 'ra_damper' | 'ea_damper' | 'damper'
  | 'temp_sensor' | 'humidity_sensor' | 'pressure_sensor' | 'dp_sensor'
  | 'flow_sensor' | 'co2_sensor'
  | 'vfd' | 'pump' | 'chiller' | 'boiler' | 'cooling_tower' | 'heat_exchanger'
  | 'filter' | 'heat_wheel' | 'humidifier'
  | 'controller' | 'vav_controller' | 'panel' | 'network_device'
  | 'unknown';

export interface AnchorPoint {
  x: number;
  y: number;
  device_type: DeviceType;
  ontology_id?: string;
  display_label?: string;
  svg_element_id?: string;
  svg_element_kind?: string;
  svg_x?: number;
  svg_y?: number;
  confidence_score?: number;
  match_reason?: string;
  visio_source_file?: string;
  visio_stencil_name?: string;
  visio_master_name?: string;
  visio_shape_name?: string;
  visio_group_name?: string;
  source_kind?: string;
  source_system?: string;
  source_key?: string;
  link_status?: string;
}

export interface ShapeRecord {
  name: string;
  text: string;
  device_type: DeviceType;
  x: number;
  y: number;
  width_in: number;
  height_in: number;
  depth: number;
  ontology_id?: string;
  display_label?: string;
  svg_element_id?: string;
  svg_element_kind?: string;
  svg_x?: number;
  svg_y?: number;
  confidence_score?: number;
  match_reason?: string;
  visio_source_file?: string;
  visio_stencil_name?: string;
  visio_master_name?: string;
  visio_shape_name?: string;
  visio_group_name?: string;
  source_kind?: string;
  source_system?: string;
  source_key?: string;
  link_status?: string;
}

export interface SystemMetadata {
  system: string;
  page: string;
  page_width_px: number;
  page_height_px: number;
  equipment: DeviceType[];
  sensors: DeviceType[];
  anchors: Record<string, AnchorPoint>;
  shapes: ShapeRecord[];
}

export interface DeviceConfig {
  key: string;
  label: string;
  device_type: DeviceType;
  visible: boolean;
  x?: number;
  y?: number;
  ontology_id?: string;
  display_label?: string;
  svg_element_id?: string;
  svg_element_kind?: string;
  svg_x?: number;
  svg_y?: number;
  confidence_score?: number;
  match_reason?: string;
  visio_source_file?: string;
  visio_stencil_name?: string;
  visio_master_name?: string;
  visio_shape_name?: string;
  visio_group_name?: string;
  source_kind?: string;
  source_system?: string;
  source_key?: string;
  link_status?: string;
}

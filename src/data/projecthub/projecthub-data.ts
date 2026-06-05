import ontologyData from './projecthub_point_ontology.json';
import linkedAssetsData from './projecthub_graphics_assets_linked.json';
import type { DeviceType, ShapeRecord, SystemMetadata } from '@/components/system-graphic/types';

export type ProjectHubSystemKey =
  | 'vav_single_duct'
  | 'vav_parallel_fan'
  | 'mixed_air_single_point_ahu'
  | 'mixed_air_dual_point_ahu'
  | 'single_chiller_primary_chws_free_cooling'
  | 'dual_chiller_cws'
  | 'two_steam_hx_hot_water'
  | 'fcu_single_point';

export interface ProjectHubLinkedAsset {
  asset_id: string;
  ontology_id: string;
  ontology_label: string;
  ontology_point_type?: string;
  ontology_role_category?: string;
  ontology_equipment_families?: string[];
  source_kind?: string;
  source_system: ProjectHubSystemKey | string;
  visio_source_file: string;
  visio_stencil_name: string;
  visio_master_name?: string;
  visio_shape_name?: string;
  visio_group_name?: string;
  svg_export_file: string;
  svg_id?: string;
  confidence_score: number;
  match_reason: string;
  notes?: string;
  metadata_page: string;
  metadata_page_width_px: number;
  metadata_page_height_px: number;
  anchor_x: number;
  anchor_y: number;
  anchor_device_type: string;
  anchor_source_name: string;
  svg_x?: number;
  svg_y?: number;
  svg_element_id?: string;
  svg_element_kind?: string;
  link_status?: string;
}

interface ProjectHubOntologyPoint {
  canonical_point_id: string;
  display_label: string;
  equipment_families: string[];
  point_type?: string;
  role_category?: string;
}

interface ProjectHubLinkedAssetsFile {
  generated_at?: string;
  assets: ProjectHubLinkedAsset[];
}

interface ProjectHubOntologyFile {
  ontology_name?: string;
  generated_at?: string;
  source_families?: Array<{ family: string; file: string }>;
  canonical_points: ProjectHubOntologyPoint[];
}

const ONTOLOGY_DATA = ontologyData as ProjectHubOntologyFile;
const LINKED_ASSETS_DATA = linkedAssetsData as ProjectHubLinkedAssetsFile;

export const PROJECTHUB_SYSTEMS: Array<{ key: ProjectHubSystemKey; label: string }> = [
  { key: 'vav_single_duct', label: 'VAV Single Duct' },
  { key: 'vav_parallel_fan', label: 'VAV Parallel Fan' },
  { key: 'mixed_air_single_point_ahu', label: 'Mixed Air AHU (Single Point)' },
  { key: 'mixed_air_dual_point_ahu', label: 'Mixed Air AHU (Dual Point)' },
  { key: 'single_chiller_primary_chws_free_cooling', label: 'Single Chiller Primary CHWS Free Cooling' },
  { key: 'dual_chiller_cws', label: 'Dual Chiller CWS' },
  { key: 'two_steam_hx_hot_water', label: 'Two Steam HX Hot Water' },
  { key: 'fcu_single_point', label: 'FCU Single Point' },
];

const DEVICE_TYPE_SET = new Set<string>([
  'supply_fan',
  'return_fan',
  'exhaust_fan',
  'fan',
  'cooling_coil',
  'heating_coil',
  'preheat_coil',
  'steam_coil',
  'coil',
  'chw_valve',
  'hw_valve',
  'steam_valve',
  'valve_2way',
  'valve_3way',
  'valve',
  'oa_damper',
  'ra_damper',
  'ea_damper',
  'damper',
  'temp_sensor',
  'humidity_sensor',
  'pressure_sensor',
  'dp_sensor',
  'flow_sensor',
  'co2_sensor',
  'vfd',
  'pump',
  'chiller',
  'boiler',
  'cooling_tower',
  'heat_exchanger',
  'filter',
  'heat_wheel',
  'humidifier',
  'controller',
  'vav_controller',
  'panel',
  'network_device',
]);

const SENSOR_TYPES = new Set<DeviceType>([
  'temp_sensor',
  'humidity_sensor',
  'pressure_sensor',
  'dp_sensor',
  'flow_sensor',
  'co2_sensor',
]);

const assetsBySystem = new Map<ProjectHubSystemKey, ProjectHubLinkedAsset[]>();
for (const asset of LINKED_ASSETS_DATA.assets) {
  const systemKey = asset.source_system as ProjectHubSystemKey;
  if (!assetsBySystem.has(systemKey)) {
    assetsBySystem.set(systemKey, []);
  }
  assetsBySystem.get(systemKey)!.push(asset);
}

const ontologyById = new Map<string, ProjectHubOntologyPoint>();
for (const point of ONTOLOGY_DATA.canonical_points) {
  ontologyById.set(point.canonical_point_id, point);
}

function normalizeDeviceType(value: string | undefined): DeviceType {
  if (value && DEVICE_TYPE_SET.has(value)) {
    return value as DeviceType;
  }
  return 'unknown';
}

function assetToAnchor(asset: ProjectHubLinkedAsset) {
  const x = Number.isFinite(asset.svg_x ?? NaN) ? (asset.svg_x as number) : asset.anchor_x;
  const y = Number.isFinite(asset.svg_y ?? NaN) ? (asset.svg_y as number) : asset.anchor_y;
  return {
    x,
    y,
    device_type: normalizeDeviceType(asset.anchor_device_type),
    ontology_id: asset.ontology_id,
    display_label: asset.ontology_label,
    svg_element_id: asset.svg_element_id || asset.svg_id || '',
    svg_element_kind: asset.svg_element_kind || '',
    svg_x: asset.svg_x,
    svg_y: asset.svg_y,
    confidence_score: asset.confidence_score,
    match_reason: asset.match_reason,
    visio_source_file: asset.visio_source_file,
    visio_stencil_name: asset.visio_stencil_name,
    visio_master_name: asset.visio_master_name,
    visio_shape_name: asset.visio_shape_name,
    visio_group_name: asset.visio_group_name,
    source_kind: asset.source_kind || 'metadata_anchor',
    source_system: asset.source_system,
    source_key: asset.anchor_source_name,
    link_status: asset.link_status,
  };
}

function assetToShape(asset: ProjectHubLinkedAsset): ShapeRecord {
  return {
    name: asset.anchor_source_name,
    text: asset.ontology_label,
    device_type: normalizeDeviceType(asset.anchor_device_type),
    x: asset.svg_x ?? asset.anchor_x,
    y: asset.svg_y ?? asset.anchor_y,
    width_in: 0,
    height_in: 0,
    depth: 0,
    ontology_id: asset.ontology_id,
    display_label: asset.ontology_label,
    svg_element_id: asset.svg_element_id || asset.svg_id || '',
    svg_element_kind: asset.svg_element_kind || '',
    svg_x: asset.svg_x,
    svg_y: asset.svg_y,
    confidence_score: asset.confidence_score,
    match_reason: asset.match_reason,
    visio_source_file: asset.visio_source_file,
    visio_stencil_name: asset.visio_stencil_name,
    visio_master_name: asset.visio_master_name,
    visio_shape_name: asset.visio_shape_name,
    visio_group_name: asset.visio_group_name,
    source_kind: asset.source_kind || 'metadata_anchor',
    source_system: asset.source_system,
    source_key: asset.anchor_source_name,
    link_status: asset.link_status,
  };
}

export function getOntologyPoint(ontologyId: string) {
  return ontologyById.get(ontologyId) ?? null;
}

export function getSystemAssets(systemKey: ProjectHubSystemKey) {
  return [...(assetsBySystem.get(systemKey) ?? [])].sort((a, b) =>
    a.ontology_label.localeCompare(b.ontology_label)
  );
}

export function getSystemSvgUrl(systemKey: ProjectHubSystemKey) {
  return `/projecthub/svgs/${systemKey}.svg`;
}

export function buildSystemMetadata(systemKey: ProjectHubSystemKey): SystemMetadata | null {
  const assets = getSystemAssets(systemKey);
  if (assets.length === 0) return null;

  const first = assets[0];
  const anchors = Object.fromEntries(assets.map((asset) => [asset.ontology_id, assetToAnchor(asset)]));
  const shapes = assets.map(assetToShape);
  const equipment = Array.from(new Set(assets.map((asset) => normalizeDeviceType(asset.anchor_device_type))));
  const sensors = equipment.filter((type) => SENSOR_TYPES.has(type));

  return {
    system: systemKey,
    page: first.metadata_page || 'ProjectHub',
    page_width_px: first.metadata_page_width_px || 1000,
    page_height_px: first.metadata_page_height_px || 800,
    equipment,
    sensors,
    anchors,
    shapes,
  };
}

export function getSystemPreviewLabel(systemKey: ProjectHubSystemKey) {
  return PROJECTHUB_SYSTEMS.find((system) => system.key === systemKey)?.label ?? systemKey;
}

export function getSelectedAsset(systemKey: ProjectHubSystemKey, ontologyId: string) {
  return getSystemAssets(systemKey).find((asset) => asset.ontology_id === ontologyId) ?? null;
}


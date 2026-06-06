export type ProjectHubSystemTemplateRegistryFile = {
  generated_at: string;
  templates: ProjectHubSystemTemplateRegistryEntry[];
};

export type ProjectHubSystemTemplateRegistryEntry = {
  template_id: string;
  display_name: string;
  equipment_family: string;
  system_type: string;
  normalized_template_path: string;
  asset_base_path: string;
  point_manifest_path: string;
  visibility_manifest_path?: string;
  supported_ontology_ids: string[];
  ontology_crosswalk: Record<string, string>;
  unmapped_source_points: string[];
  fallback_symbol_roles: string[];
  fallback_symbol_overlays?: Record<string, string[]>;
  replacement_ready: boolean;
  notes: string[];
  private_source_bundle_path?: string;
};

export type ProjectHubSystemTemplatePointManifestEntry = {
  source_short_name: string;
  label: string;
  svg_group_id: string;
  candidate_ontology_id: string;
  x?: number | null;
  y?: number | null;
  notes?: string;
  data_filter?: string;
};

export type ProjectHubSystemTemplatePointManifestFile = {
  generated_at?: string;
  source_file?: string;
  points: ProjectHubSystemTemplatePointManifestEntry[];
};

export type ProjectHubSystemTemplateVisibilityMode = 'hide_when_unselected' | 'highlight_when_selected';

export type ProjectHubSystemTemplateVisibilityRule = {
  source_short_name: string;
  ontology_id: string | null;
  label: string;
  label_group_ids: string[];
  device_group_ids: string[];
  image_selectors: string[];
  fallback_selectors: string[];
  visibility_mode: ProjectHubSystemTemplateVisibilityMode;
  notes: string;
  confidence: number;
};

export type ProjectHubSystemTemplateVisibilityManifestFile = {
  template_id: string;
  generated_at?: string;
  source_file?: string;
  rules: ProjectHubSystemTemplateVisibilityRule[];
};

export type ProjectHubSystemTemplateMatchResult = {
  template: ProjectHubSystemTemplateRegistryEntry | null;
  matchedOntologyIds: string[];
  unmatchedOntologyIds: string[];
  score: number;
};

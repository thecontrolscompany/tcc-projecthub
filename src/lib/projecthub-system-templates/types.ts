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
  candidate_ontology_ids: string[];
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
  source_attributes?: Record<string, string>;
  confidence?: number;
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
  candidate_ontology_ids?: string[];
  label: string;
  label_group_ids: string[];
  value_group_ids?: string[];
  device_group_ids: string[];
  image_selectors: string[];
  fallback_selectors: string[];
  related_node_ids?: string[];
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

export type ProjectHubTemplateGraphicPackage = {
  template: {
    template_id: string;
    display_name: string;
    equipment_family: string;
    system_type: string;
    notes: string[];
    replacement_ready: boolean;
  };
  svg_markup: string;
  visibility_rules: ProjectHubSystemTemplateVisibilityRule[];
  cleanup_rules: ProjectHubSystemTemplateCleanupRule[];
  selection_keys_by_ontology_id: Record<string, string[]>;
};

export type ProjectHubSystemTemplateCleanupMode = 'hide' | 'show';

export type ProjectHubSystemTemplateCleanupAttributeMatch = {
  name: string;
  contains: string;
};

export type ProjectHubSystemTemplateCleanupRule = {
  rule_id: string;
  description: string;
  mode: ProjectHubSystemTemplateCleanupMode;
  selectors?: string[];
  text_matches?: string[];
  attribute_matches?: ProjectHubSystemTemplateCleanupAttributeMatch[];
  ancestor_selectors?: string[];
  hide_descendants?: boolean;
  template_ids?: string[];
  exclude_template_ids?: string[];
  manual_review_required?: boolean;
  notes?: string;
};

export type ProjectHubSystemTemplateCleanupConfig = {
  generated_at?: string;
  rules: ProjectHubSystemTemplateCleanupRule[];
  template_overrides?: {
    template_id: string;
    rule_ids: string[];
  }[];
};

export type ProjectHubSystemTemplateMatchResult = {
  template: ProjectHubSystemTemplateRegistryEntry | null;
  matchedOntologyIds: string[];
  unmatchedOntologyIds: string[];
  score: number;
};

export type ProjectHubTemplatePointAliasEntry = {
  source_short_name: string;
  normalized_alias: string;
  display_label: string;
  candidate_ontology_id: string | null;
  candidate_ontology_ids: string[];
  estimator_point_role: string;
  equipment_family: string;
  templates_seen_in: string[];
  confidence: number;
  notes: string;
  manual_review_required: boolean;
};

export type ProjectHubTemplatePointAliasFile = {
  generated_at: string;
  aliases: ProjectHubTemplatePointAliasEntry[];
};

export type TemplatePointAlias = ProjectHubTemplatePointAliasEntry;

export type TemplatePointAliasConfidence = number;

export type TemplatePointAliasRole = string;

export type TemplatePointAliasLookupOptions = {
  templateId?: string;
  includeManualReview?: boolean;
};

export type TemplatePointAliasLookupResult = {
  alias: TemplatePointAlias | null;
  source_short_name: string;
  ontology_id: string | null;
  candidate_ontology_ids: string[];
  estimator_point_role: TemplatePointAliasRole;
  confidence: TemplatePointAliasConfidence;
  manual_review_required: boolean;
  template_ids: string[];
  visibility_keys: string[];
};

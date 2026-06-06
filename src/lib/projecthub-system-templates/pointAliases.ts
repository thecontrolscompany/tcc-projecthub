import 'server-only';

import aliasData from '@/data/projecthub/system-templates/projecthub_template_point_aliases.json';
import type {
  ProjectHubSystemTemplateVisibilityRule,
  TemplatePointAlias,
  TemplatePointAliasLookupOptions,
  TemplatePointAliasLookupResult,
  TemplatePointAliasRole,
} from './types';
import {
  getTemplateVisibilityRules,
  listSystemTemplates,
} from './systemTemplateRegistry';

type TemplatePointAliasFileLike = {
  aliases?: TemplatePointAlias[];
};

const ALIASES = ((aliasData as unknown) as TemplatePointAliasFileLike).aliases ?? [];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function matchesTemplateId(alias: TemplatePointAlias, templateId?: string) {
  if (!templateId) return true;
  return alias.templates_seen_in.includes(templateId);
}

function buildVisibilityKeys(rule: ProjectHubSystemTemplateVisibilityRule) {
  return uniq([
    ...(rule.label_group_ids ?? []),
    ...(rule.value_group_ids ?? []),
    ...(rule.device_group_ids ?? []),
    ...(rule.related_node_ids ?? []),
    ...(rule.fallback_selectors ?? []),
    ...(rule.image_selectors ?? []),
  ]);
}

function buildLookupResult(alias: TemplatePointAlias | null, options: TemplatePointAliasLookupOptions = {}): TemplatePointAliasLookupResult {
  const templateIds = alias
    ? options.templateId
      ? alias.templates_seen_in.includes(options.templateId)
        ? [options.templateId]
        : []
      : uniq(alias.templates_seen_in)
    : [];
  const selectedAlias = alias ?? null;
  const visibilityKeys = alias
    ? uniq(
        templateIds.flatMap((templateId) =>
          (getTemplateVisibilityRules(templateId) ?? [])
            .filter((rule) => normalize(rule.source_short_name) === normalize(alias.source_short_name))
            .flatMap((rule) => buildVisibilityKeys(rule))
        )
      )
    : [];

  return {
    alias: selectedAlias,
    source_short_name: alias?.source_short_name ?? '',
    ontology_id: alias?.candidate_ontology_id ?? null,
    candidate_ontology_ids: alias?.candidate_ontology_ids ?? [],
    estimator_point_role: alias?.estimator_point_role ?? 'unmapped',
    confidence: alias?.confidence ?? 0,
    manual_review_required: alias?.manual_review_required ?? true,
    template_ids: templateIds,
    visibility_keys: visibilityKeys,
  };
}

function filterAliases(predicate: (alias: TemplatePointAlias) => boolean, options: TemplatePointAliasLookupOptions = {}) {
  return ALIASES
    .filter(predicate)
    .filter((alias) => matchesTemplateId(alias, options.templateId))
    .filter((alias) => options.includeManualReview === false ? !alias.manual_review_required : true)
    .map((alias) => buildLookupResult(alias, options));
}

export function getAliasForSourceShortName(
  sourceShortName: string,
  options: TemplatePointAliasLookupOptions = {}
): TemplatePointAliasLookupResult {
  const normalized = normalize(sourceShortName);
  const alias = ALIASES.find((entry) => normalize(entry.source_short_name) === normalized) ?? null;
  if (!alias) {
    return {
      alias: null,
      source_short_name: sourceShortName,
      ontology_id: null,
      candidate_ontology_ids: [],
      estimator_point_role: 'unmapped',
      confidence: 0,
      manual_review_required: true,
      template_ids: [],
      visibility_keys: [],
    };
  }

  if (options.includeManualReview === false && alias.manual_review_required) {
    return {
      alias: null,
      source_short_name: sourceShortName,
      ontology_id: null,
      candidate_ontology_ids: [],
      estimator_point_role: 'unmapped',
      confidence: 0,
      manual_review_required: true,
      template_ids: [],
      visibility_keys: [],
    };
  }

  return buildLookupResult(alias, options);
}

export function getAliasesForOntologyId(
  ontologyId: string,
  options: TemplatePointAliasLookupOptions = {}
): TemplatePointAliasLookupResult[] {
  const normalized = normalize(ontologyId);
  return filterAliases(
    (alias) =>
      normalize(alias.candidate_ontology_id ?? '') === normalized ||
      alias.candidate_ontology_ids.some((candidate) => normalize(candidate) === normalized),
    options
  );
}

export function getAliasesForTemplate(templateId: string, options: TemplatePointAliasLookupOptions = {}) {
  return filterAliases((alias) => alias.templates_seen_in.includes(templateId), {
    ...options,
    templateId,
  });
}

export function getVisibilityKeysForOntologyId(templateId: string, ontologyId: string) {
  const aliases = getAliasesForOntologyId(ontologyId, { templateId });
  return uniq(aliases.flatMap((alias) => alias.visibility_keys.length ? alias.visibility_keys : [alias.source_short_name]));
}

export function getEstimatorRoleForSourceShortName(sourceShortName: string): TemplatePointAliasRole | null {
  const result = getAliasForSourceShortName(sourceShortName);
  return result.alias ? result.estimator_point_role : null;
}

export function listTemplatePointAliases() {
  return [...ALIASES];
}

export function listTemplatesWithAliasCoverage() {
  return listSystemTemplates().map((template) => ({
    template_id: template.template_id,
    display_name: template.display_name,
    alias_count: ALIASES.filter((alias) => alias.templates_seen_in.includes(template.template_id)).length,
  }));
}

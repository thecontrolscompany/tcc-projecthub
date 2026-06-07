import 'server-only';

import fs from 'node:fs';
import path from 'node:path';

import registryData from '@/data/projecthub/system-templates/projecthub_system_template_registry.json';
import cleanupRulesData from '@/data/projecthub/system-templates/projecthub_template_cleanup_rules.json';
import type {
  ProjectHubSystemTemplateCleanupConfig,
  ProjectHubSystemTemplateCleanupRule,
  ProjectHubSystemTemplateMatchResult,
  ProjectHubSystemTemplatePointManifestEntry,
  ProjectHubSystemTemplatePointManifestFile,
  ProjectHubSystemTemplateVisibilityManifestFile,
  ProjectHubSystemTemplateVisibilityRule,
  ProjectHubSystemTemplateRegistryEntry,
  ProjectHubSystemTemplateRegistryFile,
} from './types';

const WORKSPACE_ROOT = process.cwd();
const REGISTRY = registryData as unknown as ProjectHubSystemTemplateRegistryFile;
const CLEANUP_RULES = cleanupRulesData as unknown as ProjectHubSystemTemplateCleanupConfig;

const VIRTUAL_ASSET_ROOT = '/api/system-template-preview/assets';
const DEFAULT_TEMPLATE_ID = 'mixed_air_single_duct';

function normalizeSystemType(systemType: string) {
  return systemType.trim().toLowerCase();
}

function findTemplate(templateIdOrSystemType: string) {
  const needle = normalizeSystemType(templateIdOrSystemType);
  return (
    REGISTRY.templates.find((entry) => entry.template_id === needle) ??
    REGISTRY.templates.find((entry) => normalizeSystemType(entry.system_type) === needle) ??
    null
  );
}

function resolvePrivateBundlePath(entry: ProjectHubSystemTemplateRegistryEntry) {
  const bundlePath = entry.private_source_bundle_path;
  if (!bundlePath) return null;
  return path.resolve(WORKSPACE_ROOT, bundlePath);
}

function resolvePrivateFilePath(entry: ProjectHubSystemTemplateRegistryEntry, relativePath: string) {
  const bundlePath = resolvePrivateBundlePath(entry);
  if (!bundlePath) return null;
  return path.resolve(bundlePath, relativePath);
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function listSystemTemplates() {
  return [...REGISTRY.templates].sort((a, b) => a.display_name.localeCompare(b.display_name));
}

export function getTemplateForSystemType(systemType: string): ProjectHubSystemTemplateRegistryEntry | null {
  return findTemplate(systemType);
}

export function getTemplateForOntologyIds(
  systemType: string,
  ontologyIds: string[]
): ProjectHubSystemTemplateMatchResult {
  const template = findTemplate(systemType);
  if (!template) {
    return {
      template: null,
      matchedOntologyIds: [],
      unmatchedOntologyIds: [...new Set(ontologyIds.map((id) => id.trim()).filter(Boolean))],
      score: 0,
    };
  }

  const selected = new Set(ontologyIds.map((id) => id.trim()).filter(Boolean));
  const matchedOntologyIds = template.supported_ontology_ids.filter((id) => selected.has(id));
  const unmatchedOntologyIds = [...selected].filter((id) => !template.supported_ontology_ids.includes(id));

  return {
    template,
    matchedOntologyIds,
    unmatchedOntologyIds,
    score: template.supported_ontology_ids.length === 0
      ? 0
      : matchedOntologyIds.length / template.supported_ontology_ids.length,
  };
}

export function getPointManifest(templateId: string): ProjectHubSystemTemplatePointManifestEntry[] | null {
  const template = findTemplate(templateId);
  if (!template) return null;

  const manifestPath = resolvePrivateFilePath(template, 'point_manifest.json');
  if (!manifestPath) return null;

  const manifest = readJsonFile<ProjectHubSystemTemplatePointManifestFile>(manifestPath);
  if (!manifest) return null;
  return manifest.points ?? [];
}

export function getTemplateVisibilityRules(templateId: string): ProjectHubSystemTemplateVisibilityRule[] | null {
  const template = findTemplate(templateId);
  if (!template) return null;

  const manifestPath = resolvePrivateFilePath(template, 'point_visibility.json');
  if (!manifestPath) return null;

  const manifest = readJsonFile<ProjectHubSystemTemplateVisibilityManifestFile>(manifestPath);
  return manifest?.rules?.length ? manifest.rules : null;
}

export function getTemplateCleanupRules(templateId: string): ProjectHubSystemTemplateCleanupRule[] {
  const normalizedTemplateId = normalizeSystemType(templateId);
  const override = CLEANUP_RULES.template_overrides?.find((entry) => normalizeSystemType(entry.template_id) === normalizedTemplateId);
  const enabledRuleIds = override?.rule_ids ?? CLEANUP_RULES.rules.map((rule) => rule.rule_id);

  return CLEANUP_RULES.rules.filter((rule) => {
    if (rule.template_ids?.length && !rule.template_ids.map(normalizeSystemType).includes(normalizedTemplateId)) {
      return false;
    }
    if (rule.exclude_template_ids?.length && rule.exclude_template_ids.map(normalizeSystemType).includes(normalizedTemplateId)) {
      return false;
    }
    return enabledRuleIds.includes(rule.rule_id);
  });
}

export function getCleanupConfig() {
  return CLEANUP_RULES;
}

export function getTemplateManifestFile(templateId: string): ProjectHubSystemTemplatePointManifestFile | null {
  const template = findTemplate(templateId);
  if (!template) return null;

  const manifestPath = resolvePrivateFilePath(template, 'point_manifest.json');
  if (!manifestPath) return null;

  return readJsonFile<ProjectHubSystemTemplatePointManifestFile>(manifestPath);
}

export function loadNormalizedTemplateMarkup(templateId: string): string | null {
  const template = findTemplate(templateId);
  if (!template) return null;

  const htmlPath = resolvePrivateFilePath(template, 'normalized_template.html');
  if (!htmlPath || !fs.existsSync(htmlPath)) return null;

  return fs.readFileSync(htmlPath, 'utf8');
}

export function extractTemplateSvgMarkup(templateId: string): string | null {
  const markup = loadNormalizedTemplateMarkup(templateId);
  if (!markup) return null;

  const match = markup.match(/<svg[\s\S]*<\/svg>/i);
  return match ? match[0] : markup;
}

export function getTemplateAssetFilePath(templateId: string, assetPath: string): string | null {
  const template = findTemplate(templateId);
  if (!template) return null;

  const relativeAssetPath = assetPath.replace(/^\/+/, '').replace(/^assets\/?/, '');
  const bundlePath = resolvePrivateBundlePath(template);
  if (!bundlePath) return null;

  const resolved = path.resolve(bundlePath, 'assets', relativeAssetPath);
  const relativeToBundle = path.relative(bundlePath, resolved);
  const isInsideBundle =
    relativeToBundle !== '' &&
    !relativeToBundle.startsWith('..') &&
    !path.isAbsolute(relativeToBundle);

  return isInsideBundle ? resolved : null;
}

export function buildTemplateAssetUrl(templateId: string, assetPath: string) {
  const clean = assetPath.replace(/^\/+/, '');
  return `${VIRTUAL_ASSET_ROOT}/${encodeURIComponent(templateId)}/${clean.split('/').map(encodeURIComponent).join('/')}`;
}

export function getDefaultSystemTemplate() {
  return findTemplate(DEFAULT_TEMPLATE_ID) ?? REGISTRY.templates[0] ?? null;
}

export function getTemplatePreviewTitle(templateId: string) {
  return findTemplate(templateId)?.display_name ?? templateId;
}

export { REGISTRY as PROJECTHUB_SYSTEM_TEMPLATE_REGISTRY };

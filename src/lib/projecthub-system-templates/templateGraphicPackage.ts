import 'server-only';

import {
  extractTemplateSvgMarkup,
  getPointManifest,
  getTemplateCleanupRules,
  getTemplateForSystemType,
  getTemplateVisibilityRules,
} from './systemTemplateRegistry';
import { getVisibilityKeysForOntologyId } from './pointAliases';
import { rewriteTemplateAssetReferences } from './templateAssetReferences';
import type { ProjectHubTemplateGraphicPackage } from './types';

function sanitizeNotes(notes: string[]) {
  return notes.flatMap((note) => {
    if (/source file:/i.test(note) || /program files/i.test(note) || /programdata/i.test(note)) {
      return ['Private source reference retained in debug metadata.'];
    }
    return [note];
  });
}

function stripAliasText(markup: string) {
  return markup
    .replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi, (full, attrs, inner) => {
      if (String(inner).replace(/\s+/g, ' ').trim() !== 'Alias') {
        return full;
      }
      return `<text${attrs}></text>`;
    })
    .replace(/<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/gi, (full, attrs, inner) => {
      if (String(inner).replace(/\s+/g, ' ').trim() !== 'Alias') {
        return full;
      }
      return `<tspan${attrs}></tspan>`;
    })
    .replace(/(<text\b[^>]*?)fill="#000000"/g, '$1fill="#e2e8f0"')
    .replace(/(<text\b[^>]*?)stroke="#000000"/g, '$1stroke="#e2e8f0"')
    .replace(/(<tspan\b[^>]*?)fill="#000000"/g, '$1fill="#e2e8f0"')
    .replace(/(<tspan\b[^>]*?)stroke="#000000"/g, '$1stroke="#e2e8f0"');
}

export function buildTemplateGraphicPackage(templateId: string): ProjectHubTemplateGraphicPackage | null {
  const template = getTemplateForSystemType(templateId);
  if (!template) return null;

  const pointManifest = getPointManifest(template.template_id);
  const visibilityRules = getTemplateVisibilityRules(template.template_id);
  const cleanupRules = getTemplateCleanupRules(template.template_id);
  const svgMarkup = extractTemplateSvgMarkup(template.template_id);
  if (!pointManifest || !visibilityRules || !svgMarkup) return null;

  const selectionKeysByOntologyId: Record<string, string[]> = {};
  pointManifest.forEach((entry) => {
    const ontologyId = entry.candidate_ontology_id?.trim();
    if (!ontologyId) return;
    const keys = [
      ontologyId,
      ...getVisibilityKeysForOntologyId(template.template_id, ontologyId),
      entry.source_short_name,
    ].filter(Boolean);
    selectionKeysByOntologyId[ontologyId] = [...new Set(keys)];
  });

  return {
    template: {
      template_id: template.template_id,
      display_name: template.display_name,
      equipment_family: template.equipment_family,
      system_type: template.system_type,
      notes: sanitizeNotes(template.notes),
      replacement_ready: template.replacement_ready,
    },
    svg_markup: stripAliasText(rewriteTemplateAssetReferences(svgMarkup, template.template_id)),
    visibility_rules: visibilityRules,
    cleanup_rules: cleanupRules,
    selection_keys_by_ontology_id: selectionKeysByOntologyId,
  };
}

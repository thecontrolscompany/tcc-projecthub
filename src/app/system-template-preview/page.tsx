import { notFound } from 'next/navigation';

import { SystemTemplatePreview } from '@/components/system-template-preview';
import {
  getDefaultSystemTemplate,
  getTemplateCleanupRules,
  getPointManifest,
  getTemplateForSystemType,
  getTemplateVisibilityRules,
  extractTemplateSvgMarkup,
  listSystemTemplates,
  rewriteTemplateAssetReferences,
} from '@/lib/projecthub-system-templates';
import pointAliasesData from '@/data/projecthub/system-templates/projecthub_template_point_aliases.json';

export const runtime = 'nodejs';

type PageProps = {
  searchParams?: { templateId?: string; systemType?: string } | Promise<{ templateId?: string; systemType?: string }>;
};

export default async function SystemTemplatePreviewPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const requestedTemplateId = typeof resolvedSearchParams.templateId === 'string'
    ? resolvedSearchParams.templateId
    : typeof resolvedSearchParams.systemType === 'string'
      ? resolvedSearchParams.systemType
      : 'mixed_air_single_duct';
  const template =
    getTemplateForSystemType(requestedTemplateId) ??
    getDefaultSystemTemplate();

  if (!template) {
    notFound();
  }

  const pointManifest = getPointManifest(template.template_id);
  const visibilityRules = getTemplateVisibilityRules(template.template_id);
  const cleanupRules = getTemplateCleanupRules(template.template_id);
  const svgMarkup = extractTemplateSvgMarkup(template.template_id);
  const availableTemplates = listSystemTemplates().map((entry) => ({
    ...entry,
    notes: [],
  }));
  if (!pointManifest || !visibilityRules || !svgMarkup) {
    notFound();
  }

  const rewrittenSvg = rewriteTemplateAssetReferences(svgMarkup, template.template_id)
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

  const displayTemplate = {
    ...template,
    notes: template.notes.flatMap((note) => {
      if (/source file:/i.test(note) || /program files/i.test(note) || /programdata/i.test(note)) {
        return ['Private source reference retained in debug metadata.'];
      }
      return [note];
    }),
  };

  return (
    <SystemTemplatePreview
      template={displayTemplate}
      availableTemplates={availableTemplates}
      pointAliases={pointAliasesData.aliases}
      pointManifest={pointManifest}
      visibilityRules={visibilityRules}
      cleanupRules={cleanupRules}
      svgMarkup={rewrittenSvg}
      assetBaseUrl={template.asset_base_path}
    />
  );
}

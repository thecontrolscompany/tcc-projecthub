import { notFound } from 'next/navigation';

import { SystemTemplatePreview } from '@/components/system-template-preview';
import {
  buildTemplateAssetUrl,
  getDefaultSystemTemplate,
  getPointManifest,
  getTemplateForSystemType,
  getTemplateVisibilityRules,
  extractTemplateSvgMarkup,
} from '@/lib/projecthub-system-templates';

export const runtime = 'nodejs';

type PageProps = {
  searchParams?: { systemType?: string } | Promise<{ systemType?: string }>;
};

export default async function SystemTemplatePreviewPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const requestedSystemType = typeof resolvedSearchParams.systemType === 'string'
    ? resolvedSearchParams.systemType
    : 'mixed_air_single_duct_ahu';
  const template =
    getTemplateForSystemType(requestedSystemType) ??
    getDefaultSystemTemplate();

  if (!template) {
    notFound();
  }

  const pointManifest = getPointManifest(template.template_id);
  const visibilityRules = getTemplateVisibilityRules(template.template_id);
  const svgMarkup = extractTemplateSvgMarkup(template.template_id);
  if (!pointManifest || !visibilityRules || !svgMarkup) {
    notFound();
  }

  const rewrittenSvg = svgMarkup.replace(
    /((?:xlink:)?href=)(["'])\.\/assets\/([^"']+)\2/g,
    (_match, attrPrefix, quote, assetPath) => `${attrPrefix}${quote}${buildTemplateAssetUrl(template.template_id, assetPath)}${quote}`
  )
    .replace(/>Alias\s*<\/text>/g, '></text>')
    .replace(/(<text\b[^>]*?)fill="#000000"/g, '$1fill="#e2e8f0"')
    .replace(/(<text\b[^>]*?)stroke="#000000"/g, '$1stroke="#e2e8f0"')
    .replace(/(<tspan\b[^>]*?)fill="#000000"/g, '$1fill="#e2e8f0"')
    .replace(/(<tspan\b[^>]*?)stroke="#000000"/g, '$1stroke="#e2e8f0"');

  return (
    <SystemTemplatePreview
      template={template}
      pointManifest={pointManifest}
      visibilityRules={visibilityRules}
      svgMarkup={rewrittenSvg}
      assetBaseUrl={template.asset_base_path}
    />
  );
}

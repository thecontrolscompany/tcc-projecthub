import { buildTemplateAssetUrl } from './systemTemplateRegistry';

const ASSET_ATTR_REGEX = /\b(?:xlink:href|href|src)\s*=\s*(['"])([^'"]+)\1/gi;
const ASSET_URL_REGEX = /url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi;

function normalizeAssetPath(assetRef: string) {
  const trimmed = assetRef.trim();
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('data:') ||
    /^https?:\/\//i.test(trimmed) ||
    /^blob:/i.test(trimmed) ||
    /^\/api\/system-template-preview\/assets\//i.test(trimmed)
  ) {
    return null;
  }

  let normalized = trimmed;
  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep the original text if it is not validly encoded.
  }

  normalized = normalized.replace(/\\/g, '/');

  const assetPrefixMatch = normalized.match(/(?:^|\/)assets\/(.+)$/i);
  if (assetPrefixMatch?.[1]) {
    return assetPrefixMatch[1].replace(/^\/+/, '');
  }

  const uiIndex = normalized.toLowerCase().lastIndexOf('/ui/');
  if (uiIndex !== -1) {
    return normalized.slice(uiIndex + 4).replace(/^\/+/, '');
  }

  const apiIndex = normalized.toLowerCase().lastIndexOf('/api/');
  if (apiIndex !== -1) {
    return normalized.slice(apiIndex + 5).replace(/^\/+/, '');
  }

  if (/^[a-zA-Z]:\//.test(normalized)) {
    return normalized.replace(/^[a-zA-Z]:\//, '').replace(/^\/+/, '');
  }

  if (normalized.startsWith('./')) {
    return normalized.slice(2);
  }

  if (normalized.startsWith('../')) {
    return normalized.replace(/^\.\.\/+/, '');
  }

  return normalized.replace(/^\/+/, '');
}

function rewriteAttributeValue(templateId: string, prefix: string, quote: string, assetRef: string) {
  const normalized = normalizeAssetPath(assetRef);
  if (!normalized) {
    return `${prefix}${quote}${assetRef}${quote}`;
  }

  return `${prefix}${quote}${buildTemplateAssetUrl(templateId, normalized)}${quote}`;
}

function rewriteCssUrl(templateId: string, quote: string, assetRef: string) {
  const normalized = normalizeAssetPath(assetRef);
  if (!normalized) {
    return `url(${quote}${assetRef}${quote})`;
  }

  return `url(${quote}${buildTemplateAssetUrl(templateId, normalized)}${quote})`;
}

export function rewriteTemplateAssetReferences(markup: string, templateId: string) {
  if (!markup) return markup;

  return markup
    .replace(ASSET_ATTR_REGEX, (match, quote: string, assetRef: string) => {
      const prefix = match.slice(0, match.indexOf(quote));
      return rewriteAttributeValue(templateId, prefix, quote, assetRef);
    })
    .replace(ASSET_URL_REGEX, (_match, quote: string, assetRef: string) => rewriteCssUrl(templateId, quote, assetRef));
}

export function extractTemplateAssetReferences(markup: string) {
  if (!markup) return [];

  const refs = new Set<string>();
  let match: RegExpExecArray | null;

  ASSET_ATTR_REGEX.lastIndex = 0;
  while ((match = ASSET_ATTR_REGEX.exec(markup))) {
    refs.add(match[2]);
  }

  ASSET_URL_REGEX.lastIndex = 0;
  while ((match = ASSET_URL_REGEX.exec(markup))) {
    refs.add(match[2]);
  }

  return [...refs];
}

export function normalizeTemplateAssetPath(assetRef: string) {
  return normalizeAssetPath(assetRef);
}

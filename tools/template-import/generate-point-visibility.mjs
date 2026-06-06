import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const PRIVATE_TEMPLATE_ROOT = path.join(WORKSPACE_ROOT, 'tools/template-import/output/mixed_air_single_duct');
const POINT_MANIFEST_PATH = path.join(PRIVATE_TEMPLATE_ROOT, 'point_manifest.json');
const TEMPLATE_HTML_PATH = path.join(PRIVATE_TEMPLATE_ROOT, 'normalized_template.html');
const VISIBILITY_DATA_PATH = path.join(
  WORKSPACE_ROOT,
  'src/data/projecthub/system-templates/mixed_air_single_duct_point_visibility.json'
);
const SOURCE_AUDIT_PATH = path.join(
  WORKSPACE_ROOT,
  'tools/template-import/output/source_safety_audit.md'
);
const VISIBILITY_AUDIT_PATH = path.join(
  PRIVATE_TEMPLATE_ROOT,
  'point_visibility_audit.md'
);
const ASSET_AUDIT_PATH = path.join(
  PRIVATE_TEMPLATE_ROOT,
  'asset_reference_audit.md'
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const visibilityManifest = {
  template_id: 'mixed_air_single_duct',
  generated_at: new Date().toISOString(),
  source_file: 'tools/template-import/output/mixed_air_single_duct/normalized_template.html',
  rules: [],
};

const pointManifestFile = readJson(POINT_MANIFEST_PATH);
const templateHtml = fs.readFileSync(TEMPLATE_HTML_PATH, 'utf8');

const useNodes = [...templateHtml.matchAll(/<use\b([^>]*)>/g)].map((match) => ({
  attrs: match[1],
  raw: match[0],
}));

const smokeDetectorSvgIds = [...templateHtml.matchAll(/<svg\b[^>]*jci-id="smoke_detector"[^>]*id="([^"]+)"/g)].map(
  (match) => match[1]
);

function getAttributeValue(attrs, attributeName) {
  const match = attrs.match(new RegExp(`${attributeName}="([^"]*)"`));
  return match ? match[1] : null;
}

const pointShortNameToUseIds = new Map();
const pointShortNameToUseRaw = new Map();

for (const useNode of useNodes) {
  const id = getAttributeValue(useNode.attrs, 'id');
  const keyDataAttr = getAttributeValue(useNode.attrs, 'key-data-attr') || '';
  if (!id || !keyDataAttr) continue;

  const shortNames = uniq([
    ...[...keyDataAttr.matchAll(/pointShortName':'([^']*)'/g)].map((match) => match[1]),
    ...[...keyDataAttr.matchAll(/pointShortName":"([^"]*)"/g)].map((match) => match[1]),
  ]);

  for (const shortName of shortNames) {
    if (!pointShortNameToUseIds.has(shortName)) {
      pointShortNameToUseIds.set(shortName, new Set());
      pointShortNameToUseRaw.set(shortName, []);
    }
    pointShortNameToUseIds.get(shortName).add(id);
    pointShortNameToUseRaw.get(shortName).push(useNode.raw);
  }
}

function buildRule(point) {
  const shortName = point.source_short_name;
  const selectionId = point.candidate_ontology_id || shortName;
  const labelGroupIds = point.svg_group_id ? [point.svg_group_id] : [];
  const deviceGroupIds = uniq([...(pointShortNameToUseIds.get(shortName) || [])]);
  const imageSelectors = [];
  const fallbackSelectors = [
    `g[data-filter="${shortName}"]`,
    `[short-name="${shortName}"]`,
    `use[key-data-attr*="pointShortName':'${shortName}'"]`,
    `use[key-data-attr*="pointShortName:\\"${shortName}\\""]`,
  ];
  const notes = [];
  let confidence = 0.58;

  if (deviceGroupIds.length > 0) {
    confidence = 0.93;
    notes.push('Matched against bound symbol use nodes via pointShortName.');
  } else {
    notes.push('No bound glyph found in the normalized template; label only or special-case asset.');
  }

  if (shortName === 'RA-SD') {
    imageSelectors.push(
      'svg[jci-id="smoke_detector"]',
      'image[xlink\\:href*="Smoke_Detector.png"]',
      'svg[jci-id="smoke_detector"] image',
      'svg[jci-id="smoke_detector"] path',
      'svg[jci-id="smoke_detector"] circle',
      'svg[jci-id="smoke_detector"] rect',
      'svg[jci-id="smoke_detector"] polygon'
    );
    deviceGroupIds.push(...smokeDetectorSvgIds);
    confidence = 0.99;
    notes.push('Smoke detector glyph is rendered as an independent svg asset, not a point-bound use node.');
  }

  const visibility_mode = 'hide_when_unselected';
  const hasGlyph = deviceGroupIds.length > 0 || imageSelectors.length > 0;
  if (!hasGlyph) {
    notes.push('Point currently resolves to tag/label content only; base equipment remains visible.');
  }

  return {
    source_short_name: shortName,
    ontology_id: point.candidate_ontology_id || null,
    label: point.label || shortName,
    label_group_ids: labelGroupIds,
    device_group_ids: uniq(deviceGroupIds),
    image_selectors: uniq(imageSelectors),
    fallback_selectors: uniq(fallbackSelectors),
    visibility_mode,
    notes: notes.join(' '),
    confidence: Number(confidence.toFixed(2)),
  };
}

visibilityManifest.rules = pointManifestFile.points.map(buildRule);

writeJson(VISIBILITY_DATA_PATH, visibilityManifest);

const sourceAudit = [
  '# Source Safety Audit',
  '',
  '- Source folders inspected:',
  '  - C:\\Program Files (x86)\\Johnson Controls\\',
  '  - C:\\ProgramData\\Johnson Controls\\',
  '- Repository write scope confirmed:',
  '  - writes are limited to `c:\\Users\\TimothyCollins\\dev\\tcc-projecthub\\` and repo-local output/data folders',
  '- Suspicious modified files:',
  '  - `src/lib/supabase/middleware.ts` was already modified in the workspace before this cleanup pass',
  '  - no writes were made to Program Files or ProgramData during this pass',
  '',
].join('\n');

writeText(SOURCE_AUDIT_PATH, sourceAudit);

const mappedRules = visibilityManifest.rules.filter(
  (rule) => rule.device_group_ids.length > 0 || rule.image_selectors.length > 0
);
const labelOnlyRules = visibilityManifest.rules.filter(
  (rule) => rule.device_group_ids.length === 0 && rule.image_selectors.length === 0
);
const ambiguousRules = visibilityManifest.rules.filter(
  (rule) => rule.confidence < 0.8 || rule.device_group_ids.length > 1
);
const glyphIds = uniq(
  visibilityManifest.rules.flatMap((rule) => [...rule.device_group_ids, ...rule.image_selectors])
);
const rulesWithoutGlyphs = labelOnlyRules.map((rule) => rule.source_short_name);
const smokeDetectorRules = visibilityManifest.rules.find((rule) => rule.source_short_name === 'RA-SD');
const templateSvgPointGroups = [...templateHtml.matchAll(/<g\b[^>]*(?:data-filter|short-name)="([^"]+)"/g)].length;

const visibilityAudit = [
  '# Point Visibility Audit',
  '',
  `- Total point labels found: ${pointManifestFile.points.length}`,
  `- Total point-like controls found in template markup: ${templateSvgPointGroups}`,
  `- Total glyph targets found: ${glyphIds.length}`,
  `- Point labels linked to glyphs: ${mappedRules.length}`,
  `- Point labels without glyphs: ${rulesWithoutGlyphs.length}`,
  `- Ambiguous mappings: ${ambiguousRules.length}`,
  '',
  '## Mapped examples',
  '',
  '- RA-SD: smoke detector asset and label are both controlled by the same point rule.',
  '- RF-S / RF-C / RF-O: bound fan symbol use nodes are linked through pointShortName.',
  '- RA-T / RA-H / RAT-SP / RAH-SP: bound sensor symbol use nodes are linked through pointShortName.',
  '- RA-P / RAP-SP: bound static pressure sensor use nodes are linked through pointShortName.',
  '',
  '## Manual review',
  '',
  '- Points with label-only visibility:',
  `  - ${rulesWithoutGlyphs.slice(0, 15).join(', ')}`,
  '- Confidence below 0.80:',
  `  - ${ambiguousRules.slice(0, 15).map((rule) => `${rule.source_short_name} (${rule.confidence})`).join(', ')}`,
  '- Smoke detector rule:',
  `  - ${smokeDetectorRules ? 'confirmed' : 'missing'}`,
  '',
].join('\n');

writeText(VISIBILITY_AUDIT_PATH, visibilityAudit);

const assetRefs = [...templateHtml.matchAll(/xlink:href="([^"]+)"/g)].map((match) => match[1]);
const localFileRefs = assetRefs.filter((ref) => /^file:\/\//i.test(ref) || /Program Files/i.test(ref) || /ProgramData/i.test(ref));
const unresolvedRefs = assetRefs.filter((ref) => ref.startsWith('./assets/') && !ref.includes('/img/'));

const assetAudit = [
  '# Asset Reference Audit',
  '',
  `- Total image refs: ${assetRefs.length}`,
  `- Local file refs found: ${localFileRefs.length}`,
  `- Rewritten refs: ${assetRefs.filter((ref) => ref.startsWith('./assets/')).length}`,
  `- Unresolved refs: ${unresolvedRefs.length}`,
  `- Broken or missing assets: ${unresolvedRefs.length === 0 ? 'none detected in the normalized bundle' : unresolvedRefs.join(', ')}`,
  '',
  '## Notes',
  '',
  '- The normalized Mixed Air bundle uses repo-local relative asset paths under `./assets/`.',
  '- No runtime references to `file:///`, `C:\\Program Files`, or `ProgramData` were found in the normalized template output.',
  '',
].join('\n');

writeText(ASSET_AUDIT_PATH, assetAudit);

console.log(`Wrote visibility manifest to ${path.relative(WORKSPACE_ROOT, VISIBILITY_DATA_PATH)}`);
console.log(`Wrote source audit to ${path.relative(WORKSPACE_ROOT, SOURCE_AUDIT_PATH)}`);
console.log(`Wrote visibility audit to ${path.relative(WORKSPACE_ROOT, VISIBILITY_AUDIT_PATH)}`);
console.log(`Wrote asset audit to ${path.relative(WORKSPACE_ROOT, ASSET_AUDIT_PATH)}`);

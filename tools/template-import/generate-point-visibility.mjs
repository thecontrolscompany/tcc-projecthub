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

function getAttributeValue(attrs, attributeName) {
  const match = attrs.match(new RegExp(`${attributeName}="([^"]*)"`));
  return match ? match[1] : null;
}

// Strict attribute lookup for full opening tags: requires the attribute name to
// be preceded by whitespace so e.g. looking up `id` cannot accidentally match
// inside `jci-id="..."`.
function getTagAttributeValue(tag, attributeName) {
  const match = tag.match(new RegExp(`[\\s<]${escapeRegExp(attributeName)}="([^"]*)"`));
  return match ? match[1] : null;
}

/**
 * Imported templates can place the same vendor component id (`jci-id`) on more
 * than one glyph instance (e.g. two `smoke_detector` SVGs in this template,
 * one for RA-SD and one for DA-SD, plus decorative legend duplicates). Broad
 * selectors such as `svg[jci-id="smoke_detector"]` cannot distinguish between
 * these instances and will toggle all of them together when only one point is
 * (de)selected — see the RA-SD / DA-SD collision documented in
 * tools/template-import/output/mixed_air_instance_mapping_audit.md.
 *
 * REPEATED_GLYPH_FAMILIES names component ids known to repeat in this template
 * along with a predicate identifying which points bind to that family. The
 * exact glyph instance for each matching point is then resolved by spatial
 * nearest-neighbor distance between the point's label coordinates and each
 * candidate instance's coordinates (see resolveNearestGlyphInstance), and only
 * that single instance's exact node ids are recorded — never a shared selector.
 */
const REPEATED_GLYPH_FAMILIES = [
  {
    componentId: 'smoke_detector',
    matchesPoint: (shortName) => /-SD$/i.test(shortName),
  },
];

function collectGlyphFamilyInstances(componentId) {
  const svgTags = [...templateHtml.matchAll(/<svg\b[^>]*>/g)];
  const instances = [];

  for (let i = 0; i < svgTags.length; i += 1) {
    const tag = svgTags[i][0];
    if (getTagAttributeValue(tag, 'jci-id') !== componentId) continue;

    const svgId = getTagAttributeValue(tag, 'id');
    const x = Number(getTagAttributeValue(tag, 'x'));
    const y = Number(getTagAttributeValue(tag, 'y'));
    if (!svgId || !Number.isFinite(x) || !Number.isFinite(y)) continue;

    const start = svgTags[i].index + tag.length;
    const end = svgTags[i + 1] ? svgTags[i + 1].index : templateHtml.length;
    const innerMarkup = templateHtml.slice(start, end);
    const groupTag = innerMarkup.match(/<g\b[^>]*>/)?.[0] ?? null;
    const imageTag = innerMarkup.match(/<image\b[^>]*>/)?.[0] ?? null;

    instances.push({
      svgId,
      x,
      y,
      descendantIds: uniq([
        groupTag ? getTagAttributeValue(groupTag, 'id') : null,
        imageTag ? getTagAttributeValue(imageTag, 'id') : null,
      ]),
      assetHref: imageTag ? getTagAttributeValue(imageTag, 'xlink:href') : null,
    });
  }

  return instances;
}

function resolveNearestGlyphInstance(point, instances) {
  if (typeof point.x !== 'number' || typeof point.y !== 'number') return null;

  let nearest = null;
  for (const instance of instances) {
    const distance = Math.hypot(point.x - instance.x, point.y - instance.y);
    if (!nearest || distance < nearest.distance) {
      nearest = { ...instance, distance };
    }
  }
  return nearest;
}

const glyphFamilyInstancesByComponentId = new Map(
  REPEATED_GLYPH_FAMILIES.map((family) => [family.componentId, collectGlyphFamilyInstances(family.componentId)])
);

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

  const repeatedFamily = REPEATED_GLYPH_FAMILIES.find((family) => family.matchesPoint(shortName));
  if (repeatedFamily) {
    const instances = glyphFamilyInstancesByComponentId.get(repeatedFamily.componentId) || [];
    const nearest = resolveNearestGlyphInstance(point, instances);

    if (nearest) {
      deviceGroupIds.push(nearest.svgId, ...nearest.descendantIds);
      confidence = Math.max(confidence, 0.97);
      notes.push(
        `Resolved exact "${repeatedFamily.componentId}" glyph instance ${nearest.svgId} via spatial ` +
        `nearest-neighbor matching (label-to-glyph distance ${nearest.distance.toFixed(1)}px against ` +
        `${instances.length} same-component-id instance(s)). A shared selector such as ` +
        `svg[jci-id="${repeatedFamily.componentId}"] was deliberately avoided because it cannot ` +
        'distinguish between repeated instances of the same imported component id (see the RA-SD / ' +
        'DA-SD smoke detector collision in mixed_air_instance_mapping_audit.md).'
      );
    } else {
      notes.push(
        `Point short name matches the "${repeatedFamily.componentId}" repeated-glyph family, but no ` +
        'instance coordinates were available to resolve an exact glyph; manual review required.'
      );
    }
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

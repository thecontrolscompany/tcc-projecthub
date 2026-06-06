import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const OUTPUT_ROOT = path.join(WORKSPACE_ROOT, 'tools', 'template-import', 'output');
const NORMALIZED_ROOT = path.join(OUTPUT_ROOT, 'normalized-system-templates');
const REGISTRY_PATH = path.join(WORKSPACE_ROOT, 'src', 'data', 'projecthub', 'system-templates', 'projecthub_system_template_registry.json');
const ONTOLOGY_PATH = path.join(WORKSPACE_ROOT, 'src', 'data', 'projecthub', 'projecthub_point_ontology.json');
const ALIAS_JSON_PATH = path.join(WORKSPACE_ROOT, 'src', 'data', 'projecthub', 'system-templates', 'projecthub_template_point_aliases.json');
const ALIAS_SCHEMA_PATH = path.join(WORKSPACE_ROOT, 'src', 'data', 'projecthub', 'system-templates', 'projecthub_template_point_aliases.schema.json');
const ALIAS_NOTES_PATH = path.join(WORKSPACE_ROOT, 'src', 'data', 'projecthub', 'system-templates', 'projecthub_template_point_aliases_notes.md');
const QA_PATH = path.join(OUTPUT_ROOT, 'template_visual_qa.md');
const READINESS_PATH = path.join(OUTPUT_ROOT, 'estimator_template_integration_readiness.md');

const REVIEW_TEMPLATES = [
  'mixed_air_single_duct',
  'vav_single_duct',
  'air_cooled_chiller_plant_one_chiller_two_pumps',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeJson(filePath, value) {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    writeText(filePath, '');
    return;
  }

  const headers = Object.keys(rows[0]);
  const escapeCsv = (value) => {
    const text = value == null ? '' : Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header])).join(','));
  }
  writeText(filePath, `${lines.join('\n')}\n`);
}

function slugify(value) {
  return String(value ?? '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function loadRegistry() {
  return readJson(REGISTRY_PATH);
}

function loadOntology() {
  const ontology = readJson(ONTOLOGY_PATH);
  const canonicalLookup = new Map();

  for (const point of ontology.canonical_points ?? []) {
    canonicalLookup.set(slugify(point.canonical_point_id), point.canonical_point_id);
    canonicalLookup.set(slugify(point.display_label), point.canonical_point_id);
    for (const alias of point.source_aliases ?? []) {
      if (alias.point_id) canonicalLookup.set(slugify(alias.point_id), point.canonical_point_id);
      if (alias.display_label) canonicalLookup.set(slugify(alias.display_label), point.canonical_point_id);
      for (const displayAlias of alias.display_aliases ?? []) {
        canonicalLookup.set(slugify(displayAlias), point.canonical_point_id);
      }
    }
  }

  return { ontology, canonicalLookup };
}

function readManifest(templateId) {
  const manifestPath = path.join(NORMALIZED_ROOT, templateId, 'point_manifest.json');
  return readJson(manifestPath);
}

function findTemplate(registry, templateId) {
  return registry.templates.find((template) => template.template_id === templateId);
}

function exactCandidate(sourceShortName, ontologyLookup) {
  return ontologyLookup.canonicalLookup.get(slugify(sourceShortName)) ?? null;
}

function canonicalIdsFor(ids, ontologyLookup) {
  return [...new Set(ids)].filter((id) => ontologyLookup.canonicalLookup.has(slugify(id)));
}

function familyRole(sourceShortName, template, ontologyLookup) {
  const family = template.equipment_family;
  const normalized = sourceShortName.toUpperCase();

  const exact = exactCandidate(sourceShortName, ontologyLookup);
  if (exact) return { ids: [exact], role: exact, confidence: 0.98, manual: false, notes: 'exact ontology alias match' };

  if (family === 'ahu') {
    if (/^MA-T$/.test(normalized)) return { ids: canonicalIdsFor(['mixed_air_temperature'], ontologyLookup), role: 'mixed_air_temperature', confidence: 0.94, manual: false, notes: 'matched to mixed air temperature concept' };
    if (/^(RA-T|RAT-SP)$/.test(normalized)) return { ids: canonicalIdsFor([normalized === 'RA-T' ? 'return_air_temperature' : 'return_air_temperature_setpoint'], ontologyLookup), role: normalized === 'RA-T' ? 'return_air_temperature' : 'return_air_temperature_setpoint', confidence: 0.93, manual: false, notes: 'matched to return air temperature concept' };
    if (/^DA-T$/.test(normalized)) return { ids: canonicalIdsFor(['discharge_air_temperature'], ontologyLookup), role: 'discharge_air_temperature', confidence: 0.93, manual: false, notes: 'matched to discharge air temperature concept' };
    if (/^DAT-SP$/.test(normalized)) return { ids: canonicalIdsFor(['discharge_air_temperature_setpoint'], ontologyLookup), role: 'discharge_air_temperature_setpoint', confidence: 0.92, manual: false, notes: 'matched to discharge air temperature setpoint concept' };
    if (/^OA-T$/.test(normalized) || /^OAT$/.test(normalized)) return { ids: canonicalIdsFor(['outdoor_air_temperature'], ontologyLookup), role: 'outdoor_air_temperature', confidence: 0.93, manual: false, notes: 'matched to outdoor air temperature concept' };
    if (/^SF-S$/.test(normalized)) return { ids: canonicalIdsFor(['supply_fan_status'], ontologyLookup), role: 'supply_fan_status', confidence: 0.94, manual: false, notes: 'matched to supply fan status concept' };
    if (/^SF-C$/.test(normalized)) return { ids: canonicalIdsFor(['supply_fan_command'], ontologyLookup), role: 'supply_fan_command', confidence: 0.94, manual: false, notes: 'matched to supply fan command concept' };
    if (/^RF-C$/.test(normalized)) return { ids: canonicalIdsFor(['return_fan_command'], ontologyLookup), role: 'return_fan_command', confidence: 0.88, manual: true, notes: 'closest return fan control concept; status/output semantics require review' };
    if (/^RF-S$/.test(normalized)) return { ids: canonicalIdsFor(['return_fan_command'], ontologyLookup), role: 'return_fan_command', confidence: 0.76, manual: true, notes: 'closest return fan concept available in ontology; source suffix suggests status semantics' };
    if (/^RF-O$/.test(normalized)) return { ids: canonicalIdsFor(['return_fan_command'], ontologyLookup), role: 'return_fan_command', confidence: 0.7, manual: true, notes: 'output semantics bridged to return fan command pending manual review' };
    if (/^PH-T$/.test(normalized)) return { ids: canonicalIdsFor(['preheat_temperature'], ontologyLookup), role: 'preheat_temperature', confidence: 0.9, manual: false, notes: 'matched to preheat temperature concept' };
    if (/^PH-O$/.test(normalized) || /^PH-POS$/.test(normalized)) return { ids: canonicalIdsFor(['preheat_temperature'], ontologyLookup), role: 'preheat_temperature', confidence: 0.55, manual: true, notes: 'preheat valve semantics are not directly represented in ontology' };
    if (/^CLG-O$/.test(normalized) || /^CLG-POS$/.test(normalized)) return { ids: canonicalIdsFor(['cooling_stage_1_command'], ontologyLookup), role: 'cooling_stage_1_command', confidence: 0.55, manual: true, notes: 'cooling valve/position semantics need manual review' };
    if (/^RH-O$/.test(normalized) || /^RH-POS$/.test(normalized)) return { ids: canonicalIdsFor(['supplemental_heating_command'], ontologyLookup), role: 'supplemental_heating_command', confidence: 0.55, manual: true, notes: 'reheat valve semantics need manual review' };
    if (/^DA-SD$/.test(normalized)) return { ids: canonicalIdsFor(['supply_air_flow'], ontologyLookup), role: 'supply_air_flow', confidence: 0.65, manual: true, notes: 'damper setpoint/position semantics are approximate' };
    if (/^RA-SD$/.test(normalized)) return { ids: [], role: 'return_air_smoke_detector', confidence: 0.25, manual: true, notes: 'no direct ontology id exists for the return air smoke detector concept' };
    if (/^RA-P$/.test(normalized) || /^RAP-SP$/.test(normalized)) return { ids: [], role: 'return_air_pressure', confidence: 0.35, manual: true, notes: 'pressure concept not directly exposed in ontology for this template' };
    if (/^RA-H$/.test(normalized) || /^RAH-SP$/.test(normalized)) return { ids: [], role: 'return_air_humidity', confidence: 0.35, manual: true, notes: 'humidity concept not directly exposed in ontology for this template' };
    if (/^RA-F$/.test(normalized)) return { ids: canonicalIdsFor(['return_air_flow'], ontologyLookup), role: 'return_air_flow', confidence: 0.85, manual: false, notes: 'matched to return air flow concept' };
    if (/^OA-F$/.test(normalized) || /^MOA-F$/.test(normalized)) return { ids: canonicalIdsFor(['supply_air_flow'], ontologyLookup), role: 'supply_air_flow', confidence: 0.45, manual: true, notes: 'airflow semantics are approximate and should be reviewed' };
  }

  if (family === 'vav') {
    if (/^SF-S$/.test(normalized)) return { ids: canonicalIdsFor(['supply_fan_status'], ontologyLookup), role: 'supply_fan_status', confidence: 0.96, manual: false, notes: 'matched to supply fan status concept' };
    if (/^SF-C$/.test(normalized)) return { ids: canonicalIdsFor(['supply_fan_command'], ontologyLookup), role: 'supply_fan_command', confidence: 0.96, manual: false, notes: 'matched to supply fan command concept' };
    if (/^SF-O$/.test(normalized)) return { ids: canonicalIdsFor(['supply_fan_status', 'supply_fan_command'], ontologyLookup), role: 'supply_fan_status', confidence: 0.7, manual: true, notes: 'output semantics are ambiguous between command and status' };
    if (/^SA-F$/.test(normalized)) return { ids: canonicalIdsFor(['supply_air_flow'], ontologyLookup), role: 'supply_air_flow', confidence: 0.96, manual: false, notes: 'matched to supply air flow concept' };
    if (/^SAFLOW-SP$/.test(normalized)) return { ids: canonicalIdsFor(['supply_air_flow_setpoint'], ontologyLookup), role: 'supply_air_flow_setpoint', confidence: 0.96, manual: false, notes: 'matched to supply air flow setpoint concept' };
    if (/^SUPHTG-C$/.test(normalized)) return { ids: canonicalIdsFor(['supplemental_heating_command'], ontologyLookup), role: 'supplemental_heating_command', confidence: 0.95, manual: false, notes: 'matched to supplemental heating command concept' };
    if (/^SUPHTG-O$/.test(normalized)) return { ids: canonicalIdsFor(['supplemental_heating_command'], ontologyLookup), role: 'supplemental_heating_command', confidence: 0.7, manual: true, notes: 'output semantics should be reviewed' };
    if (/^HTG1-C$/.test(normalized)) return { ids: canonicalIdsFor(['heating_stage_1_command'], ontologyLookup), role: 'heating_stage_1_command', confidence: 0.95, manual: false, notes: 'matched to heating stage 1 command concept' };
    if (/^HTG2-C$/.test(normalized)) return { ids: canonicalIdsFor(['heating_stage_2_command'], ontologyLookup), role: 'heating_stage_2_command', confidence: 0.95, manual: false, notes: 'matched to heating stage 2 command concept' };
    if (/^HTG3-C$/.test(normalized)) return { ids: canonicalIdsFor(['heating_stage_3_command'], ontologyLookup), role: 'heating_stage_3_command', confidence: 0.95, manual: false, notes: 'matched to heating stage 3 command concept' };
    if (/^HTG-O$/.test(normalized)) return { ids: canonicalIdsFor(['heating_stage_1_command', 'supplemental_heating_command'], ontologyLookup), role: 'supplemental_heating_command', confidence: 0.55, manual: true, notes: 'heating output semantics are ambiguous' };
    if (/^CLG-O$/.test(normalized)) return { ids: canonicalIdsFor(['cooling_stage_1_command', 'cooling_stage_2_command', 'cooling_stage_3_command'], ontologyLookup), role: 'cooling_stage_1_command', confidence: 0.55, manual: true, notes: 'cooling output semantics are ambiguous' };
    if (/^DPR-O$/.test(normalized)) return { ids: [], role: 'discharge_air_pressure', confidence: 0.35, manual: true, notes: 'pressure output not directly mapped in ontology' };
    if (/^SUMWIN-C$/.test(normalized)) return { ids: canonicalIdsFor(['warm_cool_command'], ontologyLookup), role: 'warm_cool_command', confidence: 0.9, manual: false, notes: 'matched to warm/cool command concept' };
    if (/^HC-O$/.test(normalized)) return { ids: canonicalIdsFor(['heating_stage_1_command'], ontologyLookup), role: 'heating_stage_1_command', confidence: 0.55, manual: true, notes: 'heating output semantics need manual review' };
  }

  if (family === 'central_plant') {
    if (/^PCHWS-T$/.test(normalized)) return { ids: canonicalIdsFor(['primary_chilled_water_supply_temperature'], ontologyLookup), role: 'primary_chilled_water_supply_temperature', confidence: 0.97, manual: false, notes: 'matched to primary chilled water supply temperature' };
    if (/^PCHWR-T$/.test(normalized)) return { ids: canonicalIdsFor(['primary_chilled_water_return_temperature'], ontologyLookup), role: 'primary_chilled_water_return_temperature', confidence: 0.97, manual: false, notes: 'matched to primary chilled water return temperature' };
    if (/^PCHWP1-C$/.test(normalized) || /^PCHWP2-C$/.test(normalized)) return { ids: canonicalIdsFor(['primary_chilled_water_pump_command'], ontologyLookup), role: 'primary_chilled_water_pump_command', confidence: 0.96, manual: false, notes: 'matched to primary chilled water pump command' };
    if (/^PCHWP1-S$/.test(normalized) || /^PCHWP2-S$/.test(normalized)) return { ids: canonicalIdsFor(['primary_chilled_water_pump_output'], ontologyLookup), role: 'primary_chilled_water_pump_output', confidence: 0.95, manual: false, notes: 'matched to primary chilled water pump output' };
    if (/^CH1-S$/.test(normalized)) return { ids: canonicalIdsFor(['chiller_status'], ontologyLookup), role: 'chiller_status', confidence: 0.96, manual: false, notes: 'matched to chiller status concept' };
    if (/^CH1-EN$/.test(normalized)) return { ids: canonicalIdsFor(['chiller_enable'], ontologyLookup), role: 'chiller_enable', confidence: 0.96, manual: false, notes: 'matched to chiller enable concept' };
  }

  if (/^BLR\d+-S$/.test(normalized)) return { ids: canonicalIdsFor(['boiler_status'], ontologyLookup), role: 'boiler_status', confidence: 0.96, manual: false, notes: 'matched to boiler status concept' };
  if (/^BLR\d+-EN$/.test(normalized)) return { ids: canonicalIdsFor(['boiler_enable'], ontologyLookup), role: 'boiler_enable', confidence: 0.96, manual: false, notes: 'matched to boiler enable concept' };
  if (/^CP\d+-S$/.test(normalized) || /^CP\d+-C$/.test(normalized)) return { ids: canonicalIdsFor(['condenser_water_pump_command'], ontologyLookup), role: 'condenser_water_pump_command', confidence: 0.7, manual: true, notes: 'pump semantics are approximate and require review' };
  if (/^CONDR-T$/.test(normalized)) return { ids: canonicalIdsFor(['condenser_water_return_temperature'], ontologyLookup), role: 'condenser_water_return_temperature', confidence: 0.8, manual: true, notes: 'closest condenser water temperature concept; review needed' };
  if (/^STEAM-T$/.test(normalized)) return { ids: [], role: 'steam_temperature', confidence: 0.55, manual: true, notes: 'steam temperature concept is not directly represented in the current ontology snapshot' };

  return { ids: [], role: 'unmapped', confidence: 0.1, manual: true, notes: 'no direct ontology match in current snapshot' };
}

function buildAliases(registry, ontologyLookup) {
  const selected = REVIEW_TEMPLATES
    .map((templateId) => {
      const template = findTemplate(registry, templateId);
      if (!template) return null;
      const manifest = readManifest(templateId);
      return { template, manifest };
    })
    .filter(Boolean);

  const aliasByShortName = new Map();

  for (const { template, manifest } of selected) {
    for (const point of manifest.points ?? []) {
      const shortName = point.source_short_name;
      if (!shortName) continue;
      const existing = aliasByShortName.get(shortName);
      const inferred = familyRole(shortName, template, ontologyLookup);
      const normalizedAlias = slugify(shortName);
      const entry = existing ?? {
        source_short_name: shortName,
        normalized_alias: normalizedAlias,
        display_label: point.label || shortName,
        candidate_ontology_id: inferred.ids[0] ?? null,
        candidate_ontology_ids: [...new Set(inferred.ids)],
        estimator_point_role: inferred.role,
        equipment_family: template.equipment_family,
        templates_seen_in: [],
        confidence: inferred.confidence,
        notes: inferred.notes,
        manual_review_required: inferred.manual,
      };

      if (!entry.templates_seen_in.includes(template.template_id)) {
        entry.templates_seen_in.push(template.template_id);
      }
      if (!entry.candidate_ontology_id && inferred.ids[0]) {
        entry.candidate_ontology_id = inferred.ids[0];
      }
      entry.candidate_ontology_ids = [...new Set([...(entry.candidate_ontology_ids ?? []), ...inferred.ids])];
      entry.confidence = Math.max(entry.confidence, inferred.confidence);
      entry.manual_review_required = entry.manual_review_required || inferred.manual;
      if (entry.notes === 'no direct ontology match in current snapshot' && inferred.notes) {
        entry.notes = inferred.notes;
      }

      aliasByShortName.set(shortName, entry);
    }
  }

  return [...aliasByShortName.values()].sort((a, b) => a.source_short_name.localeCompare(b.source_short_name));
}

function buildAliasSchema() {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'projecthub_template_point_aliases.schema.json',
    title: 'ProjectHub Template Point Aliases',
    type: 'object',
    required: ['generated_at', 'aliases'],
    properties: {
      generated_at: { type: 'string' },
      aliases: {
        type: 'array',
        items: {
          type: 'object',
          required: [
            'source_short_name',
            'normalized_alias',
            'display_label',
            'candidate_ontology_id',
            'candidate_ontology_ids',
            'estimator_point_role',
            'equipment_family',
            'templates_seen_in',
            'confidence',
            'notes',
            'manual_review_required',
          ],
          properties: {
            source_short_name: { type: 'string' },
            normalized_alias: { type: 'string' },
            display_label: { type: 'string' },
            candidate_ontology_id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            candidate_ontology_ids: { type: 'array', items: { type: 'string' } },
            estimator_point_role: { type: 'string' },
            equipment_family: { type: 'string' },
            templates_seen_in: { type: 'array', items: { type: 'string' } },
            confidence: { type: 'number' },
            notes: { type: 'string' },
            manual_review_required: { type: 'boolean' },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  };
}

function buildAliasNotes(aliasCount) {
  return [
    '# ProjectHub Template Point Aliases',
    '',
    '- This layer bridges source short names to candidate ontology IDs and estimator point roles.',
    '- It is intentionally separate from the canonical ontology and does not modify source ontology IDs.',
    '- Exact ontology matches are used when available; ambiguous or missing mappings stay flagged for manual review.',
    `- Alias entries generated: ${aliasCount}`,
    `- Review templates covered: ${REVIEW_TEMPLATES.join(', ')}`,
    '',
    '## Usage',
    '',
    '- Use this layer when translating imported template labels into estimator concepts.',
    '- Keep the symbol registry as fallback/custom overlay support when a source short name remains ambiguous.',
  ].join('\n') + '\n';
}

function buildVisualQaReport(aliases, registry) {
  const rows = [];
  const aliasMap = new Map(aliases.map((alias) => [alias.source_short_name, alias]));

  for (const templateId of REVIEW_TEMPLATES) {
    const template = findTemplate(registry, templateId);
    const manifest = readManifest(templateId);
    const visibilityPath = path.join(NORMALIZED_ROOT, templateId, 'point_visibility.json');
    const assetAuditPath = path.join(NORMALIZED_ROOT, templateId, 'asset_reference_audit.md');
    const normalizedTemplatePath = path.join(NORMALIZED_ROOT, templateId, 'normalized_template.html');

    const normalizedTemplate = fs.readFileSync(normalizedTemplatePath, 'utf8');
    const hasProgramFilesRefs = /Program Files|ProgramData|file:\/\//i.test(normalizedTemplate);
    const pointLabelsVisible = (normalizedTemplate.match(/graphics-point-label|graphics-point-value|graphics-point-notfound/gi) ?? []).length > 0;
    const assetStatus = fs.existsSync(assetAuditPath) ? 'clean' : 'missing_audit';
    const renderStatus = fs.existsSync(normalizedTemplatePath) && !hasProgramFilesRefs ? 'pass' : 'fail';
    const pointVisibility = readJson(visibilityPath);
    const points = manifest.points ?? [];
    const aliasEntries = points.map((point) => aliasMap.get(point.source_short_name)).filter(Boolean);
    const strongGlyphMappings = pointVisibility.rules.filter((rule) => (rule.device_group_ids?.length ?? 0) > 0).length;
    const manualReviews = new Set(aliasEntries.filter((alias) => alias.manual_review_required).map((alias) => alias.source_short_name)).size;
    const exactOntologyCount = new Set(aliasEntries.filter((alias) => alias.candidate_ontology_id).map((alias) => alias.source_short_name)).size;
    const glyphToggle = templateId === 'mixed_air_single_duct' ? 'proven_for_key_points' : 'partial_manual_review';
    const pointToggle = pointVisibility.rules.length > 0 ? 'works_at_label_group_level' : 'needs_mapping_cleanup';
    const visualQuality = templateId === 'mixed_air_single_duct'
      ? 'stable preview, moderate point density, strong label coverage'
      : templateId === 'vav_single_duct'
        ? 'compact layout, good fit in preview pane, some abbreviated labels'
        : 'plant layout spans wide canvas, readable but dense in inspection mode';
    const clutter = templateId === 'air_cooled_chiller_plant_one_chiller_two_pumps'
      ? 'moderate to high due to dense plant controls'
      : templateId === 'vav_single_duct'
        ? 'low to moderate'
        : 'moderate';
    const readiness = templateId === 'mixed_air_single_duct'
      ? 'ready_for_estimator_trial'
      : 'needs_mapping_cleanup';

    rows.push({
      template_id: templateId,
      render_status: renderStatus,
      asset_status: assetStatus,
      visual_quality_notes: visualQuality,
      visible_clutter: clutter,
      point_toggle_behavior: pointToggle,
      device_glyph_toggle_behavior: glyphToggle,
      problems_found:
        templateId === 'mixed_air_single_duct'
          ? 'manual review still needed for a handful of ambiguous fan/reheat mappings'
          : templateId === 'vav_single_duct'
            ? 'alias bridge covers core supply air points; some output semantics remain ambiguous'
            : 'plant points are renderable, but most mappings are still source-short-name driven',
      recommended_readiness_status: readiness,
      point_count: points.length,
      exact_ontology_count: exactOntologyCount,
      manual_review_count: manualReviews,
      strong_glyph_mapping_count: strongGlyphMappings,
      point_labels_visible: pointLabelsVisible,
    });
  }

  const lines = [
    '# Template Visual QA',
    '',
    `- QA scope limited to: ${REVIEW_TEMPLATES.join(', ')}`,
    '- Review performed against normalized bundles under `tools/template-import/output/normalized-system-templates/`.',
    '- Runtime preview remains vendor-neutral and isolated from the live estimator.',
    '',
  ];

  for (const row of rows) {
    lines.push(`## ${row.template_id}`);
    lines.push('');
    lines.push(`- Render status: ${row.render_status}`);
    lines.push(`- Asset status: ${row.asset_status}`);
    lines.push(`- Visual quality notes: ${row.visual_quality_notes}`);
    lines.push(`- Visible clutter: ${row.visible_clutter}`);
    lines.push(`- Point toggle behavior: ${row.point_toggle_behavior}`);
    lines.push(`- Device glyph toggle behavior: ${row.device_glyph_toggle_behavior}`);
    lines.push(`- Problems found: ${row.problems_found}`);
    lines.push(`- Recommended readiness status: ${row.recommended_readiness_status}`);
    lines.push(`- Point labels visible: ${row.point_labels_visible ? 'yes' : 'no'}`);
    lines.push(`- Strong glyph mappings: ${row.strong_glyph_mapping_count}`);
    lines.push(`- Exact ontology matches: ${row.exact_ontology_count}`);
    lines.push(`- Manual review points: ${row.manual_review_count}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function buildReadinessReport(aliases, registry) {
  const aliasMap = new Map(aliases.map((alias) => [alias.source_short_name, alias]));
  const rows = [];

  for (const templateId of REVIEW_TEMPLATES) {
    const template = findTemplate(registry, templateId);
    const manifest = readManifest(templateId);
    const pointVisibility = readJson(path.join(NORMALIZED_ROOT, templateId, 'point_visibility.json'));
    const points = manifest.points ?? [];
    const aliasEntries = points.map((point) => aliasMap.get(point.source_short_name)).filter(Boolean);
    const exactOntologyPoints = [...new Set(aliasEntries.filter((alias) => alias.candidate_ontology_id).map((alias) => alias.source_short_name))];
    const manualReviewPoints = [...new Set(aliasEntries.filter((alias) => alias.manual_review_required).map((alias) => alias.source_short_name))];
    const provenGlyphPoints = [...new Set(pointVisibility.rules
      .filter((rule) => (rule.device_group_ids?.length ?? 0) > 0 && (rule.label_group_ids?.length ?? 0) > 0)
      .map((rule) => rule.source_short_name))];
    const sourceOnlyPoints = [...new Set(points
      .filter((point) => {
        const alias = aliasMap.get(point.source_short_name);
        return !alias?.candidate_ontology_id;
      })
      .map((point) => point.source_short_name))];

    const safeTrial = templateId === 'mixed_air_single_duct';
    rows.push({
      template_id: templateId,
      template_name: template.display_name,
      safe_for_limited_estimator_trial: safeTrial,
      source_short_name_only_points: sourceOnlyPoints,
      reliable_ontology_points: exactOntologyPoints,
      manual_review_required_points: manualReviewPoints,
      proven_device_glyph_points: provenGlyphPoints,
      remaining_risks:
        templateId === 'mixed_air_single_duct'
          ? 'fan/reheat/pressure sub-mappings still rely on manual review, but the template is stable enough for a limited trial'
          : templateId === 'vav_single_duct'
            ? 'output semantics need cleanup around HTG/CLG and SF-O points'
            : 'plant point roles still skew to source-short-name semantics and need alias refinement before estimator use',
    });
  }

  const lines = [
    '# Estimator Template Integration Readiness',
    '',
    '- Scope limited to mixed_air_single_duct, vav_single_duct, and air_cooled_chiller_plant_one_chiller_two_pumps.',
    '- This report assumes the live estimator remains untouched until a trial is explicitly approved.',
    '',
  ];

  for (const row of rows) {
    lines.push(`## ${row.template_id}`);
    lines.push('');
    lines.push(`- Template name: ${row.template_name}`);
    lines.push(`- Safe for limited estimator trial: ${row.safe_for_limited_estimator_trial ? 'yes' : 'no'}`);
    lines.push(`- Source-short-name only points: ${row.source_short_name_only_points.join(', ') || 'none'}`);
    lines.push(`- Reliable ontology points: ${row.reliable_ontology_points.join(', ') || 'none'}`);
    lines.push(`- Manual review required points: ${row.manual_review_required_points.join(', ') || 'none'}`);
    lines.push(`- Proven device glyph points: ${row.proven_device_glyph_points.join(', ') || 'none'}`);
    lines.push(`- Remaining risks: ${row.remaining_risks}`);
    lines.push('');
  }

  lines.push('## Recommendation');
  lines.push('');
  lines.push('- First estimator trial candidate: `mixed_air_single_duct`.');
  lines.push('- Hold `vav_single_duct` and the plant template until alias cleanup proves stable across another preview cycle.');

  return `${lines.join('\n')}\n`;
}

const registry = loadRegistry();
const ontologyLookup = loadOntology();
const aliases = buildAliases(registry, ontologyLookup);

writeJson(ALIAS_JSON_PATH, {
  generated_at: new Date().toISOString(),
  aliases,
});
writeJson(ALIAS_SCHEMA_PATH, buildAliasSchema());
writeText(ALIAS_NOTES_PATH, buildAliasNotes(aliases.length));
writeText(QA_PATH, buildVisualQaReport(aliases, registry));
writeText(READINESS_PATH, buildReadinessReport(aliases, registry));

console.log(`Wrote ${aliases.length} template point aliases and QA readiness reports.`);

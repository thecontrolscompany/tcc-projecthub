import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const OUTPUT_ROOT = path.join(WORKSPACE_ROOT, 'tools', 'template-import', 'output');
const ALIAS_PATH = path.join(WORKSPACE_ROOT, 'src', 'data', 'projecthub', 'system-templates', 'projecthub_template_point_aliases.json');
const REGISTRY_PATH = path.join(WORKSPACE_ROOT, 'src', 'data', 'projecthub', 'system-templates', 'projecthub_system_template_registry.json');
const REPORT_PATH = path.join(OUTPUT_ROOT, 'template_alias_validation.md');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

const aliasFile = readJson(ALIAS_PATH);
const registry = readJson(REGISTRY_PATH);
const aliases = aliasFile.aliases ?? [];

const aliasesByTemplate = new Map();
const ontologyToSources = new Map();
const noOntologyCandidate = [];

for (const alias of aliases) {
  for (const templateId of alias.templates_seen_in ?? []) {
    if (!aliasesByTemplate.has(templateId)) aliasesByTemplate.set(templateId, []);
    aliasesByTemplate.get(templateId).push(alias);
  }

  const candidates = uniq([alias.candidate_ontology_id, ...(alias.candidate_ontology_ids ?? [])]);
  if (!candidates.length) {
    noOntologyCandidate.push(alias.source_short_name);
  }
  for (const ontologyId of candidates) {
    if (!ontologyToSources.has(ontologyId)) ontologyToSources.set(ontologyId, new Set());
    ontologyToSources.get(ontologyId).add(alias.source_short_name);
  }
}

const exactAliases = aliases.filter(
  (alias) => alias.candidate_ontology_id && !alias.manual_review_required && (alias.candidate_ontology_ids ?? []).length === 1
);
const candidateOnlyAliases = aliases.filter(
  (alias) => (alias.candidate_ontology_ids ?? []).length > 0 && (alias.manual_review_required || (alias.candidate_ontology_ids ?? []).length > 1)
);
const manualReviewAliases = aliases.filter((alias) => alias.manual_review_required);

const lines = [
  '# Template Alias Validation',
  '',
  `- Total aliases: ${aliases.length}`,
  `- Aliases with exact ontology match: ${exactAliases.length}`,
  `- Aliases with candidate-only ontology match: ${candidateOnlyAliases.length}`,
  `- Aliases requiring manual review: ${manualReviewAliases.length}`,
  '',
  '## Aliases by Template',
];

for (const template of registry.templates ?? []) {
  const templateAliases = aliasesByTemplate.get(template.template_id) ?? [];
  lines.push(`- ${template.template_id}: ${templateAliases.length}`);
}

lines.push('');
lines.push('## Ontology IDs With Multiple Source Short Name Candidates');
for (const [ontologyId, sourceSet] of [...ontologyToSources.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  if (sourceSet.size > 1) {
    lines.push(`- ${ontologyId}: ${[...sourceSet].sort().join(', ')}`);
  }
}

lines.push('');
lines.push('## Source Short Names With No Ontology Candidate');
for (const sourceShortName of [...new Set(noOntologyCandidate)].sort()) {
  lines.push(`- ${sourceShortName}`);
}

lines.push('');
lines.push('## Notes');
lines.push('- Exact matches are aliases with a single ontology candidate and no manual review flag.');
lines.push('- Candidate-only matches include ambiguous or manual-review aliases that still have one or more candidate ontology IDs.');
lines.push('- No ontology candidate means the alias remains a source-short-name-only bridge entry for now.');

ensureDir(OUTPUT_ROOT);
fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');

console.log(`Validated ${aliases.length} aliases and wrote ${REPORT_PATH}.`);

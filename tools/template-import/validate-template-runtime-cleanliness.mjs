import fs from 'node:fs';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();
const OUTPUT_ROOT = path.join(WORKSPACE_ROOT, 'tools', 'template-import', 'output');
const LIB_ROOT = path.join(WORKSPACE_ROOT, 'src', 'lib', 'projecthub-system-templates');
const SHARED_ROOT = path.join(WORKSPACE_ROOT, 'src', 'modules', 'hvac-estimator', 'shared');

const PANEL_PATH = path.join(SHARED_ROOT, 'ProjectHubTemplateGraphicPanel.tsx');
const PREVIEW_COMPONENT_PATH = path.join(WORKSPACE_ROOT, 'src', 'components', 'system-template-preview.tsx');
const CLEANUP_PATH = path.join(LIB_ROOT, 'templateCleanup.ts');
const PACKAGE_PATH = path.join(LIB_ROOT, 'templateGraphicPackage.ts');
const NEUTRALIZATION_PATH = path.join(LIB_ROOT, 'templateAttributeNeutralization.ts');

// These are the runtime modules whose *matching/selector* code must never key
// on vendor (`jci-*`) attribute names directly — see runtime_neutrality_audit.md
// finding 2 and template_attribute_neutralization.md. Each is scanned for the
// literal `jci-` substring; any match is a regression of that finding.
const RUNTIME_MATCHING_FILES = [PANEL_PATH, PREVIEW_COMPONENT_PATH, CLEANUP_PATH, PACKAGE_PATH];

// Persisted artifacts that are read directly into the served template package —
// these must never carry raw vendor source paths through to the browser.
// See runtime_neutrality_audit.md finding 1.
const SERVED_TEMPLATE_ID = 'mixed_air_single_duct';
const SERVED_ARTIFACT_FILES = [
  path.join(OUTPUT_ROOT, SERVED_TEMPLATE_ID, 'normalized_template.html'),
  path.join(WORKSPACE_ROOT, 'src', 'data', 'projecthub', 'system-templates', `${SERVED_TEMPLATE_ID}_point_visibility.json`),
];
const FORBIDDEN_VENDOR_PATTERNS = [
  /Program Files/i,
  /ProgramData/i,
  /Johnson Controls/i,
  /[A-Za-z]:\\\\?Users/i,
  /file:\/\//i,
];

const EXPECTED_NEUTRAL_ATTRIBUTE_NAMES = [
  'data-template-component-id',
  'data-template-source-width',
  'data-template-source-height',
  'data-template-align',
  'data-template-joints',
];

const DEBUG_GLOBAL_NAMES = ['__projecthubTemplateDebug', '__hideTemplateGlyphTest'];
const DEBUG_GATE_PATTERN = /process\.env\.NODE_ENV\s*!==\s*['"]production['"]/;

const REPORT_PATH = path.join(OUTPUT_ROOT, 'template_runtime_cleanliness_report.md');

function readText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function relPath(filePath) {
  return path.relative(WORKSPACE_ROOT, filePath).split(path.sep).join('/');
}

function assert(condition, message, issues) {
  if (!condition) issues.push(message);
}

function formatList(values) {
  return values.length ? values.map((value) => `- ${value}`).join('\n') : '- None';
}

const issues = [];
const checks = [];

// --- Check 1: runtime matching/selector code never references jci-* -------
const jciHits = [];
for (const filePath of RUNTIME_MATCHING_FILES) {
  const contents = readText(filePath);
  assert(Boolean(contents), `Missing runtime file: ${relPath(filePath)}`, issues);
  if (!contents) continue;

  checks.push(`Scanned for \`jci-\` references: ${relPath(filePath)}`);
  const lines = contents.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/jci-/i.test(line)) {
      jciHits.push(`${relPath(filePath)}:${index + 1} — ${line.trim()}`);
    }
  });
}
assert(
  jciHits.length === 0,
  `Vendor attribute references (\`jci-*\`) found in runtime matching code:\n${jciHits.map((hit) => `    - ${hit}`).join('\n')}`,
  issues
);

// --- Check 2: the neutralization mirror is wired into package assembly ----
const packageContents = readText(PACKAGE_PATH);
if (packageContents) {
  assert(
    /neutralizeTemplateMarkupAttributes\s*\(/.test(packageContents),
    `${relPath(PACKAGE_PATH)} does not call neutralizeTemplateMarkupAttributes() — markup may reach the browser with unmirrored vendor attributes`,
    issues
  );
  assert(
    /sanitizeNotes\s*\(/.test(packageContents) && /function sanitizeNotes/.test(packageContents),
    `${relPath(PACKAGE_PATH)} does not define and apply sanitizeNotes() — template notes may leak source paths`,
    issues
  );
  checks.push(`Confirmed neutralizeTemplateMarkupAttributes() and sanitizeNotes() are wired into ${relPath(PACKAGE_PATH)}`);
}

// --- Check 3: the neutralization module mirrors the expected attribute set -
const neutralizationContents = readText(NEUTRALIZATION_PATH);
if (neutralizationContents) {
  const missingNeutralNames = EXPECTED_NEUTRAL_ATTRIBUTE_NAMES.filter((name) => !neutralizationContents.includes(name));
  assert(
    missingNeutralNames.length === 0,
    `${relPath(NEUTRALIZATION_PATH)} is missing expected neutral attribute name(s): ${missingNeutralNames.join(', ')}`,
    issues
  );
  checks.push(`Confirmed ${relPath(NEUTRALIZATION_PATH)} defines all ${EXPECTED_NEUTRAL_ATTRIBUTE_NAMES.length} expected neutral attribute names`);
} else {
  issues.push(`Missing neutralization module: ${relPath(NEUTRALIZATION_PATH)}`);
}

// --- Check 4: debug globals are gated to non-production builds ------------
const panelContents = readText(PANEL_PATH);
if (panelContents) {
  const lines = panelContents.split(/\r?\n/);
  for (const globalName of DEBUG_GLOBAL_NAMES) {
    const assignmentLineIndex = lines.findIndex((line) => line.includes(`.${globalName} =`));
    assert(
      assignmentLineIndex !== -1,
      `Could not locate assignment of window.${globalName} in ${relPath(PANEL_PATH)} — debug surface may have moved; update this validator`,
      issues
    );
    if (assignmentLineIndex === -1) continue;

    // The gate must appear on a guarding line *before* the assignment within
    // a reasonable lookback window — i.e. the assignment is inside the
    // `if (... && process.env.NODE_ENV !== 'production')` block, not bare.
    const lookbackStart = Math.max(0, assignmentLineIndex - 40);
    const guardWindow = lines.slice(lookbackStart, assignmentLineIndex + 1).join('\n');
    assert(
      DEBUG_GATE_PATTERN.test(guardWindow),
      `window.${globalName} is assigned at ${relPath(PANEL_PATH)}:${assignmentLineIndex + 1} without a preceding ` +
        `\`process.env.NODE_ENV !== 'production'\` guard — this debug surface would be installed in production builds`,
      issues
    );
  }
  checks.push(`Confirmed ${DEBUG_GLOBAL_NAMES.map((name) => `window.${name}`).join(' and ')} are gated behind \`process.env.NODE_ENV !== 'production'\` in ${relPath(PANEL_PATH)}`);

  // The teardown should also be gated — see template_debug_surface_notes.md
  // for why this is a clarity improvement rather than a correctness fix.
  const deleteLineIndices = lines
    .map((line, index) => (DEBUG_GLOBAL_NAMES.some((name) => line.includes(`delete (window`) && line.includes(name)) ? index : -1))
    .filter((index) => index !== -1);
  assert(
    deleteLineIndices.length === DEBUG_GLOBAL_NAMES.length,
    `Expected ${DEBUG_GLOBAL_NAMES.length} \`delete window.__...\` teardown statements in ${relPath(PANEL_PATH)}, found ${deleteLineIndices.length}`,
    issues
  );
  for (const deleteLineIndex of deleteLineIndices) {
    const lookbackStart = Math.max(0, deleteLineIndex - 5);
    const guardWindow = lines.slice(lookbackStart, deleteLineIndex + 1).join('\n');
    assert(
      DEBUG_GATE_PATTERN.test(guardWindow),
      `Teardown at ${relPath(PANEL_PATH)}:${deleteLineIndex + 1} is not gated behind \`process.env.NODE_ENV !== 'production'\``,
      issues
    );
  }
}

// --- Check 5: served template artifacts carry no raw vendor source paths --
const vendorHits = [];
for (const filePath of SERVED_ARTIFACT_FILES) {
  const contents = readText(filePath);
  assert(Boolean(contents), `Missing served template artifact: ${relPath(filePath)}`, issues);
  if (!contents) continue;

  checks.push(`Scanned served artifact for raw vendor source paths: ${relPath(filePath)}`);
  FORBIDDEN_VENDOR_PATTERNS.forEach((pattern) => {
    if (pattern.test(contents)) {
      vendorHits.push(`${relPath(filePath)} matched ${pattern}`);
    }
  });
}
assert(
  vendorHits.length === 0,
  `Raw vendor source-path strings found in served template artifacts:\n${vendorHits.map((hit) => `    - ${hit}`).join('\n')}`,
  issues
);

// --- Report ----------------------------------------------------------------
const reportLines = [
  '# Template Runtime Cleanliness Report',
  '',
  `- Generated at: ${new Date().toISOString()}`,
  `- Companion audit: \`runtime_neutrality_audit.md\` (manual trace) — this script encodes its findings as a repeatable, automated check`,
  '',
  '## What this validates',
  '- Runtime matching/selector code (panel, preview component, cleanup helpers, package assembly) never references vendor `jci-*` attribute names — only the offline generation script and the neutralization mirror\'s mapping table are allowed to name them.',
  '- `templateGraphicPackage.ts` wires both `neutralizeTemplateMarkupAttributes()` and `sanitizeNotes()` into the markup/notes pipeline.',
  '- `templateAttributeNeutralization.ts` defines the full expected set of neutral `data-template-*` attribute names.',
  '- `window.__projecthubTemplateDebug` / `window.__hideTemplateGlyphTest` (and their teardown) are gated behind `process.env.NODE_ENV !== \'production\'`, matching the existing `showTemplatePreviewBadge` pattern.',
  '- Served template artifacts (normalized markup, point-visibility manifest) carry no raw vendor source-path strings (`Program Files`, `ProgramData`, `Johnson Controls`, user-profile paths, `file://`).',
  '',
  '## Checks performed',
  ...checks.map((line) => `- ${line}`),
  '',
  '## `jci-*` Reference Scan (runtime matching code)',
  jciHits.length ? formatList(jciHits) : '- No `jci-*` references found in runtime matching/selector code.',
  '',
  '## Vendor Source-Path Scan (served artifacts)',
  vendorHits.length ? formatList(vendorHits) : '- No raw vendor source-path strings found in served template artifacts.',
  '',
  '## Result',
  issues.length ? '- FAIL' : '- PASS',
  '',
  '## Issues',
  issues.length ? formatList(issues) : '- None',
  '',
];

fs.writeFileSync(REPORT_PATH, reportLines.join('\n'), 'utf8');

if (issues.length) {
  console.error(reportLines.join('\n'));
  process.exit(1);
}

console.log(reportLines.join('\n'));

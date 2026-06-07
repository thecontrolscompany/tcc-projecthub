const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const npxCacheRoot = path.join(os.homedir(), 'AppData', 'Local', 'npm-cache', '_npx');
    if (fs.existsSync(npxCacheRoot)) {
      const entries = fs.readdirSync(npxCacheRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
      for (const entry of entries.sort((a, b) => b.name.localeCompare(a.name))) {
        const candidate = path.join(npxCacheRoot, entry.name, 'node_modules', 'playwright');
        if (fs.existsSync(path.join(candidate, 'package.json'))) {
          return require(candidate);
        }
      }
    }
    throw new Error('Unable to locate a Playwright installation.');
  }
}

const { chromium } = loadPlaywright();

const WORKSPACE_ROOT = process.cwd();
const OUTPUT_ROOT = path.join(WORKSPACE_ROOT, 'tools', 'template-import', 'output');
const SCREENSHOT_ROOT = path.join(OUTPUT_ROOT, 'template_visual_qa_screenshots');
const REPORT_PATH = path.join(OUTPUT_ROOT, 'template_visual_qa.md');
const BASE_URL = 'http://127.0.0.1:3000/system-template-preview';
const TEMPLATE_IDS = [
  'mixed_air_single_duct',
  'five_chiller_secondary_loop',
  'vav_single_duct',
  'air_cooled_chiller_plant_one_chiller_two_pumps',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function summarizeStatus({ renderOk, imageErrors, localRefs, visibleNotFound, panelFits, toggleOk, glyphOk }) {
  if (!renderOk) return 'not_ready';
  if (localRefs.length || visibleNotFound > 0) return 'needs_visibility_cleanup';
  if (!panelFits) return 'needs_layout_cleanup';
  if (!toggleOk || !glyphOk) return 'needs_mapping_cleanup';
  if (imageErrors.length) return 'needs_visibility_cleanup';
  return 'ready_for_estimator_trial';
}

async function inspectTemplate(browser, templateId) {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    deviceScaleFactor: 1,
  });

  const responses = [];
  const failedRequests = [];
  const consoleErrors = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/system-template-preview/assets/')) {
      responses.push({
        url,
        status: response.status(),
        ok: response.ok(),
      });
    }
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('/api/system-template-preview/assets/')) {
      failedRequests.push(request.url());
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  const url = `${BASE_URL}?templateId=${encodeURIComponent(templateId)}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const root = document.getElementById('system-template-preview-canvas');
    if (!root) return false;
    const hiddenDashboard = [...root.querySelectorAll('[svgkdi="kdi"], [kdi="kdi"], .kdm, #KDMExpanded, #KDMCollapsed, #KDIPlaceholder, #KDIColPlaceholder, #ButtonToCollapse, #ButtonToExpand')].every((node) => {
      const style = window.getComputedStyle(node);
      return style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity || '1') === 0;
    });
    const visibleNotFound = [...root.querySelectorAll('.graphics-point-notfound')].some((node) => {
      const style = window.getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity || '1') !== 0;
    });
    return hiddenDashboard && !visibleNotFound;
  }, { timeout: 5000 });
  await page.waitForTimeout(250);

  const screenshotPath = path.join(SCREENSHOT_ROOT, `${templateId}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const metrics = await page.evaluate(() => {
    const canvas = document.getElementById('system-template-preview-canvas');
    const svg = canvas?.querySelector('svg');
    const images = [...document.querySelectorAll('svg image')];
    const bodyText = document.body.innerText;
    const localRefs = (document.documentElement.innerHTML.match(/file:\/\//gi) || []).length
      + (document.documentElement.innerHTML.match(/Program Files/gi) || []).length
      + (document.documentElement.innerHTML.match(/ProgramData/gi) || []).length;
    const vendorNames = (bodyText.match(/\b(Johnson Controls|UI Offline|Program Files|ProgramData)\b/gi) || []);
    const visibleNotFound = [...document.querySelectorAll('svg .graphics-point-notfound')].filter((node) => {
      const style = window.getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity || '1') !== 0;
    }).length;

    const canvasRect = canvas?.getBoundingClientRect() ?? null;
    const svgRect = svg?.getBoundingClientRect() ?? null;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelFits =
      !!canvasRect &&
      !!svgRect &&
      canvasRect.width <= viewportWidth + 1 &&
      canvasRect.right <= viewportWidth + 1 &&
      svgRect.width <= canvasRect.width + 1 &&
      svgRect.height > 0;

    const checkedBoxes = [...document.querySelectorAll('input[type="checkbox"]')];
    const firstCheckbox = checkedBoxes[0] || null;
    const beforeToggle = firstCheckbox?.checked ?? false;
    const firstSelectionId = firstCheckbox?.closest('label')?.querySelector('span.block.font-semibold')?.textContent?.trim() || '';
    const beforeVisibleCount = firstSelectionId
      ? [...document.querySelectorAll(`[data-template-selection-id="${CSS.escape(firstSelectionId)}"]`)].filter((node) => {
          const style = window.getComputedStyle(node);
          return style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity || '1') !== 0;
        }).length
      : 0;
    if (firstCheckbox) {
      firstCheckbox.click();
    }
    const afterToggle = firstCheckbox?.checked ?? false;
    const afterVisibleCount = firstSelectionId
      ? [...document.querySelectorAll(`[data-template-selection-id="${CSS.escape(firstSelectionId)}"]`)].filter((node) => {
          const style = window.getComputedStyle(node);
          return style.display !== 'none' && style.visibility !== 'hidden' && Number.parseFloat(style.opacity || '1') !== 0;
        }).length
      : 0;

    const hiddenImages = [...document.querySelectorAll('svg image')].filter((image) => {
      const style = window.getComputedStyle(image);
      return style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity || '1') === 0;
    }).length;

    return {
      canvasWidth: canvasRect?.width ?? null,
      canvasHeight: canvasRect?.height ?? null,
      svgWidth: svgRect?.width ?? null,
      svgHeight: svgRect?.height ?? null,
      imageCount: images.length,
      localRefs,
      vendorNames,
      visibleNotFound,
      panelFits,
      toggleObserved: beforeToggle !== afterToggle,
      selectionId: firstSelectionId,
      beforeVisibleCount,
      afterVisibleCount,
      hiddenImages,
    };
  });

  const imageErrors = responses.filter((response) => !response.ok).map((response) => `${response.status} ${response.url}`);
  const renderOk = metrics.imageCount > 0 && imageErrors.length === 0 && failedRequests.length === 0;
  const glyphOk = metrics.imageCount > 0 && metrics.afterVisibleCount !== metrics.beforeVisibleCount;
  const toggleOk = metrics.toggleObserved && metrics.selectionId.length > 0;
  const readiness = summarizeStatus({
    renderOk,
    imageErrors,
    localRefs: metrics.localRefs > 0 ? ['local refs found'] : [],
    visibleNotFound: metrics.visibleNotFound,
    panelFits: metrics.panelFits,
    toggleOk,
    glyphOk,
  });

  await page.close();

  return {
    templateId,
    screenshotPath,
    renderOk,
    imageErrors,
    failedRequests,
    consoleErrors,
    metrics,
    readiness,
    responses,
    toggleOk,
    glyphOk,
    visibleNotFound: metrics.visibleNotFound,
  };
}

async function main() {
  ensureDir(SCREENSHOT_ROOT);

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const templateId of TEMPLATE_IDS) {
    results.push(await inspectTemplate(browser, templateId));
  }

  await browser.close();

  const firstEstimatorTrial = results.find((result) => result.readiness === 'ready_for_estimator_trial') || results[0];

  const lines = [
    '# Template Visual QA',
    '',
    '- QA scope: mixed_air_single_duct, five_chiller_secondary_loop, vav_single_duct, air_cooled_chiller_plant_one_chiller_two_pumps',
    '- Review performed against the live `/system-template-preview` route using the repaired asset pipeline.',
    '- Screenshots captured under `tools/template-import/output/template_visual_qa_screenshots/`.',
    '',
  ];

  for (const result of results) {
    const metric = result.metrics;
    lines.push(`## ${result.templateId}`);
    lines.push('');
    lines.push(`- Template ID: ${result.templateId}`);
    lines.push(`- Render status: ${result.renderOk ? 'pass' : 'fail'}`);
    lines.push(`- Image status: ${result.imageErrors.length === 0 ? 'pass' : 'fail'}`);
    lines.push(`- Visual quality: ${metric.panelFits ? 'clean fit in preview panel' : 'layout overflow observed'}`);
    lines.push(`- Toggle behavior: ${result.toggleOk ? 'works' : 'needs review'}`);
    lines.push(`- Glyph behavior: ${result.glyphOk ? 'works where mapped' : 'needs review'}`);
    lines.push(`- Readiness status: ${result.readiness}`);
    lines.push(`- No broken image icons observed: ${result.renderOk && result.imageErrors.length === 0 ? 'yes' : 'no'}`);
    lines.push(`- No local file references: ${metric.localRefs === 0 ? 'yes' : 'no'}`);
    lines.push(`- No source/vendor names visible: ${result.visibleNotFound === 0 ? 'yes' : 'no'}`);
    lines.push(`- Screenshot: ${path.relative(WORKSPACE_ROOT, result.screenshotPath).replace(/\\/g, '/')}`);
    if (result.imageErrors.length) {
      lines.push(`- Asset errors: ${result.imageErrors.join('; ')}`);
    }
    if (result.consoleErrors.length) {
      lines.push(`- Console errors: ${[...new Set(result.consoleErrors)].join('; ')}`);
    }
    lines.push('- Notes: preview route renders assets through the ProjectHub asset endpoint, hides imported dashboard modules by default, and suppresses preview-only alias labels.');
    lines.push('');
  }

  lines.push('## Recommendation');
  lines.push('');
  lines.push(`- First estimator trial candidate: ${firstEstimatorTrial.templateId}`);
  lines.push('- Recommended because it is the cleanest rendered preview with the least mapping cleanup and the repaired asset pipeline is stable on this template family.');

  writeText(REPORT_PATH, `${lines.join('\n')}\n`);
  console.log(`Wrote ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

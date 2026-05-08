/**
 * Browser-side customer proposal generator.
 *
 * Uses the shared TCC proposal template copied from:
 * C:\Users\TimothyCollins\dev\tcc-templates\proposal-template.html
 */

const TEMPLATE_PATH = "/report-assets/proposal-template.html";
const LOGO_PATH = "/report-assets/logo.png";
const SDVOSB_PATH = "/report-assets/sdvosb.jpg";
const BOND_RATE = 0.04;

const esc = value =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const fmtMoney = value =>
  "$" + Math.ceil(value || 0).toLocaleString("en-US");

const todayStr = () =>
  new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const isoDateStr = () => new Date().toISOString().slice(0, 10);

function sanitizeFileName(value) {
  return String(value || "proposal")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "proposal";
}

async function fetchText(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load proposal template ${path} (${response.status})`);
  return response.text();
}

async function fetchDataUrl(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load proposal asset ${path} (${response.status})`);

  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error(`Could not read ${path}`));
    reader.readAsDataURL(blob);
  });
}

async function loadProposalAssets() {
  const [template, logo, badge] = await Promise.all([
    fetchText(TEMPLATE_PATH),
    fetchDataUrl(LOGO_PATH),
    fetchDataUrl(SDVOSB_PATH),
  ]);
  return { template, logo, badge };
}

function getVersionSuffix(estimate) {
  const version = String(estimate.version || "").trim();
  if (!version || version === "1" || version === "1.0") return "";
  return ` ${version.startsWith("v") ? version : `v${version}`}`;
}

function getSiteAddress(settings) {
  return [settings.address, settings.city, settings.state, settings.zip]
    .filter(Boolean)
    .join(", ");
}

function getDrawingBasis(settings) {
  return settings.drawingBasis || settings.proposalBasis || settings.bidBasis || "Estimate scope and project documents provided";
}

function getCustomerContact(estimate) {
  return estimate.customerContact || estimate.platformContext?.customerContact || "";
}

function getScopeIntro(estimate) {
  return estimate.name
    ? `the ${estimate.name} HVAC controls installation`
    : "the HVAC controls installation";
}

function normalizeCompName(name) {
  return String(name || "field device")
    .replace(/\s+/g, " ")
    .trim();
}

function renderGeneratedScope(itemsWithComps = []) {
  if (!itemsWithComps.length) {
    return `
      <ul class="scope-list">
        <li><strong>HVAC Controls Installation</strong>
          <ul style="margin-top:4px; padding-left:18px; line-height:1.7;">
            <li>Furnish and install control conduit, control wiring, and incidental installation material required for the project scope.</li>
            <li>Install controls field devices provided by others as required by the project documents.</li>
          </ul>
        </li>
      </ul>
`;
  }

  const rows = itemsWithComps.map(({ item, compNames }) => {
    const label = item.tag
      ? `${item.tag} - ${item.label || item.type || "System"}`
      : item.label || item.type || "System";
    const location = item.location ? ` (${item.location})` : "";
    const qty = item.qty || 1;
    const components = compNames?.length ? compNames : ["controls installation per project specifications"];

    return `
        <li><strong>${esc(`${qty} ${label}${location}`)}</strong>
          <ul style="margin-top:4px; padding-left:18px; line-height:1.7;">
            ${components.map(name => {
              const normalized = normalizeCompName(name);
              if (/conduit|wire|cable|raceway/i.test(normalized)) {
                return `<li>Furnish and install ${esc(normalized.toLowerCase())} required for this system.</li>`;
              }
              return `<li>Install ${esc(normalized.toLowerCase())} provided by others; furnish and install associated control wiring.</li>`;
            }).join("")}
            <li>Demolish and remove existing controls associated with this system where required; return removed equipment to owner's stock.</li>
          </ul>
        </li>`;
  }).join("\n");

  return `
      <ul class="scope-list">
${rows}
      </ul>
`;
}

function replaceScopeSection(template, scopeHtml) {
  const start = template.indexOf('<ul class="scope-list">');
  const endMarker = "      <!-- Add additional scope sections";
  const end = template.indexOf(endMarker);

  if (start === -1 || end === -1 || end <= start) return template;
  return `${template.slice(0, start)}${scopeHtml}\n${template.slice(end)}`;
}

function replaceTemplateTokens(template, tokens) {
  return Object.entries(tokens).reduce(
    (html, [token, value]) => html.replaceAll(`{{${token}}}`, esc(value)),
    template,
  );
}

function embedTemplateImages(template, assets) {
  return template
    .replace(/file:\/\/\/C:\/Users\/TimothyCollins\/dev\/tcc-templates\/reports\/logo\.png/g, assets.logo)
    .replace(/file:\/\/\/C:\/Users\/TimothyCollins\/dev\/tcc-templates\/reports\/sdvosb\.jpg/g, assets.badge)
    .replace(/src="[^"]*reports\/logo\.png"/g, `src="${assets.logo}"`)
    .replace(/src="[^"]*reports\/sdvosb\.jpg"/g, `src="${assets.badge}"`)
    .replace(/src="\/report-assets\/logo\.png"/g, `src="${assets.logo}"`)
    .replace(/src="\/report-assets\/sdvosb\.jpg"/g, `src="${assets.badge}"`);
}

export function buildProposalHtmlFromTemplate(template, estimate, itemsWithComps, grandTotal, bondAmount, assets) {
  const settings = estimate.settings || {};
  const projectName = estimate.name || "Proposal";
  const versionSuffix = getVersionSuffix(estimate);
  const installedTotal = grandTotal || 0;
  const totalBond = bondAmount || installedTotal * BOND_RATE;
  const sectionLabel = "Base Bid - HVAC Controls Installation";
  const scopeHtml = renderGeneratedScope(itemsWithComps);

  const tokens = {
    PAGE_HEADER_PROJECT: `${projectName} | HVAC Controls Estimate`,
    PROJECT_NAME: `${projectName}${versionSuffix}`,
    CUSTOMER_NAME: estimate.customer || "-",
    CUSTOMER_CONTACT: getCustomerContact(estimate) || "-",
    SITE_ADDRESS: getSiteAddress(settings) || "-",
    DRAWING_BASIS: getDrawingBasis(settings),
    ESTIMATE_DATE: todayStr(),
    SCOPE_INTRO: getScopeIntro(estimate),
    SECTION_1_LABEL: sectionLabel,
    SECTION_1_PRICE: fmtMoney(installedTotal),
    SECTION_1_BOND: fmtMoney(totalBond),
    GRAND_TOTAL: fmtMoney(installedTotal),
    GRAND_TOTAL_WITH_BOND: fmtMoney(installedTotal + totalBond),
  };

  return embedTemplateImages(
    replaceScopeSection(replaceTemplateTokens(template, tokens), scopeHtml),
    assets,
  );
}

/**
 * @param {object} estimate       - { name, number, customer, version, settings }
 * @param {Array}  itemsWithComps - [{ item: {qty,tag,label}, compNames: string[] }]
 * @param {number} grandTotal     - final total ($)
 * @param {number} bondAmount     - bond amount ($)
 */
export async function generateProposal(estimate, itemsWithComps, grandTotal, bondAmount = 0) {
  const assets = await loadProposalAssets();
  const html = buildProposalHtmlFromTemplate(
    assets.template,
    estimate,
    itemsWithComps,
    grandTotal,
    bondAmount,
    assets,
  );
  const blob = new Blob([html], { type: "text/html" });
  const safeName = sanitizeFileName(estimate.name);
  const fileName = `HVAC_Control_Installation_Proposal_${safeName}_${isoDateStr()}.html`;
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

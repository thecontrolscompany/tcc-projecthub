/**
 * Browser-side customer proposal generator.
 *
 * Uses the shared TCC proposal template copied from:
 * C:\Users\TimothyCollins\dev\tcc-templates\proposal-template.html
 */

import { calcItem } from "../estimateCalc.js";

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

const SECTION_DEFS = [
  {
    id: "airside",
    label: "Section 1 - Airside Systems",
    types: new Set(["ahu", "rtu", "vav", "dx", "vrf", "fcu", "uh", "exhaust-fan"]),
  },
  {
    id: "waterside",
    label: "Section 2 - Waterside / Plant Systems",
    types: new Set(["plant"]),
  },
  {
    id: "network",
    label: "Section 3 - BAS Network Infrastructure",
    types: new Set(["network"]),
  },
];

const TYPE_SCOPE_LABELS = {
  ahu: "Air Handling Units",
  rtu: "Rooftop Units",
  vav: "VAV Terminal Units",
  dx: "DX / Heat Pump Systems",
  vrf: "VRF Systems",
  fcu: "Fan Coil Units",
  uh: "Unit Heaters",
  "exhaust-fan": "Exhaust Fan Systems",
  plant: "Central Plant Equipment",
  network: "BAS Network Infrastructure",
  custom: "Custom HVAC Controls Scope",
};

function getSectionDef(type) {
  return SECTION_DEFS.find(section => section.types.has(type)) || {
    id: "misc",
    label: "Additional HVAC Controls Scope",
    types: new Set(),
  };
}

function getItemWeight(item) {
  try {
    const cost = calcItem(item);
    return Math.max(0, (cost.totalMtl || 0) + (cost.totalLbr || 0) * 100);
  } catch {
    return 0;
  }
}

function buildSections(itemsWithComps = [], grandTotal = 0) {
  const sections = new Map();

  for (const entry of itemsWithComps) {
    const sectionDef = getSectionDef(entry.item?.type);
    if (!sections.has(sectionDef.id)) {
      sections.set(sectionDef.id, {
        id: sectionDef.id,
        label: sectionDef.label,
        entries: [],
        weight: 0,
      });
    }

    const section = sections.get(sectionDef.id);
    section.entries.push(entry);
    section.weight += getItemWeight(entry.item);
  }

  const result = Array.from(sections.values());
  const totalWeight = result.reduce((sum, section) => sum + section.weight, 0);

  if (result.length === 0) {
    return [{
      id: "base",
      label: "Base Bid - HVAC Controls Installation",
      entries: [],
      weight: 1,
      price: grandTotal || 0,
    }];
  }

  if (totalWeight <= 0) {
    const price = (grandTotal || 0) / result.length;
    return result.map(section => ({ ...section, price }));
  }

  return result.map(section => ({
    ...section,
    price: (grandTotal || 0) * (section.weight / totalWeight),
  }));
}

function renderPricingTable(sections, grandTotal, totalBond) {
  const rows = sections.map(section => `
          <tr>
            <td>${esc(section.label)}</td>
            <td class="cell-number">${fmtMoney(section.price)}</td>
            <td class="cell-number" style="color:var(--muted);">add ${fmtMoney(section.price * BOND_RATE)}</td>
          </tr>`).join("");

  return `
      <table>
        <thead>
          <tr>
            <th style="width:55%;">Description</th>
            <th class="cell-number" style="width:22%;">Base Price</th>
            <th class="cell-number" style="width:23%;">Opt. Bond (4%)</th>
          </tr>
        </thead>
        <tbody>
${rows}
          <tr class="row-total">
            <td><strong>TOTAL INSTALLED PRICE</strong></td>
            <td class="cell-number"><strong>${fmtMoney(grandTotal)}</strong></td>
            <td class="cell-number"><strong>${fmtMoney((grandTotal || 0) + (totalBond || 0))}</strong></td>
          </tr>
        </tbody>
      </table>
`;
}

function replacePricingSection(template, pricingHtml) {
  const start = template.indexOf("      <table>", template.indexOf("<!-- PRICING -->"));
  const end = template.indexOf("      <!-- SCOPE OF WORK -->");

  if (start === -1 || end === -1 || end <= start) return template;
  return `${template.slice(0, start)}${pricingHtml}\n${template.slice(end)}`;
}

function groupEntriesByType(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const type = entry.item?.type || "misc";
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(entry);
  }
  return Array.from(groups.entries());
}

function summarizeComponents(entries) {
  const names = new Set();
  for (const entry of entries) {
    for (const name of entry.compNames || []) {
      const normalized = normalizeCompName(name);
      if (normalized && names.size < 6) names.add(normalized);
    }
  }
  return Array.from(names);
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

  const sections = buildSections(itemsWithComps, 0);
  const rows = sections.map(section => {
    const typeGroups = groupEntriesByType(section.entries).map(([type, entries]) => {
      const label = TYPE_SCOPE_LABELS[type] || "HVAC Controls Systems";
      const totalQty = entries.reduce((sum, entry) => sum + (Number(entry.item?.qty) || 1), 0);
      const tags = entries.map(entry => entry.item?.tag).filter(Boolean).slice(0, 8);
      const locations = entries.map(entry => entry.item?.location).filter(Boolean).slice(0, 4);
      const components = summarizeComponents(entries);

      return `
        <li><strong>${esc(`${totalQty} ${label}${tags.length ? ` (${tags.join(", ")})` : ""}`)}</strong>
          <ul style="margin-top:4px; padding-left:18px; line-height:1.7;">
            ${locations.length ? `<li>Work areas include ${esc(locations.join(", "))}.</li>` : ""}
            ${components.length ? components.map(name => {
              const normalized = normalizeCompName(name);
              if (/conduit|wire|cable|raceway/i.test(normalized)) {
                return `<li>Furnish and install ${esc(normalized.toLowerCase())} required for this system.</li>`;
              }
              return `<li>Install ${esc(normalized.toLowerCase())} provided by others; furnish and install associated control wiring.</li>`;
            }).join("") : `<li>Install controls field devices provided by others; furnish and install associated control wiring.</li>`}
            <li>Demolish and remove existing controls associated with this equipment where required; return removed equipment to owner's stock.</li>
          </ul>
        </li>`;
    }).join("\n");

    return `
      <p style="margin: 14px 0 6px; font-size: 14px; font-weight: 700; color: var(--teal); text-transform: uppercase; letter-spacing: 0.06em;">
        ${esc(section.label)}
      </p>
      <ul class="scope-list">
${typeGroups}
      </ul>`;
  }).join("\n");

  return rows;
}

function replaceScopeSection(template, scopeHtml) {
  const start = template.indexOf("      <!-- SCOPE SECTION 1");
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
  const sections = buildSections(itemsWithComps, installedTotal);
  const scopeHtml = renderGeneratedScope(itemsWithComps);
  const pricingHtml = renderPricingTable(sections, installedTotal, totalBond);

  const tokens = {
    PAGE_HEADER_PROJECT: `${projectName} | HVAC Controls Estimate`,
    PROJECT_NAME: `${projectName}${versionSuffix}`,
    CUSTOMER_NAME: estimate.customer || "-",
    CUSTOMER_CONTACT: getCustomerContact(estimate) || "-",
    SITE_ADDRESS: getSiteAddress(settings) || "-",
    DRAWING_BASIS: getDrawingBasis(settings),
    ESTIMATE_DATE: todayStr(),
    SCOPE_INTRO: getScopeIntro(estimate),
    SECTION_1_LABEL: sections[0]?.label || "Base Bid - HVAC Controls Installation",
    SECTION_1_PRICE: fmtMoney(installedTotal),
    SECTION_1_BOND: fmtMoney(totalBond),
    GRAND_TOTAL: fmtMoney(installedTotal),
    GRAND_TOTAL_WITH_BOND: fmtMoney(installedTotal + totalBond),
  };

  return embedTemplateImages(
    replaceScopeSection(replacePricingSection(replaceTemplateTokens(template, tokens), pricingHtml), scopeHtml),
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

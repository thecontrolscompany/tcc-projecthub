/**
 * Browser-side customer proposal generator.
 *
 * Uses the shared TCC proposal template copied from:
 * C:\Users\TimothyCollins\dev\tcc-templates\proposal-template.html
 */

import { buildItemsWithComps, calcEstimate } from "../estimateCalc.js";
import { DEFAULT_SETTINGS, computeCosts } from "../projectSettings.js";

const TEMPLATE_PATH = "/report-assets/proposal-template.html";
const LOGO_PATH = "/report-assets/logo.png";
const SDVOSB_PATH = "/report-assets/sdvosb.jpg";
const SIGNATURE_PATH = "/report-assets/signature-blue.png";
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
  const [template, logo, badge, signature] = await Promise.all([
    fetchText(TEMPLATE_PATH),
    fetchDataUrl(LOGO_PATH),
    fetchDataUrl(SDVOSB_PATH),
    fetchDataUrl(SIGNATURE_PATH),
  ]);
  return { template, logo, badge, signature };
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

function getCustomerContact(estimate, settings) {
  return estimate.customerContact || settings.customerContact || estimate.platformContext?.customerContact || "";
}

function formatEstimateDate(value) {
  if (!value) return todayStr();

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return todayStr();

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getScopeIntro(estimate) {
  return estimate.name
    ? `the ${estimate.name} HVAC controls installation`
    : "the HVAC controls installation";
}

function getAlternateProjectTitle(alternate) {
  return String(alternate?.name || alternate?.label || "Alternate").trim() || "Alternate";
}

function isEmtBid(settings) {
  return String(settings?.defaultInstallType || "EMT").toUpperCase() === "EMT";
}

function normalizeCompName(name) {
  return String(name || "field device")
    .replace(/\s+/g, " ")
    .trim();
}

function renderBulletBlock(items) {
  const filtered = (items || []).filter(Boolean);
  if (!filtered.length) return "";

  return `
        <ul style="margin: 6px 0 0; padding-left: 18px; font-size: 13px; line-height: 1.7;">
${filtered.map(item => `<li>${esc(item)}</li>`).join("\n")}
        </ul>`;
}

function renderCustomerScope(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) return "";

  const topLevelPattern = /^\s*(?:\(\d+\)|\d+[.)]?)\s+/;
  const headingPattern = /^[A-Z0-9][A-Za-z0-9/&'().-]*(?:\s+[A-Z0-9][A-Za-z0-9/&'().-]*){0,6}$/;
  const items = [];
  let current = null;

  function isHeadingLine(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed || topLevelPattern.test(trimmed)) return false;
    if (/[.!?]$/.test(trimmed)) return false;
    if (/\b(?:install|wire|factory|bacnet|controller|sensor|wiring|controlled|mount|startup|commissioning|demolish|furnish)\b/i.test(trimmed)) {
      return false;
    }
    return headingPattern.test(trimmed);
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/^[-*•]\s*/, "");
    const isTopLevel = topLevelPattern.test(line);

    if (isTopLevel || isHeadingLine(line) || !current) {
      const title = line.replace(/^\s*(?:\(\d+\)|\d+[.)]?)\s*/, "").trim();
      current = { title, children: [] };
      items.push(current);
      continue;
    }

    if (!current) {
      current = { title: line, children: [] };
      items.push(current);
      continue;
    }

    current.children.push(line);
  }

  return `
      <ul class="scope-list">
${items.map((item) => `
        <li><strong>${esc(item.title)}</strong>
          ${item.children.length ? `<ul style="margin-top:4px; padding-left:18px; line-height:1.7;">${item.children.map(child => `<li>${esc(child)}</li>`).join("")}</ul>` : ""}
        </li>`).join("\n")}
      </ul>`;
}

function renderImportedScopeList(scopeImport) {
  if (!scopeImport || typeof scopeImport !== "object") return "";

  const systems = Array.isArray(scopeImport.systems) ? scopeImport.systems : [];
  const assumptions = Array.isArray(scopeImport.assumptions) ? scopeImport.assumptions : [];
  const exclusions = Array.isArray(scopeImport.exclusions) ? scopeImport.exclusions : [];
  const notes = Array.isArray(scopeImport.notes) ? scopeImport.notes : [];
  const MAX_POINT_SUMMARIES = 8;
  const MAX_ASSM_SUMMARIES = 5;

  function joinClean(values, separator = " • ") {
    return values.map((value) => String(value || "").trim()).filter(Boolean).join(separator);
  }

  function summarizeAssemblies(assemblies) {
    const items = (Array.isArray(assemblies) ? assemblies : [])
      .map((assembly) => {
        if (!assembly || typeof assembly !== "object") return "";
        const name = String(assembly.assemblyName || assembly.assemblyRef || "").trim();
        const qty = Number(assembly.qty || 1);
        const notesText = String(assembly.notes || "").trim();
        const parts = [];
        if (name) parts.push(name);
        if (Number.isFinite(qty) && qty > 1) parts.push(`Qty ${qty}`);
        if (notesText) parts.push(notesText);
        return parts.join(" - ");
      })
      .filter(Boolean);

    if (!items.length) return "";
    const shown = items.slice(0, MAX_ASSM_SUMMARIES);
    const extra = items.length - shown.length;
    return `Included assemblies: ${shown.join("; ")}${extra > 0 ? `; ${extra} more` : ""}`;
  }

  function summarizePoints(points) {
    const items = (Array.isArray(points) ? points : [])
      .map((point) => {
        if (!point || typeof point !== "object") return "";
        const name = String(point.name || "Point").trim();
        const qty = Number(point.qty || 1);
        const notesText = String(point.notes || "").trim();
        const assemblyText = summarizeAssemblies(point.assemblies);
        const parts = [];
        if (name) parts.push(name);
        if (Number.isFinite(qty) && qty > 1) parts.push(`Qty ${qty}`);
        if (notesText) parts.push(notesText);
        if (assemblyText) parts.push(assemblyText);
        return parts.join(" - ");
      })
      .filter(Boolean);

    if (!items.length) return "";
    const shown = items.slice(0, MAX_POINT_SUMMARIES);
    const extra = items.length - shown.length;
    return `Included points: ${shown.join("; ")}${extra > 0 ? `; ${extra} more` : ""}`;
  }

  const systemItems = systems.map((system, index) => {
    if (!system || typeof system !== "object") return "";

    const label = String(system.name || `System ${index + 1}`).trim();
    const qty = Number(system.qty || 1);
    const type = String(system.type || "").trim();
    const location = String(system.location || "").trim();
    const sourceText = String(system.sourceText || "").trim();
    const notesText = String(system.notes || "").trim();
    const meta = joinClean([
      Number.isFinite(qty) && qty > 1 ? `Qty ${qty}` : "",
      type && !["equipment", "system", "misc"].includes(type.toLowerCase()) ? type : "",
      location,
    ]);
    const pointSummary = summarizePoints(system.points);
    const description = joinClean([sourceText, notesText], ". ");

    return `<li><strong>${esc(label)}</strong>${
      meta ? `<div style="margin-top:4px; font-size:13px; line-height:1.6; color:var(--muted);">${esc(meta)}</div>` : ""
    }${
      description ? `<div style="margin-top:4px; font-size:13px; line-height:1.7;">${esc(description)}</div>` : ""
    }${
      pointSummary ? `<div style="margin-top:4px; font-size:13px; line-height:1.7;">${esc(pointSummary)}</div>` : ""
    }</li>`;
  }).filter(Boolean);

  const sections = [];
  if (systemItems.length) {
    sections.push(`<li><strong>${esc(String(scopeImport.baseScopeName || "Scope"))}</strong><div style="margin-top:4px;"><ul style="margin:0; padding-left:18px; line-height:1.7;">${systemItems.join("")}</ul></div></li>`);
  }
  if (assumptions.length) {
    sections.push(`<li><strong>Assumptions</strong><ul style="margin-top:4px; padding-left:18px; line-height:1.7;">${assumptions.map((item) => `<li>${esc(String(item || "").trim())}</li>`).filter(Boolean).join("")}</ul></li>`);
  }
  if (exclusions.length) {
    sections.push(`<li><strong>Exclusions</strong><ul style="margin-top:4px; padding-left:18px; line-height:1.7;">${exclusions.map((item) => `<li>${esc(String(item || "").trim())}</li>`).filter(Boolean).join("")}</ul></li>`);
  }
  if (notes.length) {
    sections.push(`<li><strong>Notes</strong><ul style="margin-top:4px; padding-left:18px; line-height:1.7;">${notes.map((item) => `<li>${esc(String(item || "").trim())}</li>`).filter(Boolean).join("")}</ul></li>`);
  }

  return sections.length ? `<ul class="scope-list">${sections.join("")}</ul>` : "";
}

function getProposalScopeHtml(settings) {
  if (settings?.customerScopeImport) {
    const importedHtml = renderImportedScopeList(settings.customerScopeImport);
    if (importedHtml) return importedHtml;
  }

  return renderCustomerScope(settings.customerScope);
}

function getClarificationItems(settings) {
  return [
    "This proposal shall be incorporated into any final contract terms and conditions.",
    "Pricing is based on normal working hours (Monday through Friday). No overtime labor is included in the pricing above.",
    "Overtime policy:",
    "If an accurate construction schedule is provided at contract execution, TCC will absorb any required overtime to meet contractual milestones.",
    "If no accurate schedule is provided, overtime will be billed at 1.5× the burdened labor rate and will be executed only with an approved change order.",
    "All concealed but accessible wiring shall be installed using plenum-rated cable, following proper installation techniques in a neat and workmanlike manner.",
    "All exposed or inaccessible wiring shall be installed in EMT conduit.",
    "Communication wiring between units may be installed using metallic-armored cable (MC) where permitted by the project specifications.",
    "The Controls Company reserves the right to withdraw or revise this proposal in the event of a substantial change in scope.",
    "Any controls devices provided by others must be delivered to the site and ready for installation prior to TCC's scheduled mobilization.",
    "Installation labor for controls devices furnished by others; conduit, control and communication wiring; incidental installation material; device mounting and terminations; and normal field coordination required to complete the physical controls installation scope.",
  ].filter(item => !(isEmtBid(settings) && /plenum-rated cable/i.test(item)));
}

function getExclusionItems() {
  return [
    "All HVAC equipment, VFDs, motor starters, and disconnects not specifically listed in the scope above are by others.",
    "120VAC power wiring to all DDC panels is by the electrical contractor.",
    "All field devices, including control valves, flow meters, sensors, immersion wells, airflow measuring stations, dampers, and actuators not specifically listed in the scope above, are furnished by others and installed by others unless noted.",
    "All controls devices, supervisory hardware, enclosure components, and software licenses are by others.",
    "Programming, graphics, as-built drawings, operator training, startup, commissioning, and TAB support are by others.",
    "Smoke detectors, smoke dampers, combination fire/smoke dampers, fire dampers, and associated actuators and wiring are by others.",
    "Operator workstation hardware and software are excluded.",
    "After-hour, weekend, or holiday work.",
    "Any 120V power wiring not specifically included above.",
    "Network data drops and IT infrastructure unless noted in the scope above.",
    "BIM modeling.",
    "Demolition not specifically listed in the scope above.",
    "Additional LEED documentation or third-party commissioning hours incur additional cost.",
  ];
}

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

function normalizeAlternates(estimate) {
  const source = Array.isArray(estimate?.alternates) ? estimate.alternates : [];
  return source
    .map((alternate, index) => {
      if (!alternate || typeof alternate !== "object") return null;

      const alt = alternate;
      const label = String(alt.label || alt.name || alt.title || `Alternate ${index + 1}`).trim();
      const description = String(alt.description || alt.scope || alt.notes || "").trim();
      const amountValue = Number(alt.amount ?? alt.price ?? alt.value ?? 0);
      const items = Array.isArray(alt.items) ? alt.items : [];
      const settings = alt.settings && typeof alt.settings === "object" ? alt.settings : {};

      if (!label) return null;

      return {
        label,
        description,
        amount: Number.isFinite(amountValue) ? amountValue : 0,
        items,
        settings,
      };
    })
    .filter(Boolean);
}

function renderPricingTable(baseScopeName, grandTotal, totalBond, alternates = []) {
  const baseRows = [
    `
          <tr>
            <td>${esc(baseScopeName)}</td>
            <td class="cell-number">${fmtMoney(grandTotal)}</td>
          </tr>`,
    `
          <tr class="row-bond">
            <td><strong>Optional performance and payment bond</strong></td>
            <td class="cell-number">add ${fmtMoney(totalBond || 0)}</td>
          </tr>`,
  ];

  const alternateRows = alternates.flatMap((alternate) => {
    const alternateTotal = Number(alternate.total || 0);
    const alternateBond = Number(alternate.bond || 0);
    return [
      `
          <tr>
            <td>${esc(alternate.label)}</td>
            <td class="cell-number">${fmtMoney(alternateTotal)}</td>
          </tr>`,
      `
          <tr class="row-bond">
            <td><strong>Optional performance and payment bond</strong></td>
            <td class="cell-number">add ${fmtMoney(alternateBond)}</td>
          </tr>`,
    ];
  });

  const totalPrice = [grandTotal || 0, totalBond || 0, ...alternates.map((alternate) => Number(alternate.total || 0) + Number(alternate.bond || 0))]
    .reduce((sum, value) => sum + value, 0);

  return `
      <table>
        <thead>
          <tr>
            <th style="width:72%;">Description</th>
            <th class="cell-number" style="width:28%;">Price</th>
          </tr>
        </thead>
        <tbody>
${baseRows.join("\n")}
${alternateRows.join("\n")}
          <tr class="row-total">
            <td><strong>TOTAL PRICE</strong></td>
            <td class="cell-number"><strong>${fmtMoney(totalPrice)}</strong></td>
          </tr>
        </tbody>
      </table>
`;
}

function renderAlternateScopeSections(alternates, scopeMode) {
  if (!alternates.length) return "";

  const blocks = alternates.map((alternate) => {
    const raw = calcEstimate({ items: alternate.items || [] });
    const alternateSettings = {
      ...DEFAULT_SETTINGS,
      ...(alternate.settings || {}),
      trips: raw.lbrHrs > 0 ? Math.max(1, Math.ceil(raw.lbrHrs / 20)) : 1,
    };
    const alternateEstimate = {
      items: alternate.items || [],
      settings: alternateSettings,
    };
    const alternateScopeMode = alternateSettings.proposalScopeMode === "detailed" ? "detailed" : scopeMode;
    const useCustomerScope = Boolean(alternateSettings.useCustomerScope && String(alternateSettings.customerScope || "").trim());
    const alternateScope = useCustomerScope
      ? getProposalScopeHtml(alternateSettings)
      : alternate.items?.length
        ? renderGeneratedScope(buildItemsWithComps(alternateEstimate), alternateScopeMode)
        : "";
    const projectTitle = getAlternateProjectTitle(alternate);

    return `
      <div class="section" style="margin-top:20px;">
        <h2>Scope Of Work - ${esc(projectTitle)}</h2>
      </div>
      <div class="callout" style="margin-top:12px;">
        ${alternate.description ? `<div style="margin-bottom:6px; color:var(--muted); font-size:12px;">${esc(alternate.description)}</div>` : ""}
        ${alternateScope ? `<div>${alternateScope}</div>` : `<div style="font-size:13px; color:var(--muted);">No alternate scope details were provided.</div>`}
      </div>
    `;
  }).join("");

  return `
${blocks}
`;
}

function replacePricingSection(template, pricingHtml) {
  const start = template.indexOf("      <table>", template.indexOf("<!-- PRICING -->"));
  const end = template.indexOf("      <!-- SCOPE OF WORK -->");

  if (start === -1 || end === -1 || end <= start) return template;
  return `${template.slice(0, start)}${pricingHtml}\n${template.slice(end)}`;
}

function insertAlternateScopeSection(template, alternateHtml) {
  const marker = "      <!-- CLARIFICATIONS -->";
  const index = template.indexOf(marker);
  if (index === -1) return template;
  return `${template.slice(0, index)}${alternateHtml}\n${template.slice(index)}`;
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

function renderGeneratedScope(itemsWithComps = [], mode = "brief") {
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

  const rows = itemsWithComps.map(entry => {
    const item = entry.item || {};
    const qty = Math.max(1, Number(item.qty) || 1);
    const tag = String(item.tag || "").trim();
    const typeLabel = TYPE_SCOPE_LABELS[item.type] || "HVAC Controls System";
    const locations = [item.location].filter(Boolean);
    const components = summarizeComponents([entry]);

    if (mode !== "detailed") {
      return `<li><strong>Qty ${qty} ${esc(tag || typeLabel)}</strong></li>`;
    }

    return `
        <li><strong>Qty ${qty} ${esc(tag || typeLabel)}</strong>
          <ul style="margin-top:4px; padding-left:18px; line-height:1.7;">
            ${locations.length ? `<li>Work area${locations.length > 1 ? "s" : ""} include ${esc(locations.join(", "))}.</li>` : ""}
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
      <ul class="scope-list">
${rows}
      </ul>`;
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
    (html, [token, value]) => html.replaceAll(
      `{{${token}}}`,
      token.endsWith("_HTML") ? String(value ?? "") : esc(value),
    ),
    template,
  );
}

function embedTemplateImages(template, assets) {
  return template
    .replace(/file:\/\/\/C:\/Users\/TimothyCollins\/dev\/tcc-templates\/reports\/logo\.png/g, assets.logo)
    .replace(/file:\/\/\/C:\/Users\/TimothyCollins\/dev\/tcc-templates\/reports\/sdvosb\.jpg/g, assets.badge)
    .replace(/file:\/\/\/C:\/Users\/TimothyCollins\/OneDrive - The Controls Company, LLC\/Pictures\/Signature_Blue\.png/g, assets.signature)
    .replace(/src="[^"]*reports\/logo\.png"/g, `src="${assets.logo}"`)
    .replace(/src="[^"]*reports\/sdvosb\.jpg"/g, `src="${assets.badge}"`)
    .replace(/src="[^"]*Signature_Blue\.png"/g, `src="${assets.signature}"`)
    .replace(/src="\/report-assets\/logo\.png"/g, `src="${assets.logo}"`)
    .replace(/src="\/report-assets\/sdvosb\.jpg"/g, `src="${assets.badge}"`)
    .replace(/src="\/report-assets\/signature-blue\.png"/g, `src="${assets.signature}"`);
}

export function buildProposalHtmlFromTemplate(template, estimate, itemsWithComps, grandTotal, bondAmount, assets) {
  const settings = estimate.settings || {};
  const projectName = estimate.name || "Proposal";
  const versionSuffix = getVersionSuffix(estimate);
  const installedTotal = grandTotal || 0;
  const totalBond = bondAmount || installedTotal * BOND_RATE;
  const scopeMode = settings.proposalScopeMode === "detailed" ? "detailed" : "brief";
  const baseScopeName = String(settings.baseScopeName || "Scope").trim() || "Scope";
  const useCustomerScope = Boolean(settings.useCustomerScope && String(settings.customerScope || "").trim());
  const scopeHtml = useCustomerScope
    ? getProposalScopeHtml(settings)
    : renderGeneratedScope(itemsWithComps, scopeMode);
  const alternates = normalizeAlternates(estimate).map((alternate) => {
    const raw = calcEstimate({ items: alternate.items || [] });
    const alternateSettings = {
      ...DEFAULT_SETTINGS,
      ...(alternate.settings || {}),
      trips: raw.lbrHrs > 0 ? Math.max(1, Math.ceil(raw.lbrHrs / 20)) : 1,
    };
    const alternateEstimate = {
      items: alternate.items || [],
      settings: alternateSettings,
    };
    const computedTotal = computeCosts(raw.mtl, raw.lbrHrs, alternateSettings, alternateEstimate.items || []).total || 0;
    const displayTotal = computedTotal || alternate.amount || 0;
    return {
      ...alternate,
      total: displayTotal,
      bond: displayTotal * BOND_RATE,
    };
  });
  const pricingHtml = renderPricingTable(baseScopeName, installedTotal, totalBond, alternates);
  const alternateScopeHtml = renderAlternateScopeSections(alternates, scopeMode);
  const clarificationHtml = renderBulletBlock(getClarificationItems(settings));
  const exclusionHtml = renderBulletBlock(getExclusionItems());

  const tokens = {
    PAGE_HEADER_PROJECT: `${projectName} | HVAC Controls Estimate`,
    PROJECT_NAME: `${projectName}${versionSuffix}`,
    CUSTOMER_NAME: estimate.customer || "-",
    CUSTOMER_CONTACT: getCustomerContact(estimate, settings) || "-",
    SITE_ADDRESS: getSiteAddress(settings) || "-",
    DRAWING_BASIS: getDrawingBasis(settings),
    ESTIMATE_DATE: formatEstimateDate(settings.estimateDate),
    SCOPE_INTRO: getScopeIntro(estimate),
    BASE_SCOPE_TITLE: `Scope Of Work - ${baseScopeName}`,
    SECTION_1_LABEL: baseScopeName,
    SECTION_1_PRICE: fmtMoney(installedTotal),
    SECTION_1_BOND: fmtMoney(totalBond),
    GRAND_TOTAL: fmtMoney(installedTotal),
    GRAND_TOTAL_WITH_BOND: fmtMoney(installedTotal + totalBond),
    CLARIFICATIONS_HTML: clarificationHtml,
    EXCLUSIONS_HTML: exclusionHtml,
  };

  return embedTemplateImages(
    insertAlternateScopeSection(
      replaceScopeSection(replacePricingSection(replaceTemplateTokens(template, tokens), pricingHtml), scopeHtml),
      alternateScopeHtml,
    ),
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
  return { blob, fileName };
}

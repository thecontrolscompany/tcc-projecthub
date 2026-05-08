/**
 * Browser-side customer proposal generator.
 *
 * Builds a standalone, printable HTML report using the standard TCC report
 * template style and triggers a .html download.
 */

const COMPANY_NAME = "The Controls Company, LLC";
const COMPANY_SITE = "thecontrolscompany.com";
const PROPOSAL_TITLE = "HVAC Controls Installation Proposal";

const fmtMoney = value =>
  "$" + Math.ceil(value || 0).toLocaleString("en-US");

const esc = value =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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

async function fetchDataUrl(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load proposal asset ${path} (${response.status})`);
  }

  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error(`Could not read ${path}`));
    reader.readAsDataURL(blob);
  });
}

async function loadProposalAssets() {
  try {
    const [logo, badge] = await Promise.all([
      fetchDataUrl("/report-assets/logo.png"),
      fetchDataUrl("/report-assets/sdvosb.jpg"),
    ]);
    return { logo, badge };
  } catch (error) {
    console.warn("Proposal assets could not be embedded:", error);
    return { logo: "", badge: "" };
  }
}

function renderMetaRows(rows) {
  return rows.map(([label, value]) => `
        <div class="meta-label">${esc(label)}:</div>
        <div>${esc(value || "-")}</div>
  `).join("");
}

function renderList(items) {
  return `
      <ol class="proposal-list">
        ${items.map(item => `<li>${esc(item)}</li>`).join("")}
      </ol>
  `;
}

function renderScopeTable(itemsWithComps) {
  return `
      <table class="scope-table">
        <thead>
          <tr>
            <th class="cell-center qty-col">Qty</th>
            <th>System</th>
            <th>Included Scope</th>
          </tr>
        </thead>
        <tbody>
          ${itemsWithComps.map(({ item, compNames }) => {
            const systemName = item.tag
              ? `${item.tag} - ${item.label}`
              : item.label;
            const rows = (compNames?.length ? compNames : ["Installation per project specifications"])
              .map((name, index) => `
                <tr>
                  ${index === 0 ? `
                    <td class="cell-center scope-qty" rowspan="${compNames?.length || 1}">${esc(item.qty || 1)}</td>
                    <td class="scope-system" rowspan="${compNames?.length || 1}">${esc(systemName)}</td>
                  ` : ""}
                  <td>${esc(name)}</td>
                </tr>
              `).join("");
            return rows;
          }).join("")}
        </tbody>
      </table>
  `;
}

function renderAssetImage(src, alt, className, fallbackText) {
  if (src) {
    return `<img src="${src}" alt="${esc(alt)}" class="${className}" />`;
  }
  return `<div class="${className} brand-fallback" aria-label="${esc(alt)}">${esc(fallbackText)}</div>`;
}

function buildReportStyles() {
  return `
    :root {
      color-scheme: light;
      --teal:        #017a6f;
      --teal-light:  #eef8f6;
      --page-bg:     #f4f7f6;
      --card-bg:     #ffffff;
      --text:        #111827;
      --label:       #374151;
      --muted:       #4b5563;
      --quiet:       #9ca3af;
      --border:      #d1d5db;
      --font:        Arial, Helvetica, sans-serif;
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    *, *::before, *::after { box-sizing: border-box; }

    @page {
      size: letter portrait;
      margin: 0.9in 0.75in 0.8in 0.75in;
    }

    body {
      margin: 0;
      background: var(--page-bg);
      color: var(--text);
      font-family: var(--font);
      font-size: 14px;
      line-height: 1.5;
    }

    body, body * { color: var(--text); }

    .page {
      max-width: 8in;
      margin: 0 auto;
      padding: 24px;
    }

    .print-header,
    .print-footer {
      display: none;
    }

    .print-header {
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 6pt;
      border-bottom: 1pt solid var(--teal);
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8pt;
      color: var(--muted);
    }

    .print-header-right {
      text-align: right;
    }

    .print-footer {
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding-top: 6pt;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 7.5pt;
      color: var(--quiet);
    }

    .print-footer-right {
      text-align: right;
      font-size: 8pt;
      color: var(--muted);
    }

    .print-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-bottom: 18px;
    }

    .print-actions button {
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      border-radius: 999px;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: var(--font);
    }

    .print-actions button:hover {
      border-color: var(--teal);
      color: var(--teal);
    }

    .report {
      background: var(--card-bg);
      padding: 28px;
      border: 1px solid var(--border);
    }

    .brand-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .brand-logo  { width: 160px; height: 160px; object-fit: contain; }
    .brand-badge { width: 120px; height: 120px; object-fit: contain; }

    .brand-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border);
      color: var(--teal);
      font-weight: 700;
      text-align: center;
      padding: 8px;
    }

    .brand-copy { flex: 1; text-align: center; }

    .brand-copy h1 {
      margin: 0 0 4px;
      font-size: 20px;
      color: var(--teal);
      letter-spacing: 0.04em;
    }

    .brand-copy p {
      margin: 0;
      font-size: 12px;
      color: var(--muted);
    }

    .document-title {
      margin: 18px 0 0;
      text-align: center;
      font-size: 22px;
      font-weight: 700;
      color: var(--text);
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .section {
      margin: 22px 0 14px;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--teal);
    }

    .section h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: var(--teal);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 8px 14px;
      font-size: 14px;
    }

    .meta-label {
      font-weight: 700;
      color: var(--label);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    th, td {
      border: 1px solid var(--border);
      padding: 8px 10px;
      vertical-align: top;
    }

    thead th {
      background: var(--teal-light);
      color: #0f172a;
      text-align: left;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .cell-number {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .cell-center { text-align: center; }

    .row-total td {
      background: var(--teal);
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
    }

    .callout {
      margin-top: 14px;
      padding: 12px 14px;
      border: 1px solid var(--border);
      background: #fafafa;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .scope-table {
      table-layout: fixed;
    }

    .scope-table tr:nth-child(even) td {
      background: #f8fafc;
    }

    .qty-col {
      width: 64px;
    }

    .scope-qty {
      font-size: 16px;
      font-weight: 700;
      color: var(--teal);
    }

    .scope-system {
      width: 190px;
      font-weight: 700;
      color: var(--label);
    }

    .proposal-list {
      margin: 0;
      padding-left: 22px;
    }

    .proposal-list li {
      margin: 0 0 7px;
      padding-left: 4px;
    }

    .proposal-terms {
      break-before: page;
      page-break-before: always;
    }

    .sig-block {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      font-size: 13px;
      margin-top: 24px;
    }

    .sig-line {
      border-top: 1px solid var(--quiet);
      padding-top: 6px;
      margin-top: 40px;
      color: var(--label);
    }

    .footer {
      margin-top: 24px;
      padding-top: 14px;
      border-top: 2px solid var(--teal);
      text-align: center;
      font-size: 12px;
      color: var(--muted);
    }

    @media print {
      body { background: #ffffff; }
      .no-print { display: none !important; }
      .page { max-width: none; margin: 0; padding: 0; }
      .report { border: 0; padding: 0; }
      .footer { display: none; }

      .print-header,
      .print-footer {
        display: flex;
        position: fixed;
        left: 0;
        right: 0;
      }

      .print-header { top: 0; }
      .print-footer { bottom: 0; }

      .report {
        margin-top: 18pt;
        margin-bottom: 18pt;
      }

      tr, .sig-block, .callout {
        break-inside: avoid;
      }
    }

    @media (max-width: 720px) {
      .page {
        padding: 12px;
      }

      .report {
        padding: 18px;
      }

      .brand-row {
        align-items: center;
      }

      .brand-logo {
        width: 88px;
        height: 88px;
      }

      .brand-badge {
        width: 72px;
        height: 72px;
      }

      .brand-copy h1 {
        font-size: 15px;
      }

      .document-title {
        font-size: 18px;
      }

      .meta-grid {
        grid-template-columns: 130px 1fr;
      }

      .scope-table {
        table-layout: auto;
      }

      th, td {
        padding: 7px 8px;
      }
    }
  `;
}

export function buildProposalHtml(estimate, itemsWithComps, grandTotal, bondAmount = 0, assets = {}) {
  const dateStr = todayStr();
  const projectName = estimate.name || "Proposal";
  const settings = estimate.settings || {};
  const siteAddress = [settings.address, settings.city, settings.state, settings.zip]
    .filter(Boolean)
    .join(", ");
  const reference = estimate.number
    ? `Estimate #${estimate.number}${estimate.version ? ` v${estimate.version}` : ""}`
    : "";

  const scopeItems = [
    "Provide and install all raceways and wiring required for installation.",
    "Install field devices per drawings; devices are provided by others unless specifically noted in this proposal.",
    "Valves, temperature wells, and pressure taps are installed by others unless specifically noted in this proposal.",
  ];

  const clarifications = [
    "This proposal shall be incorporated into any final contract terms and conditions.",
    "Pricing is based on normal working hours, Monday through Friday. No overtime labor is included in the pricing above.",
    "If an accurate construction schedule is provided at contract execution, The Controls Company will absorb any required overtime to meet contractual milestones.",
    "If no accurate schedule is provided, overtime will be billed at 1.5 times the burdened labor rate and shall be executed only with an approved change order.",
    "All concealed but accessible wiring shall be installed using plenum-rated cable, following proper installation techniques in a neat and workmanlike manner.",
    "All exposed or inaccessible wiring shall be installed in EMT conduit.",
    "Communication wiring between units may be installed using metallic-armored cable where permitted by the project specifications.",
    "The Controls Company reserves the right to withdraw or revise this proposal in the event of a substantial change in scope.",
    "Any devices provided by others, such as sensors and actuators, must be delivered to the site and ready for installation.",
    "The Controls Company is not responsible for delays caused by missing, incompatible, or non-functional equipment and reserves the right to issue a change order for additional labor or material required.",
  ];

  const exclusions = [
    "Furnishing of any control damper unless noted in the scope above.",
    "Furnishing of any electric meter, water meter, or gas meter.",
    "Furnishing, installation, and wiring of VFDs, except control signal and communication wiring.",
    "Furnishing, installation, and wiring of smoke detectors, smoke dampers, combination fire/smoke dampers, fire dampers, and associated actuators and wiring unless noted in the scope above.",
    "Installation of dampers, airflow measuring stations, valves, immersion wells, pressure taps, or flow meters.",
    "After-hour, weekend, or holiday work.",
    "Any 120V wiring.",
    "Network data drops and wiring unless noted in the scope above.",
    "BIM modeling.",
    "Demolition unless noted in the scope above.",
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(projectName)} - ${esc(PROPOSAL_TITLE)}</title>
  <style>${buildReportStyles()}</style>
</head>
<body>
  <main class="page">
    <div class="print-header" aria-hidden="true">
      <div>${esc(COMPANY_NAME)}</div>
      <div class="print-header-right">${esc(projectName)} - ${esc(PROPOSAL_TITLE)}</div>
    </div>

    <div class="print-footer" aria-hidden="true">
      <div>${esc(COMPANY_SITE)} | Service Disabled Veteran Owned Small Business</div>
      <div class="print-footer-right">Proposal Date: ${esc(dateStr)}</div>
    </div>

    <div class="print-actions no-print">
      <button type="button" onclick="window.print()">Print / Save as PDF</button>
    </div>

    <article class="report">
      <div class="brand-row">
        ${renderAssetImage(assets.logo, COMPANY_NAME, "brand-logo", "TCC")}
        <div class="brand-copy">
          <h1>THE CONTROLS COMPANY, LLC</h1>
          <p>Service Disabled Veteran Owned Small Business</p>
          <p style="margin-top:4px;">${esc(COMPANY_SITE)}</p>
        </div>
        ${renderAssetImage(assets.badge, "SDVOSB", "brand-badge", "SDVOSB")}
      </div>

      <h2 class="document-title">${esc(PROPOSAL_TITLE)}</h2>

      <div class="section" style="margin-top:20px;">
        <h2>Project Information</h2>
      </div>
      <div class="meta-grid">
        ${renderMetaRows([
          ["Company Name", COMPANY_NAME],
          ["Proposal Date", dateStr],
          ["Project Name", projectName],
          ["Customer", estimate.customer || ""],
          ["Site Address", siteAddress],
          ["Reference", reference],
        ])}
      </div>

      <div class="section">
        <h2>Pricing Summary</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="cell-number">Total Price</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Base Bid</strong></td>
            <td class="cell-number"><strong>${fmtMoney(grandTotal)}</strong></td>
          </tr>
          <tr>
            <td>Bond (if required)</td>
            <td class="cell-number">${fmtMoney(bondAmount)}</td>
          </tr>
        </tbody>
      </table>

      <div class="section">
        <h2>Scope of Work</h2>
      </div>
      ${renderList(scopeItems)}

      <div class="section">
        <h2>Base Proposal</h2>
      </div>
      ${renderScopeTable(itemsWithComps || [])}

      <div class="proposal-terms">
        <div class="section">
          <h2>Warranty</h2>
        </div>
        ${renderList([
          "Includes warranty for one year from date of owner's acceptance of a certificate of substantial completion.",
        ])}

        <div class="section">
          <h2>Clarifications</h2>
        </div>
        ${renderList(clarifications)}

        <div class="section">
          <h2>Exclusions</h2>
        </div>
        ${renderList(exclusions)}

        <div class="callout">
          <strong>Proposal Validity:</strong> This proposal is valid for 30 days from the proposal date.
        </div>

        <div class="section">
          <h2>Authorization</h2>
        </div>
        <div class="sig-block">
          <div>
            <p style="margin:0 0 4px; font-weight:600;">Purchaser</p>
            <p style="margin:0 0 2px;">Company Name: ${esc(estimate.customer || "")}</p>
            <p style="margin:0; color:var(--muted); font-size:12px;">Name / Title</p>
            <div class="sig-line">Signature &amp; Date</div>
          </div>
          <div>
            <p style="margin:0 0 4px; font-weight:600;">Submitted By</p>
            <p style="margin:0 0 2px;">Timothy J. Collins, MBA</p>
            <p style="margin:0; color:var(--muted); font-size:12px;">President, ${esc(COMPANY_NAME)}</p>
            <div class="sig-line">Signature &amp; Date</div>
          </div>
        </div>
      </div>

      <footer class="footer">
        <div>${esc(COMPANY_NAME)} | ${esc(COMPANY_SITE)}</div>
        <div>Service Disabled Veteran Owned Small Business</div>
      </footer>
    </article>
  </main>
</body>
</html>`;
}

/**
 * @param {object} estimate       - { name, number, customer, version, settings }
 * @param {Array}  itemsWithComps - [{ item: {qty,tag,label}, compNames: string[] }]
 * @param {number} grandTotal     - final total ($)
 * @param {number} bondAmount     - bond amount ($)
 */
export async function generateProposal(estimate, itemsWithComps, grandTotal, bondAmount = 0) {
  const assets = await loadProposalAssets();
  const html = buildProposalHtml(estimate, itemsWithComps, grandTotal, bondAmount, assets);
  const blob = new Blob([html], { type: "text/html" });
  const safeName = sanitizeFileName(estimate.name);
  const fileName = `TCC_Proposal_${safeName}_${isoDateStr()}.html`;
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

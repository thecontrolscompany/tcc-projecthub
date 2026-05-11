import { DEFAULT_SETTINGS } from "../projectSettings.js";
import { VAV_COMPS } from "../../vav/vavData.js";
import { AHU_COMPS, AHU_TYPES } from "../../ahu/ahuData.js";
import { RTU_COMPS } from "../../rtu/rtuData.js";
import { FCU_COMPS } from "../../fcu/fcuData.js";
import { UH_COMPS } from "../../uh/uhData.js";
import { PLANT_COMPS, PLANT_TYPES } from "../../plant/plantData.js";
import { NETWORK_COMPS } from "../../network/networkData.js";
import { EXHAUST_FAN_COMPS } from "../../exhaustFan/exhaustFanData.js";
import { getAllEquipmentComponents } from "../../../shared/componentCatalog.js";
import { calcAssembly } from "../../../shared/assemblyData.js";

const CUSTOM_COMPS = getAllEquipmentComponents();

const COMPS_MAP = {
  vav: VAV_COMPS,
  ahu: AHU_COMPS,
  rtu: RTU_COMPS,
  fcu: FCU_COMPS,
  uh: UH_COMPS,
  network: NETWORK_COMPS,
  "exhaust-fan": EXHAUST_FAN_COMPS,
  custom: CUSTOM_COMPS,
};

const TYPE_LABELS = {
  vav: "VAV",
  ahu: "AHU",
  rtu: "RTU",
  fcu: "FCU",
  uh: "UH",
  plant: "PLANT",
  network: "NET",
  "exhaust-fan": "EF",
  custom: "CUST",
};

const fmtMoney = value =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);

const fmtHours = value => `${(value || 0).toFixed(2)} hrs`;

const fmtDateTime = value => {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString();
};

const esc = value =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function getComponentsForItem(item) {
  if (item.type === "plant" && item.cfg?.plantType) {
    return PLANT_COMPS[item.cfg.plantType] || [];
  }
  if (item.type === "custom" && item.cfg?.componentId) {
    const custom = COMPS_MAP.custom || [];
    const selected = custom.find(entry => entry.id === item.cfg.componentId);
    return selected ? [selected] : custom;
  }
  return COMPS_MAP[item.type] || [];
}

function getAssemblyCost(item, comp) {
  const aid = String(item.installType === "EMT" ? comp.emtAID : comp.plnAID);
  const snap = item.priceSnap?.[comp.id] || (aid && aid !== "undefined" ? item.priceSnap?.[aid] : null);
  if (snap) {
    return {
      unitMtl: snap.mtl || 0,
      unitLbr: snap.lbr || 0,
      source: "Locked Price",
      assemblyId: aid && aid !== "undefined" ? aid : "",
    };
  }
  if (!aid || aid === "undefined") {
    return {
      unitMtl: comp.unitMtl || 0,
      unitLbr: comp.unitLbr || 0,
      source: "Component Default",
      assemblyId: "",
    };
  }
  const asm = calcAssembly(aid);
  return {
    unitMtl: asm.mtl || 0,
    unitLbr: asm.lbr || 0,
    source: "Assembly",
    assemblyId: aid,
  };
}

function getCustomCost(item, custom) {
  const aid = String(item.installType === "EMT" ? custom.emtAID : custom.plnAID);
  if (aid && aid !== "undefined") {
    const asm = calcAssembly(aid);
    return {
      unitMtl: asm.mtl || 0,
      unitLbr: asm.lbr || 0,
      source: "Assembly",
      assemblyId: aid,
    };
  }
  return {
    unitMtl: (custom.unitMtl || 0) + (custom.extraMtl || 0),
    unitLbr: (custom.unitLbr || 0) + (custom.extraLbr || 0),
    source: "Manual Custom",
    assemblyId: "",
  };
}

function getTypeDetail(item) {
  if (item.type === "ahu" && item.cfg?.ahuType) {
    return AHU_TYPES.find(type => type.id === item.cfg.ahuType)?.label || "";
  }
  if (item.type === "plant" && item.cfg?.plantType) {
    return PLANT_TYPES.find(type => type.id === item.cfg.plantType)?.label || "";
  }
  if (item.type === "custom" && item.cfg?.componentId) {
    return (COMPS_MAP.custom || []).find(entry => entry.id === item.cfg.componentId)?.name
      || (COMPS_MAP.custom || []).find(entry => entry.id === item.cfg.componentId)?.label
      || "";
  }
  return "";
}

function buildItemDetails(item) {
  const comps = getComponentsForItem(item);
  const selected = item.selected || [];
  const selectedDetails = selected.map(sel => {
    const comp = comps.find(entry => entry.id === sel.id);
    if (!comp) {
      return {
        id: sel.id,
        name: sel.id,
        quantity: sel.qty || 1,
        missing: true,
        unitMaterial: 0,
        unitLaborHours: 0,
        extendedMaterial: 0,
        extendedLaborHours: 0,
      };
    }
    const cost = getAssemblyCost(item, comp);
    const qty = sel.qty || 1;
    return {
      id: comp.id,
      name: comp.name || comp.label || comp.id,
      category: comp.cat || "",
      quantity: qty,
      emtAID: comp.emtAID || "",
      plnAID: comp.plnAID || "",
      assemblyUsed: cost.assemblyId,
      costSource: cost.source,
      unitMaterial: cost.unitMtl,
      unitLaborHours: cost.unitLbr,
      extendedMaterial: cost.unitMtl * qty,
      extendedLaborHours: cost.unitLbr * qty,
    };
  });

  const customDetails = (item.custom || []).map(custom => {
    const cost = getCustomCost(item, custom);
    return {
      id: custom.id,
      name: custom.name || custom.label || "Custom",
      category: custom.category || custom.cat || "Custom",
      emtAID: custom.emtAID || "",
      plnAID: custom.plnAID || "",
      assemblyUsed: cost.assemblyId,
      costSource: cost.source,
      unitMaterial: cost.unitMtl,
      unitLaborHours: cost.unitLbr,
      notes: custom.notes || "",
    };
  });

  const unitMaterial =
    selectedDetails.reduce((sum, entry) => sum + (entry.extendedMaterial || 0), 0) +
    customDetails.reduce((sum, entry) => sum + (entry.unitMaterial || 0), 0);
  const unitLaborHours =
    selectedDetails.reduce((sum, entry) => sum + (entry.extendedLaborHours || 0), 0) +
    customDetails.reduce((sum, entry) => sum + (entry.unitLaborHours || 0), 0);

  return {
    id: item.id,
    type: item.type,
    typeLabel: TYPE_LABELS[item.type] || item.type,
    typeDetail: getTypeDetail(item),
    tag: item.tag || "",
    location: item.location || "",
    quantity: item.qty || 1,
    installType: item.installType || "",
    config: item.cfg || null,
    addedAt: item.addedAt || "",
    pricesLockedAt: item.pricesLockedAt || "",
    selectedComponents: selectedDetails,
    customComponents: customDetails,
    totals: {
      unitMaterial,
      unitLaborHours,
      totalMaterial: unitMaterial * (item.qty || 1),
      totalLaborHours: unitLaborHours * (item.qty || 1),
    },
  };
}

function sanitizeFileName(value) {
  return String(value || "estimate")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "estimate";
}

function renderRows(rows) {
  return rows.map(([label, value]) => `
    <tr>
      <th>${esc(label)}</th>
      <td>${esc(value)}</td>
    </tr>
  `).join("");
}

function renderComponentTable(title, rows) {
  if (!rows.length) return "";
  return `
    <div class="subsection">
      <div class="subheading">${esc(title)}</div>
      <table class="detail-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Qty</th>
            <th>Category</th>
            <th>Assembly</th>
            <th>Source</th>
            <th>Material</th>
            <th>Labor</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td>${esc(row.name)}</td>
              <td>${esc(row.quantity || 1)}</td>
              <td>${esc(row.category || (row.missing ? "Missing" : ""))}</td>
              <td>${esc(row.assemblyUsed || "")}</td>
              <td>${esc(row.costSource || (row.missing ? "Missing Component" : ""))}</td>
              <td>${fmtMoney(row.extendedMaterial ?? row.unitMaterial)}</td>
              <td>${fmtHours(row.extendedLaborHours ?? row.unitLaborHours)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function generateInternalEstimateExport(estimate, costs, currentUser) {
  const settings = { ...DEFAULT_SETTINGS, ...(estimate.settings || {}) };
  const items = (estimate.items || []).map(buildItemDetails);
  const rawMaterial = items.reduce((sum, item) => sum + item.totals.totalMaterial, 0);
  const rawLaborHours = items.reduce((sum, item) => sum + item.totals.totalLaborHours, 0);
  const exportedBy = currentUser?.name || currentUser?.email
    || estimate.updatedBy?.name || estimate.updatedBy?.email
    || estimate.createdBy?.name || estimate.createdBy?.email
    || "";

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${esc(estimate.name || "Internal Estimate Report")}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 24px;
            color: #0f172a;
            background: #ffffff;
          }
          h1, h2, h3 {
            margin: 0;
          }
          h1 {
            font-size: 28px;
            margin-bottom: 6px;
          }
          h2 {
            font-size: 16px;
            margin-bottom: 10px;
            color: #334155;
          }
          h3 {
            font-size: 15px;
            margin-bottom: 10px;
          }
          .meta, .summary, .settings, .item-card {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 14px 16px;
            margin-bottom: 16px;
          }
          .meta-grid, .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(220px, 1fr));
            gap: 12px;
          }
          .summary-grid {
            grid-template-columns: repeat(3, minmax(180px, 1fr));
          }
          .label {
            font-size: 11px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 4px;
          }
          .value {
            font-size: 14px;
            font-weight: 700;
          }
          .muted {
            color: #64748b;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          .kv-table th, .kv-table td {
            border-bottom: 1px solid #e2e8f0;
            padding: 7px 8px;
            text-align: left;
            font-size: 12px;
          }
          .kv-table th {
            width: 240px;
            color: #475569;
            font-weight: 700;
          }
          .detail-table th, .detail-table td {
            border-bottom: 1px solid #e2e8f0;
            padding: 7px 8px;
            text-align: left;
            font-size: 12px;
            vertical-align: top;
          }
          .detail-table th {
            background: #f8fafc;
            font-weight: 700;
          }
          .item-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 12px;
          }
          .tag {
            display: inline-block;
            font-size: 11px;
            font-weight: 700;
            background: #e2e8f0;
            color: #0f172a;
            padding: 3px 8px;
            border-radius: 999px;
            margin-right: 8px;
          }
          .subsection {
            margin-top: 12px;
          }
          .subheading {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #334155;
            margin-bottom: 6px;
          }
          @media print {
            body {
              margin: 12px;
            }
            .item-card {
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <h1>${esc(estimate.name || "Internal Estimate Report")}</h1>
        <h2>Internal Estimate Report</h2>

        <div class="meta">
          <div class="meta-grid">
            <div>
              <div class="label">Estimate Number</div>
              <div class="value">${esc(estimate.number || "-")}</div>
            </div>
            <div>
              <div class="label">Customer</div>
              <div class="value">${esc(estimate.customer || "-")}</div>
            </div>
            <div>
              <div class="label">Version</div>
              <div class="value">${esc(estimate.version || "-")}</div>
            </div>
            <div>
              <div class="label">Exported By</div>
              <div class="value">${esc(exportedBy || "-")}</div>
            </div>
            <div>
              <div class="label">Created By</div>
              <div class="value">${esc(estimate.createdBy?.name || estimate.createdBy?.email || "-")}</div>
              <div class="muted">${esc(fmtDateTime(estimate.createdAt) || "")}</div>
            </div>
            <div>
              <div class="label">Last Updated By</div>
              <div class="value">${esc(estimate.updatedBy?.name || estimate.updatedBy?.email || "-")}</div>
              <div class="muted">${esc(fmtDateTime(estimate.updatedAt) || "")}</div>
            </div>
          </div>
          ${estimate.notes ? `<div style="margin-top:12px;"><div class="label">Notes</div><div>${esc(estimate.notes)}</div></div>` : ""}
        </div>

        <div class="summary">
          <h3>Cost Summary</h3>
          <div class="summary-grid">
            <div><div class="label">Raw Material</div><div class="value">${fmtMoney(rawMaterial)}</div></div>
            <div><div class="label">Raw Labor</div><div class="value">${fmtHours(rawLaborHours)}</div></div>
            <div><div class="label">Labor Bucket</div><div class="value">${fmtMoney(costs.labor)}</div></div>
            <div><div class="label">Material Bucket</div><div class="value">${fmtMoney(costs.material)}</div></div>
            <div><div class="label">Overhead</div><div class="value">${fmtMoney(costs.overhead)}</div></div>
            <div><div class="label">Profit</div><div class="value">${fmtMoney(costs.profit)}</div></div>
            <div><div class="label">Bond</div><div class="value">${fmtMoney(costs.bond)}</div></div>
            <div><div class="label">Total</div><div class="value">${fmtMoney(costs.total)}</div></div>
          </div>
        </div>

        <div class="settings">
          <h3>Project Settings</h3>
          <table class="kv-table">
            <tbody>
              ${renderRows([
                ["Wage Rate", fmtMoney(settings.wageRate)],
                ["Overhead %", `${settings.overheadPct}%`],
                ["Profit %", `${settings.profitPct}%`],
                ["Bond %", `${settings.bondPct}%`],
                ["Vertical Market", settings.verticalMarket],
                ["Team", settings.team],
                ["Round Trip Miles", settings.milesOneWay],
                ["Trips", settings.trips],
                ["VAV Field Mount", settings.vavFieldMount ? "Yes" : "No"],
                ["Fire Seals", settings.fireSeals ? "Yes" : "No"],
                ["Misc Materials", settings.miscMaterials ? "Yes" : "No"],
              ])}
            </tbody>
          </table>
        </div>

        ${items.map(item => `
          <div class="item-card">
            <div class="item-header">
              <div>
                <div>
                  <span class="tag">${esc(item.tag || item.typeLabel)}</span>
                  <strong>${esc(item.typeLabel)}${item.typeDetail ? ` - ${esc(item.typeDetail)}` : ""}</strong>
                </div>
                <div class="muted" style="margin-top:4px;">
                  Location: ${esc(item.location || "-")} | Qty: ${esc(item.quantity)} | Install: ${esc(item.installType || "-")}
                </div>
                ${(item.addedAt || item.pricesLockedAt) ? `
                  <div class="muted" style="margin-top:4px;">
                    ${item.addedAt ? `Added: ${esc(fmtDateTime(item.addedAt))}` : ""}
                    ${item.addedAt && item.pricesLockedAt ? " | " : ""}
                    ${item.pricesLockedAt ? `Prices Locked: ${esc(fmtDateTime(item.pricesLockedAt))}` : ""}
                  </div>
                ` : ""}
              </div>
              <div style="text-align:right;">
                <div class="label">Unit Cost</div>
                <div class="value">${fmtMoney(item.totals.unitMaterial)} | ${fmtHours(item.totals.unitLaborHours)}</div>
                <div class="muted">${fmtMoney(item.totals.totalMaterial)} | ${fmtHours(item.totals.totalLaborHours)} total</div>
              </div>
            </div>
            ${renderComponentTable("Selected Components", item.selectedComponents)}
            ${renderComponentTable("Custom Components", item.customComponents)}
          </div>
        `).join("")}
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFileName(estimate.name)}-internal-estimate.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

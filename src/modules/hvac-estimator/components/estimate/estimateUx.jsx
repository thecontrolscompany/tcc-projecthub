import { useEffect, useMemo, useState } from "react";
import { ProjectSettingsPanel } from "./ProjectSettingsPanel.jsx";
import { T } from "../../shared/tokens.js";
import { fmt$, fmtHr } from "../../shared/utils.js";
import { getEstimateScopeModeLabel } from "./projectSettings.js";
import { TYPE_META, calcItem, deriveEstimatorCostBuckets } from "./estimateCalc.js";
import { ControlsBomTab } from "./ControlsBomTab.jsx";

const HEALTH_WINDOW = 5;

const severityStyles = {
  info: {
    label: "Info",
    color: T.blue,
    bg: T.blueFaint,
    border: T.blueMid,
  },
  warning: {
    label: "Warning",
    color: T.amber,
    bg: "#FFF7ED",
    border: "#FDBA74",
  },
  critical: {
    label: "Critical",
    color: T.rose,
    bg: "#FFF1F2",
    border: "#FDA4AF",
  },
};

function clampPct(value) {
  const next = Number(value) || 0;
  return Math.max(0, Math.min(100, next));
}

function formatPercent(value) {
  return `${(Number(value) || 0).toFixed(1)}%`;
}

function formatSignedPercent(value) {
  const next = Number(value) || 0;
  const sign = next > 0 ? "+" : "";
  return `${sign}${next.toFixed(1)}%`;
}

function getMarginColor(pct) {
  if (pct >= 20) return T.green;
  if (pct >= 15) return T.amber;
  return T.rose;
}

function formatTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function TooltipLabel({ label, tooltip }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <span title={tooltip} className="cursor-help text-[10px] leading-none text-text-tertiary">
        ⓘ
      </span>
    </span>
  );
}

function SettingsToolCard({ title, description, onClick, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full w-full flex-col rounded-2xl border border-border-default bg-surface-overlay p-4 text-left transition hover:border-brand-primary/40 hover:bg-surface-base"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-default bg-surface-raised text-brand-primary">
          {icon}
        </span>
        <div>
          <div className="text-sm font-semibold text-text-primary">{title}</div>
          <div className="mt-0.5 text-xs text-text-tertiary">{description}</div>
        </div>
      </div>
    </button>
  );
}

function EstimateMarkupSettingsSection({ settings, onApply }) {
  const [draft, setDraft] = useState({
    overheadPct: Number(settings?.overheadPct ?? 10),
    profitPct: Number(settings?.profitPct ?? 25),
    bondPct: Number(settings?.bondPct ?? 4),
    wageRate: Number(settings?.wageRate ?? 42.95),
  });

  useEffect(() => {
    setDraft({
      overheadPct: Number(settings?.overheadPct ?? 10),
      profitPct: Number(settings?.profitPct ?? 25),
      bondPct: Number(settings?.bondPct ?? 4),
      wageRate: Number(settings?.wageRate ?? 42.95),
    });
  }, [settings?.bondPct, settings?.overheadPct, settings?.profitPct, settings?.wageRate]);

  const fields = [
    {
      key: "overheadPct",
      label: "Overhead Rate",
      tooltip: "Applied to labor + material before profit. This increases the bid price by covering overhead burden.",
      suffix: "%",
      step: 0.1,
    },
    {
      key: "profitPct",
      label: "Profit Rate",
      tooltip: "Applied after overhead. This determines the target profit portion of the bid price.",
      suffix: "%",
      step: 0.1,
    },
    {
      key: "bondPct",
      label: "Bond Rate",
      tooltip: "Applied to the subtotal after overhead and profit. It adds the optional payment/performance bond amount.",
      suffix: "%",
      step: 0.1,
    },
    {
      key: "wageRate",
      label: "Installation Labor Rate",
      tooltip: "Converts raw installation labor hours into labor dollars before markup is applied.",
      suffix: "$/hr",
      step: 0.01,
    },
  ];

  return (
    <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
            Estimate Markup Settings
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Changes apply to this estimate only. Default rates are set in Project Settings.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {fields.map((field) => (
          <label key={field.key} className="rounded-xl border border-border-default bg-surface-overlay p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
              <TooltipLabel label={field.label} tooltip={field.tooltip} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={field.step}
                value={draft[field.key]}
                onChange={(event) => {
                  const next = event.target.value === "" ? 0 : Number(event.target.value);
                  setDraft((current) => ({ ...current, [field.key]: Number.isFinite(next) ? next : 0 }));
                }}
                className="w-full rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-sm font-medium text-text-primary outline-none transition focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/40"
              />
              <span className="shrink-0 text-xs font-semibold text-text-tertiary">{field.suffix}</span>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => onApply?.(draft)}
          className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
        >
          Apply to This Estimate
        </button>
      </div>
    </section>
  );
}

function ProposalPreviewPanel({ proposalPreview }) {
  if (proposalPreview?.html) {
    return (
      <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold tracking-[0.08em] text-text-tertiary">
              Last generated proposal preview
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              {proposalPreview.generatedAt
                ? `Generated ${formatTimestamp(proposalPreview.generatedAt)}`
                : "Generated just now."}
            </p>
          </div>
          {proposalPreview.fileName ? (
            <div className="text-xs font-mono text-text-tertiary">{proposalPreview.fileName}</div>
          ) : null}
        </div>
        <iframe
          title="Last generated proposal preview"
          srcDoc={proposalPreview.html}
          className="mt-4 h-[600px] w-full rounded-2xl border border-border-default bg-white"
        />
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
      <div className="text-sm font-semibold text-text-primary">No proposal generated yet.</div>
      <p className="mt-1 text-sm text-text-secondary">
        Click &quot;Generate Proposal&quot; to create one.
      </p>
    </section>
  );
}

const EQUIPMENT_PICKER_GROUPS = [
  {
    label: "Air Handlers",
    items: [
      { type: "ahu", abbr: "AHU", name: "Air Handling Unit" },
      { type: "rtu", abbr: "RTU", name: "Roof Top Unit" },
    ],
  },
  {
    label: "Terminal Units",
    items: [
      { type: "vav", abbr: "VAV", name: "Variable Air Volume Box" },
      { type: "fcu", abbr: "FCU", name: "Fan Coil Unit" },
      { type: "uh", abbr: "UH", name: "Unit Heater" },
      { type: "exhaust-fan", abbr: "EF", name: "Exhaust Fan" },
    ],
  },
  {
    label: "Refrigerant Systems",
    items: [
      { type: "dx", abbr: "DX/HP", name: "Direct Expansion / Heat Pump" },
      { type: "vrf", abbr: "VRF", name: "Variable Refrigerant Flow" },
    ],
  },
  {
    label: "Hydronic / Plant",
    items: [
      { type: "plant", abbr: "PLANT", name: "Hydronic Plant" },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { type: "network", abbr: "NET", name: "Controls Network" },
      { type: "custom", abbr: "CUST", name: "Custom Assembly" },
    ],
  },
];

function getEquipmentCounts(estimate) {
  return (estimate?.items || []).reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
}

function EquipmentPickerModal({ open, counts, onClose, onAdd }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border-default bg-surface-raised shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">Add Equipment</div>
            <div className="mt-1 text-sm text-text-secondary">Choose the equipment type to add as a new estimate line item.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border-default px-3 py-1.5 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
          >
            Close
          </button>
        </div>
        <div className="grid gap-4 px-5 py-5">
          {EQUIPMENT_PICKER_GROUPS.map((group) => (
            <section key={group.label} className="grid gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">{group.label}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.items.map((item) => {
                  const count = counts[item.type] || 0;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => {
                        onAdd(item.type);
                        onClose();
                      }}
                      className="flex items-center justify-between gap-4 rounded-xl border border-border-default bg-surface-overlay px-4 py-3 text-left transition hover:border-brand-primary/40 hover:bg-brand-subtle/40"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-text-primary">{item.abbr}</div>
                        <div className="mt-1 text-sm text-text-secondary">{item.name}</div>
                      </div>
                      <span className="shrink-0 rounded-full border border-border-default bg-surface-raised px-2.5 py-1 text-xs font-semibold text-text-secondary">
                        ×{count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function getHealthLevel(bucket) {
  if (!bucket) return "good";
  const diff = Math.abs((bucket.pct || 0) - (bucket.target || 0));
  if (diff <= HEALTH_WINDOW) return "good";
  if (diff <= 15) return "warning";
  return "critical";
}

export function buildEstimateHealthRows(sanityCheck) {
  if (!sanityCheck) return [];

  return [
    {
      key: "install",
      label: "Install",
      bucket: sanityCheck.install,
      targetLabel: "target 40%",
    },
    {
      key: "controlsMaterial",
      label: "Controls Material",
      bucket: sanityCheck.controlsMaterial,
      targetLabel: "target 40%",
    },
    {
      key: "controlsLabor",
      label: "Controls Engineering Labor",
      bucket: sanityCheck.controlsLabor,
      targetLabel: "target 20%",
    },
  ].map((row) => {
    const level = getHealthLevel(row.bucket);
    return {
      ...row,
      level,
      statusLabel: level === "good" ? "Good" : level === "warning" ? "Low / High" : "Critical",
      barValue: clampPct(row.bucket?.pct || 0),
      targetValue: clampPct(row.bucket?.target || 0),
    };
  });
}

export function buildNeedsReviewIssues({
  estimate,
  controlsCatalog,
  sanityCheck,
  showBidAlternates,
}) {
  const issues = [];
  const items = Array.isArray(estimate?.items) ? estimate.items : [];
  const alternates = Array.isArray(estimate?.alternates) ? estimate.alternates : [];
  const estimateName = String(estimate?.name || "").trim();
  const proposalSettings = estimate?.settings || {};

  if (sanityCheck) {
    for (const row of buildEstimateHealthRows(sanityCheck)) {
      if (row.level === "good") continue;
      const targetRow = row.key === "install" ? "installation" : "controls";
      const why =
        row.key === "install"
          ? "Low install ratio often signals under-counted installation scope or a controls-heavy bid that may lose on price."
          : row.key === "controlsMaterial"
            ? "Controls material above 40% may indicate over-specified equipment or a substitution opportunity."
            : "Controls labor above target can mean the estimate needs a tighter engineering or programming pass.";
      issues.push({
        key: `sanity-${row.key}`,
        severity: row.level === "critical" ? "critical" : "warning",
        title: `${row.label} is outside target`,
        detail: `${formatPercent(row.bucket?.pct || 0)} vs ${formatPercent(row.bucket?.target || 0)}.`,
        why,
        href: `#estimate-command-center-row-${targetRow}`,
        fixLabel: "Fix",
        fixTarget: targetRow,
      });
    }
  }

  for (const item of items) {
    const totals = calcItem(item, controlsCatalog);
    if ((totals.totalMtl || 0) === 0 && (totals.totalLbr || 0) > 0) {
      issues.push({
        key: `item-zero-material-${item.id}`,
        severity: "warning",
        title: `${item.tag || "Line item"} has labor but no material`,
        detail: `${TYPE_META[item.type]?.label || item.type.toUpperCase()} · ${fmtHr(totals.totalLbr)} labor, $0 material.`,
        href: `#estimate-item-${item.id}`,
      });
    }
    if ((totals.totalLbr || 0) === 0 && (totals.totalMtl || 0) > 0) {
      issues.push({
        key: `item-zero-labor-${item.id}`,
        severity: "warning",
        title: `${item.tag || "Line item"} has material but no labor`,
        detail: `${TYPE_META[item.type]?.label || item.type.toUpperCase()} · ${fmt$(totals.totalMtl)} material, 0 labor hours.`,
        href: `#estimate-item-${item.id}`,
      });
    }
  }

  if (showBidAlternates) {
    alternates.forEach((alternate, index) => {
      const alternateName = String(alternate?.name || "").trim();
      if (!alternateName) {
        issues.push({
          key: `alternate-name-${index}`,
          severity: "warning",
          title: `Bid alternate ${index + 1} needs a name`,
          detail: "Give this alternate a clear name before exporting or sharing.",
          href: "#bid-alternates",
        });
      }
      if (!Array.isArray(alternate?.items) || alternate.items.length === 0) {
        issues.push({
          key: `alternate-items-${index}`,
          severity: "info",
          title: `${alternateName || `Bid alternate ${index + 1}`} has no items`,
          detail: "Seed it with estimate items or leave it as a placeholder for later scope splits.",
          href: "#bid-alternates",
        });
      }
    });
  }

  if (!estimateName) {
    issues.push({
      key: "estimate-name",
      severity: "warning",
      title: "Estimate name is blank",
      detail: "A clear estimate name helps proposal exports and internal review.",
      href: "#estimate-command-center",
    });
  }

  if (!String(proposalSettings.baseScopeName || "").trim() || !String(proposalSettings.customerContact || "").trim() || !String(proposalSettings.estimateDate || "").trim()) {
    issues.push({
      key: "proposal-details",
      severity: "info",
      title: "Proposal details could use a quick review",
      detail: "Scope name, customer contact, or estimate date is still blank.",
      why: "Missing scope name, customer contact, or estimate date will appear blank on the customer proposal.",
      href: "#proposal-details-entry",
      fixLabel: "Fix",
      fixTarget: "proposal-details",
    });
  }

  return issues;
}

function getSeverityBadge(severity) {
  return severityStyles[severity] || severityStyles.info;
}

export function EstimateScopeBreakdown({ breakdown }) {
  const controlsFallback = breakdown.controls.hasScope ? "" : "No controls scope found.";
  const installFallback = breakdown.installation.hasScope ? "" : "No install scope found.";
  const unclassifiedFallback = breakdown.unclassified?.hasScope ? "" : "No unclassified cost.";

  return (
    <section
      aria-label="Cost breakdown by scope"
      style={{
        border: "1px solid " + T.border,
        borderRadius: 12,
        background: T.surface,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "10px 12px 8px",
          borderBottom: "1px solid " + T.border,
        }}
      >
        <div>
          <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3 }}>
            Cost Breakdown by Scope
          </div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
            Cost only. Excludes overhead, profit, and bond.
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>
          Internal cost: {fmt$(breakdown.total)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 0 }}>
        {[
          {
            label: "Controls Cost",
            total: breakdown.controls.total,
            percent: breakdown.controls.percent,
            accent: T.blue,
            detail: [
              { label: "Controls material", value: breakdown.controls.material },
              { label: "Controls engineering / programming labor", value: breakdown.controls.labor },
            ],
            fallback: controlsFallback,
          },
          {
            label: "Installation Cost",
            total: breakdown.installation.total,
            percent: breakdown.installation.percent,
            accent: T.steel,
            detail: [
              { label: "Install labor cost", value: breakdown.installation.labor },
              { label: "Install material / subcontract", value: breakdown.installation.material },
            ],
            fallback: installFallback,
          },
          breakdown.unclassified?.hasScope ? {
            label: "Unclassified Cost",
            total: breakdown.unclassified.total,
            percent: breakdown.unclassified.percent,
            accent: T.muted,
            detail: [],
            fallback: unclassifiedFallback,
          } : null,
        ].filter(Boolean).map((scope, index, scopes) => (
          <div
            key={scope.label}
            style={{
              padding: "10px 12px 12px",
              borderRight: index < scopes.length - 1 ? "1px solid " + T.border : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{scope.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: scope.accent, fontFamily: T.mono }}>
                {fmt$(scope.total)} · {scope.percent.toFixed(1)}%
              </div>
            </div>
            <div style={{ marginTop: 8, height: 7, borderRadius: 999, background: "#E2E8F0", overflow: "hidden" }}>
              <div style={{ width: `${Math.max(0, Math.min(100, scope.percent))}%`, height: "100%", borderRadius: 999, background: scope.accent }} />
            </div>
            <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
              {scope.detail.map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, lineHeight: 1.4 }}>
                  <span style={{ color: T.dim }}>{row.label}</span>
                  <span style={{ color: T.text, fontFamily: T.mono, fontWeight: 700 }}>
                    {fmt$(row.value)}
                  </span>
                </div>
              ))}
            </div>
            {scope.fallback ? (
              <div style={{ marginTop: 6, fontSize: 10, color: T.muted, fontFamily: T.mono }}>
                {scope.fallback}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function EstimatorTabs({ tabs, activeTab, onChange }) {
  return (
    <nav
      aria-label="Estimator sections"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: "0 24px",
      }}
    >
      <div
        role="tablist"
        style={{
          display: "inline-flex",
          gap: 4,
          padding: 4,
          border: "1px solid " + T.border,
          borderRadius: 999,
          background: T.surface,
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
          flexWrap: "wrap",
        }}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          const badge = tab.badge ? String(tab.badge) : "";
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              role="tab"
              aria-selected={active}
              aria-controls={`estimator-panel-${tab.id}`}
              id={`estimator-tab-${tab.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 12px",
                border: "1px solid " + (active ? T.blueMid : "transparent"),
                borderRadius: 999,
                background: active ? T.blueFaint : "transparent",
                color: active ? T.blue : T.text,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: T.mono,
                fontWeight: 700,
              }}
            >
              <span>{tab.label}</span>
              {badge ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: active ? "#E0F2FE" : T.panel,
                    border: "1px solid " + (active ? T.blueMid : T.border2),
                    color: active ? T.blue : T.muted,
                    fontSize: 10,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function EstimateCommandCenter({
  estimate,
  controlsCatalog,
  settings,
  statusLabel,
  estimateName,
  highlightedRowKey = null,
}) {
  const buckets = deriveEstimatorCostBuckets(estimate, controlsCatalog, settings);
  const install = buckets.install;
  const controls = buckets.controls;
  const totals = buckets.totals;
  const rows = [
    {
      key: "installation",
      label: "Installation",
      values: {
        labor: install.laborCost,
        laborHours: buckets.diagnostics.installRawLaborHours,
        material: install.materialCost,
        overhead: install.markup.overhead,
        profit: install.markup.profit,
        marginPct: install.sellPrice > 0 ? (install.markup.profit / install.sellPrice) * 100 : 0,
        bond: install.markup.bond,
        total: install.sellPrice,
      },
    },
    {
      key: "controls",
      label: "Controls",
      values: {
        labor: controls.engineeringLaborCost,
        laborHours: buckets.diagnostics.controlsRawLaborHours,
        material: controls.materialCost,
        overhead: controls.markup.overhead,
        profit: controls.markup.profit,
        marginPct: controls.sellPrice > 0 ? (controls.markup.profit / controls.sellPrice) * 100 : 0,
        bond: controls.markup.bond,
        total: controls.sellPrice,
      },
    },
    {
      key: "total",
      label: "Total",
      emphasized: true,
      values: {
        labor: install.laborCost + controls.engineeringLaborCost,
        laborHours: buckets.diagnostics.installRawLaborHours + buckets.diagnostics.controlsRawLaborHours,
        material: install.materialCost + controls.materialCost,
        overhead: install.markup.overhead + controls.markup.overhead,
        profit: install.markup.profit + controls.markup.profit,
        marginPct: totals.turnkeySellPrice > 0 ? ((install.markup.profit + controls.markup.profit) / totals.turnkeySellPrice) * 100 : 0,
        bond: install.markup.bond + controls.markup.bond,
        total: totals.turnkeySellPrice,
      },
    },
  ];
  const columns = [
    { key: "labor", label: "Labor $" },
    { key: "laborHours", label: "Labor Hrs" },
    { key: "material", label: "Material $" },
    { key: "overhead", label: "OH $" },
    { key: "profit", label: "Profit $" },
    { key: "marginPct", label: "Margin %" },
    { key: "bond", label: "Bond $" },
    { key: "total", label: "Total" },
  ];

  return (
    <section
      id="estimate-command-center"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        marginBottom: 12,
        border: "1px solid " + T.border,
        borderRadius: 12,
        background: T.surface,
        boxShadow: "0 8px 20px rgba(15, 23, 42, 0.06)",
        overflow: "hidden",
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "8px 12px",
        borderBottom: "1px solid " + T.border,
        background: "#FAFAFB",
      }}>
        <div>
          <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.4 }}>
            Turnkey Estimate Summary
          </div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
            {estimateName || "Untitled estimate"} · {statusLabel}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 8px",
            borderRadius: 999,
            background: T.panel,
            border: "1px solid " + T.border2,
            color: T.steel,
            fontSize: 11,
            fontFamily: T.mono,
          }}>
            {statusLabel}
          </span>
          <span style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>
            Install + controls
          </span>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
          <thead>
            <tr style={{ background: T.surface }}>
              <th style={{ ...headerCellStyle, textAlign: "left" }}>Scope</th>
              {columns.map((column) => (
                <th key={column.key} style={{ ...headerCellStyle, textAlign: "right" }}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                style={{
                  background: highlightedRowKey === row.key ? "#FFFBEA" : row.emphasized ? "#F7FBFA" : T.surface,
                  borderTop: row.emphasized ? "1px solid " + T.border2 : "1px solid " + T.border,
                }}
              >
                <td
                  id={`estimate-command-center-row-${row.key}`}
                  style={{
                    ...scopeCellStyle,
                    fontWeight: row.emphasized ? 800 : 700,
                    color: row.emphasized ? T.blue : T.text,
                    boxShadow: highlightedRowKey === row.key ? "inset 0 0 0 9999px rgba(250, 204, 21, 0.08)" : "none",
                  }}
                >
                  {row.label}
                </td>
                {columns.map((column) => {
                  const value = row.values[column.key];
                  const isHours = column.key === "laborHours";
                  const isTotal = column.key === "total";
                  const isMargin = column.key === "marginPct";
                  const marginPct = Number(value) || 0;
                  return (
                    <td
                      key={column.key}
                      style={{
                        ...valueCellStyle,
                        fontWeight: row.emphasized || isTotal ? 800 : 700,
                        color: isMargin ? getMarginColor(marginPct) : row.emphasized || isTotal ? T.blue : T.steel,
                        fontSize: row.emphasized ? 13 : 12,
                        background: row.emphasized && isTotal ? "#E0F2FE" : "transparent",
                      }}
                    >
                      {isHours ? fmtHr(value) : isMargin ? formatPercent(value) : fmt$(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const headerCellStyle = {
  padding: "8px 10px",
  borderBottom: "1px solid " + T.border,
  fontSize: 9,
  color: T.muted,
  fontFamily: T.mono,
  textTransform: "uppercase",
  letterSpacing: 1.1,
  whiteSpace: "nowrap",
};

const scopeCellStyle = {
  padding: "10px 10px",
  borderBottom: "1px solid " + T.border,
  fontSize: 12,
  fontFamily: T.mono,
  whiteSpace: "nowrap",
};

const valueCellStyle = {
  padding: "10px 10px",
  borderBottom: "1px solid " + T.border,
  textAlign: "right",
  fontFamily: T.mono,
  whiteSpace: "nowrap",
};

export function EstimateHealthPanel({ rows, sanityCheck }) {
  const installLaborRow = sanityCheck?.installLabor
    ? {
        key: "install-labor",
        label: "Installation Labor",
        bucket: sanityCheck.installLabor,
        targetLabel: "target 40%",
        level: getHealthLevel(sanityCheck.installLabor),
        barValue: clampPct(sanityCheck.installLabor?.pct || 0),
        targetValue: clampPct(sanityCheck.installLabor?.target || 0),
      }
    : null;
  const displayRows = installLaborRow ? [installLaborRow, ...rows] : rows;

  return (
    <section
      id="estimate-health"
      style={{
        border: "1px solid " + T.border,
        borderRadius: 12,
        background: T.surface,
        padding: "10px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3 }}>
            Estimate Health
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {displayRows.length ? displayRows.map((row) => {
          const severity = row.level === "good" ? "info" : row.level === "warning" ? "warning" : "critical";
          const badge = getSeverityBadge(severity);
          const pct = Number(row.bucket?.pct || 0);
          const target = Number(row.bucket?.target || 0);
          const diff = pct - target;
          const statusText = row.level === "good" ? "Good" : row.bucket?.pct < row.bucket?.target ? "Low" : "High";
          const deltaColor = row.level === "good" ? T.green : row.level === "warning" ? T.amber : T.rose;
          return (
            <div
              key={row.key}
              style={{
                border: "1px solid " + T.border,
                borderLeft: "3px solid " + badge.border,
                background: T.surface,
                borderRadius: 10,
                padding: "8px 10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{row.label}</div>
                  <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>
                    {row.targetLabel} · {statusText}
                  </div>
                </div>
                <div style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: badge.color }}>
                  {formatPercent(row.bucket?.pct || 0)} of total
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ height: 7, borderRadius: 999, background: "#E2E8F0", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.max(6, row.barValue)}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: row.level === "good" ? "#7BAA98" : row.level === "warning" ? "#D6A153" : "#C77171",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 5, fontSize: 10, color: T.muted, fontFamily: T.mono }}>
                  <span>{formatPercent(row.targetValue)} target</span>
                  <span>{formatPercent(row.bucket?.pct || 0)} actual</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: deltaColor, fontFamily: T.mono, fontWeight: 700 }}>
                  {formatPercent(pct)} actual · {formatSignedPercent(diff)} vs. target
                </div>
              </div>

              {row.level !== "good" && (
                <div style={{ marginTop: 8, fontSize: 11, color: T.dim, lineHeight: 1.5 }}>
                  {Math.abs(diff) > 15
                    ? `${row.label} is materially outside the healthy range.`
                    : `${row.label} is a bit off target and worth a quick check.`}
                </div>
              )}
            </div>
          );
        }) : (
          <div style={{ border: "1px dashed " + T.border2, borderRadius: 10, padding: "12px 14px", fontSize: 12, color: T.dim }}>
            No health data yet.
          </div>
        )}
      </div>
    </section>
  );
}

export function NeedsReviewPanel({ issues, onFixIssue, onJumpIssue }) {
  const sorted = [...(issues || [])].sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 };
    return (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3);
  });
  const hasIssues = sorted.length > 0;

  return (
    <section
      id="needs-review"
      style={{
        border: "1px solid " + T.border,
        borderRadius: 12,
        background: T.surface,
        padding: "10px 12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3 }}>
            Needs Review
          </div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
            Surface the issues that most deserve attention first.
          </div>
        </div>
      </div>

      {hasIssues ? (
        <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
          {sorted.map((issue) => {
            const badge = getSeverityBadge(issue.severity);
            return (
              <div
                key={issue.key}
                style={{
                  border: "1px solid " + T.border,
                  borderLeft: "3px solid " + badge.border,
                  background: T.surface,
                  borderRadius: 10,
                  padding: "8px 10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 7px",
                          borderRadius: 999,
                          border: "1px solid " + badge.border,
                          color: badge.color,
                          background: T.surface,
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: T.mono,
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                        }}
                      >
                        {badge.label}
                      </span>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{issue.title}</div>
                    </div>
                    {issue.why && (
                      <div style={{ marginTop: 4, fontSize: 11, color: T.muted, lineHeight: 1.45 }}>
                        {issue.why}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: T.dim, marginTop: 3, lineHeight: 1.45 }}>
                      {issue.detail}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {issue.href && (
                      <a
                        href={issue.href}
                        onClick={(event) => {
                          if (!onJumpIssue) return;
                          event.preventDefault();
                          onJumpIssue(issue);
                        }}
                        style={{
                          fontSize: 11,
                          fontFamily: T.mono,
                          fontWeight: 700,
                          color: T.blue,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Jump to section
                      </a>
                    )}
                    {onFixIssue && (
                      <button
                        type="button"
                        onClick={() => onFixIssue(issue)}
                        style={{
                          padding: "4px 8px",
                          border: "1px solid " + T.border2,
                          borderRadius: 999,
                          background: T.surface,
                          color: T.text,
                          cursor: "pointer",
                          fontSize: 11,
                          fontFamily: T.mono,
                          fontWeight: 700,
                        }}
                      >
                        Fix →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
          <div
          style={{
            marginTop: 10,
            border: "1px solid " + T.border,
            borderLeft: "3px solid " + T.green,
            background: T.surface,
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Estimate looks ready</div>
          <div style={{ marginTop: 4, fontSize: 11, color: T.dim, lineHeight: 1.45 }}>
            Nothing obvious needs attention before you save or export.
          </div>
        </div>
      )}
    </section>
  );
}

export function EstimatorActionBar({
  customerMode,
  estimate,
  exporting,
  saving,
  onSave,
  saveChipState = "saved",
  savedAt = null,
  onProposalDetails,
  onAddEquipment,
}) {
  const savedRecently = saveChipState === "saved" && savedAt ? Date.now() - new Date(savedAt).getTime() < 3000 : false;
  const savedMuted = saveChipState === "saved" && !savedRecently;
  const [showPicker, setShowPicker] = useState(false);
  const equipmentCounts = useMemo(() => getEquipmentCounts(estimate), [estimate]);
  const chipStyles =
    saveChipState === "saving"
      ? { border: "1px solid " + T.border2, background: T.panel, color: T.muted }
      : saveChipState === "unsaved"
        ? { border: "1px solid #FCD34D", background: "#FFFBEB", color: T.amber }
        : savedMuted
          ? { border: "1px solid " + T.border2, background: T.panel, color: T.muted }
          : { border: "1px solid #86EFAC", background: "#DCFCE7", color: T.green };
  const chipLabel =
    saveChipState === "saving"
      ? "Saving..."
      : saveChipState === "unsaved"
        ? "Unsaved changes"
        : "Saved";

  return (
    <section
      id="estimator-actions"
      style={{
        border: "1px solid " + T.border,
        borderRadius: 12,
        background: T.surface,
        padding: "8px 10px",
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {!customerMode && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3, marginRight: 4 }}>
              Workflow Actions
            </div>
            {onSave && (
              <>
                <span
                  aria-live="polite"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 11px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontFamily: T.mono,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    transition: "all 180ms ease",
                    ...chipStyles,
                    opacity: savedMuted ? 0.78 : 1,
                  }}
                >
                  {saveChipState === "saving" ? (
                    <span
                      aria-hidden="true"
                      className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                    />
                  ) : saveChipState === "unsaved" ? (
                    <span aria-hidden="true">⚠</span>
                  ) : (
                    <span aria-hidden="true">✓</span>
                  )}
                  <span>{chipLabel}</span>
                </span>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid " + T.border2,
                    borderRadius: 999,
                    background: T.surface,
                    color: T.text,
                    cursor: saving ? "default" : "pointer",
                    fontSize: 12,
                    fontFamily: T.mono,
                    fontWeight: 700,
                    opacity: saving ? 0.75 : 1,
                  }}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onProposalDetails}
              id="proposal-details-entry"
              style={{
                padding: "8px 12px",
                border: "1px solid " + T.border2,
                borderRadius: 999,
                background: T.surface,
                color: T.text,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: T.mono,
                fontWeight: 700,
              }}
            >
              Proposal Details
            </button>
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              disabled={!onAddEquipment}
              className="rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              + Add Equipment
            </button>
          </div>
        )}
      </div>
      <EquipmentPickerModal
        open={showPicker}
        counts={equipmentCounts}
        onClose={() => setShowPicker(false)}
        onAdd={onAddEquipment}
      />
    </section>
  );
}

export function CostCategorySection({
  id,
  label,
  subtotal,
  laborHours,
  itemCount,
  expanded,
  onToggle,
  children,
  note,
  actionLabel = "Show breakdown",
}) {
  return (
    <section
      id={id}
      style={{
        border: "1px solid " + T.border,
        borderRadius: 12,
        background: T.surface,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto auto auto auto",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          border: "none",
          background: expanded ? T.panel : T.surface,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{label}</div>
          {note && <div style={{ fontSize: 10, color: T.dim, marginTop: 3 }}>{note}</div>}
        </div>
        <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </div>
        <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>
          {fmtHr(laborHours)}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, fontFamily: T.mono }}>
          {fmt$(subtotal)}
        </div>
        <div style={{ justifySelf: "end", fontSize: 12, fontWeight: 700, color: T.blue, fontFamily: T.mono }}>
          {expanded ? "Hide breakdown ▴" : `${actionLabel} ▾`}
        </div>
      </button>
      {expanded && (
        <div style={{ borderTop: "1px solid " + T.border, padding: "10px 12px" }}>
          {children}
        </div>
      )}
    </section>
  );
}

function panelShell({ id, title, description, children }) {
  return (
    <section
      role="tabpanel"
      id={`estimator-panel-${id}`}
      aria-labelledby={`estimator-tab-${id}`}
      style={{
        display: "grid",
        gap: 12,
        marginTop: 18,
      }}
    >
      <div
        style={{
          border: "1px solid " + T.border,
          borderRadius: 10,
          background: T.surface,
          overflow: "hidden",
          padding: "10px 14px",
        }}
      >
        <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>
          {description}
        </div>
      </div>
      {children}
    </section>
  );
}

export function EstimatorTabPanels({
  activeTab,
  estimate,
  controlsCatalog,
  customerMode,
  settings,
  sanityCheck,
  costs,
  totals,
  ddcInfrastructure,
  expandedDdc,
  onToggleDdc,
  healthRows,
  needsReviewIssues,
  onFixIssue,
  onJumpIssue,
  highlightedSummaryRowKey,
  showBidAlternates,
  showProjectSettings,
  alternatesWithCosts,
  exporting,
  onOpenProposalDetails,
  onExportInternal,
  onExportProposal,
  onCreateBidAlternate,
  onOpenBidAlternate,
  onRemoveBidAlternate,
  showSettings,
  onToggleSettings,
  onOpenAiParser,
  onOpenAiSettings,
  onOpenSystemWizard,
  onUpdateSettings,
  onApplyDefaultInstallType,
  proposalPreview,
  estimateId,
  rawLbrHrs,
  itemCount,
}) {
  const costBuckets = deriveEstimatorCostBuckets(estimate, controlsCatalog, settings);

  if (!customerMode && activeTab === "controlsBom") {
    return (
      <ControlsBomTab
        estimate={estimate}
        controlsCatalog={controlsCatalog}
        settings={settings}
      />
    );
  }

  if (activeTab === "review") {
    return panelShell({
      id: "review",
      title: "Review",
      description: "Health checks and readiness items stay here so the estimate canvas stays calm.",
      children: (
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <EstimateHealthPanel rows={healthRows} sanityCheck={sanityCheck} />
          <NeedsReviewPanel issues={needsReviewIssues} onFixIssue={onFixIssue} onJumpIssue={onJumpIssue} />
        </div>
      ),
    });
  }

  if (activeTab === "costDetail") {
    const installTotal = costBuckets.install.sellPrice || costs.total || 0;
    const controlsTotal = costBuckets.controls.sellPrice || 0;
    const installRows = [
      ["Raw Labor $", (totals.lbrHrs || 0) * (settings.wageRate || 0)],
      ["Raw Material $", totals.mtl || 0],
      ["Overhead $", costs.overhead || 0],
      ["Profit $", costs.profit || 0],
      ["Bond $", costs.bond || 0],
      ["Total Bid $", installTotal],
      ["Margin %", installTotal > 0 ? (costs.profit / installTotal) * 100 : 0],
    ];
    const controlsRows = [
      ["Raw Labor $", (totals.controlsLbrHrs || 0) * (settings.controlsWageRate || 0)],
      ["Raw Material $", totals.controlsMtl || 0],
      ["Overhead $", costBuckets.controls.markup.overhead || 0],
      ["Profit $", costBuckets.controls.markup.profit || 0],
      ["Bond $", costBuckets.controls.markup.bond || 0],
      ["Total Bid $", controlsTotal],
      ["Margin %", controlsTotal > 0 ? ((costBuckets.controls.markup.profit || 0) / controlsTotal) * 100 : 0],
    ];

    return panelShell({
      id: "costDetail",
      title: "Cost Breakdown",
      description: "Full cost reconciliation — see how raw costs build up to the final bid price.",
      children: (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            {[
              { label: "Installation", rows: installRows, accent: T.steel },
              { label: "Controls", rows: controlsRows, accent: T.blue },
            ].map((scope) => (
              <section key={scope.label} style={{ border: "1px solid " + T.border, borderRadius: 12, background: T.surface, overflow: "hidden" }}>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid " + T.border, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3 }}>
                      {scope.label}
                    </div>
                    <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>
                      Full bid stack with the exact markup buckets used in the estimate.
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: scope.accent, fontFamily: T.mono }}>
                    {fmt$(scope.rows[5][1])}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 0 }}>
                  {scope.rows.map(([label, value]) => {
                    const isMargin = label === "Margin %";
                    const isTotal = label === "Total Bid $";
                    return (
                      <div key={label} style={{ padding: "10px 12px", borderRight: "1px solid " + T.border, borderBottom: "1px solid " + T.border }}>
                        <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1 }}>
                          {label}
                        </div>
                        <div style={{ marginTop: 4, fontSize: isMargin ? 16 : 13, fontWeight: 800, fontFamily: T.mono, color: isMargin ? getMarginColor(value) : isTotal ? scope.accent : T.text }}>
                          {isMargin ? formatPercent(value) : fmt$(value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {!customerMode && settings.estimateScopeMode === "both" && (
            <div style={{ border: "1px solid " + T.border, borderRadius: 10, background: T.surface, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid " + T.border }}>
                <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3 }}>
                  Turnkey Cost Summary
                </div>
                <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>
                  Install cost is already captured in the command center above. This panel keeps the DDC infrastructure detail visible without repeating the full totals.
                </div>
              </div>
              <div style={{ padding: "12px 14px", display: "grid", gap: 12 }}>
                {ddcInfrastructure.rows.length > 0 && (
                  <CostCategorySection
                    id="ddc-infrastructure"
                    label="DDC Infrastructure"
                    subtotal={ddcInfrastructure.grandTotal}
                    laborHours={ddcInfrastructure.rawLbrHrs}
                    itemCount={ddcInfrastructure.rows.length}
                    expanded={expandedDdc}
                    note={`Sized from the selected controls devices. Points AI ${ddcInfrastructure.pointCounts.AI}, AO ${ddcInfrastructure.pointCounts.AO}, BI ${ddcInfrastructure.pointCounts.BI}, BO ${ddcInfrastructure.pointCounts.BO}; controllers ${ddcInfrastructure.controllerCount}; equipment instances ${ddcInfrastructure.equipmentCount}.`}
                    onToggle={onToggleDdc}
                    actionLabel="Show breakdown"
                  >
                    <div style={{ display: "grid", gap: 6 }}>
                      {ddcInfrastructure.rows.map((row) => (
                        <div key={row.catalogId} style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 48px 88px 88px", gap: 10, alignItems: "center", padding: "6px 8px", border: "1px solid " + T.border, borderRadius: 6, background: T.surface }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: T.text }}>{row.description}</div>
                            <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono }}>{row.catalogId}</div>
                          </div>
                          <div style={{ fontSize: 11, color: T.text, fontFamily: T.mono, textAlign: "right" }}>x{row.qty}</div>
                          <div style={{ fontSize: 11, color: T.blue, fontFamily: T.mono, textAlign: "right" }}>{fmt$(row.mtlTotal)}</div>
                          <div style={{ fontSize: 11, color: T.purple, fontFamily: T.mono, textAlign: "right" }}>{fmtHr(row.hrsTotal)}</div>
                        </div>
                      ))}
                    </div>
                  </CostCategorySection>
                )}
              </div>
            </div>
          )}
        </div>
      ),
    });
  }

  if (activeTab === "outputs") {
    return panelShell({
      id: "outputs",
      title: "Outputs",
      description: "Proposal and alternate outputs live here when you are ready to package the estimate.",
      children: (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={onOpenProposalDetails} style={{ padding: "8px 12px", border: "1px solid " + T.border2, borderRadius: 999, background: T.surface, color: T.text, cursor: "pointer", fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>
              Proposal Details
            </button>
            <button type="button" onClick={onExportInternal} style={{ padding: "8px 12px", border: "1px solid " + T.border2, borderRadius: 999, background: T.surface, color: T.text, cursor: "pointer", fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>
              Internal Report
            </button>
            {!customerMode && (
              <button type="button" onClick={onExportProposal} disabled={exporting} style={{ padding: "8px 12px", border: "1px solid " + T.border2, borderRadius: 999, background: T.green, color: "#fff", cursor: exporting ? "default" : "pointer", fontSize: 12, fontFamily: T.mono, fontWeight: 700, opacity: exporting ? 0.8 : 1 }}>
                {exporting ? "Generating..." : "Generate Proposal"}
              </button>
            )}
          </div>
          {!customerMode && showBidAlternates && (
            <div style={{ border: "1px solid " + T.border, borderRadius: 10, background: T.surface, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid " + T.border }}>
                <div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3 }}>
                    Bid Outputs
                  </div>
                  <div style={{ fontSize: 12, color: T.dim, marginTop: 2, maxWidth: 860 }}>
                    Bid alternates let you price optional or deductive scope separately from the base estimate - useful for add/deduct scenarios in competitive bids. Each alternate appears as a separate section in the customer proposal.
                  </div>
                </div>
                <button type="button" onClick={onCreateBidAlternate} style={{ marginTop: 12, width: "100%", padding: "14px 16px", border: "1px dashed " + T.border2, borderRadius: 12, background: T.surface, color: T.text, cursor: "pointer", fontSize: 13, fontFamily: T.mono, fontWeight: 800 }}>
                  + Add a Bid Alternate
                </button>
              </div>
              <div style={{ padding: "12px 14px", display: "grid", gap: 10 }}>
                {alternatesWithCosts.length ? alternatesWithCosts.map((alternate) => (
                  <div key={alternate.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 12px", border: "1px solid " + T.border, borderRadius: 8, background: T.panel }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{alternate.name || "Bid Alternate"}</div>
                      <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 3 }}>
                        {getEstimateScopeModeLabel(alternate.settings?.estimateScopeMode)} · {(alternate.items?.length || 0)} item{(alternate.items?.length || 0) === 1 ? "" : "s"}
                      </div>
                      {alternate.altCosts && (
                        <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 3 }}>
                          Material: {fmt$(alternate.altCosts.material)} · Labor: {fmtHr(alternate.altRaw.lbrHrs)} · Total: {fmt$(alternate.altCosts.total)}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => onOpenBidAlternate(alternate.id)} style={{ padding: "6px 10px", border: "1px solid " + T.blueMid, borderRadius: 5, background: T.blueFaint, color: T.blue, cursor: "pointer", fontSize: 12, fontFamily: T.mono, fontWeight: 600 }}>
                        Edit
                      </button>
                      <button type="button" onClick={() => onRemoveBidAlternate(alternate.id)} style={{ padding: "6px 10px", border: "1px solid " + T.border2, borderRadius: 5, background: "none", color: T.muted, cursor: "pointer", fontSize: 12, fontFamily: T.mono, fontWeight: 600 }}>
                        Remove
                      </button>
                    </div>
                  </div>
                )) : (
                  <div style={{ fontSize: 12, color: T.muted, border: "1px dashed " + T.border2, borderRadius: 10, padding: "14px 16px" }}>
                    No bid alternates yet. Use <strong>+ Add a Bid Alternate</strong> to start one.
                  </div>
                )}
              </div>
            </div>
          )}
          <ProposalPreviewPanel proposalPreview={proposalPreview} />
        </div>
      ),
    });
  }

  if (activeTab === "settings" && !customerMode) {
    return panelShell({
      id: "settings",
      title: "Settings",
      description: "Keep estimator configuration and auxiliary tools here instead of the default canvas.",
      children: (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={onToggleSettings} style={{ padding: "8px 12px", border: "1px solid " + T.border2, borderRadius: 999, background: T.surface, color: T.text, cursor: "pointer", fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>
              {showSettings ? "Hide Project Settings" : "Show Project Settings"}
            </button>
            <button type="button" onClick={onOpenSystemWizard} style={{ padding: "8px 12px", border: "1px solid " + T.border2, borderRadius: 999, background: T.surface, color: T.text, cursor: "pointer", fontSize: 12, fontFamily: T.mono, fontWeight: 700 }}>
              System Wizard
            </button>
          </div>
          <section style={{ border: "1px solid " + T.border, borderRadius: 10, background: T.surface, padding: "14px 16px", display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3 }}>
                AI Tools
              </div>
              <div style={{ fontSize: 12, color: T.dim, marginTop: 4, maxWidth: 860 }}>
                Use the AI Parser to extract equipment schedules from uploaded PDFs or spreadsheets. AI Settings controls model behavior and data sources.
              </div>
            </div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <SettingsToolCard
                title="AI Parser"
                icon="AI"
                description="Extract schedules from PDFs or spreadsheets."
                onClick={onOpenAiParser}
              />
              <SettingsToolCard
                title="AI Settings"
                icon="⚙"
                description="Tune model behavior and data sources."
                onClick={onOpenAiSettings}
              />
            </div>
          </section>
          <EstimateMarkupSettingsSection settings={settings} onApply={onUpdateSettings} />
          {showProjectSettings && showSettings && (
            <ProjectSettingsPanel
              settings={settings}
              onChange={onUpdateSettings}
              costs={costs}
              rawLbrHrs={rawLbrHrs}
              itemCount={itemCount}
              estimateId={estimateId}
              onApplyDefaultInstallType={onApplyDefaultInstallType}
            />
          )}
        </div>
      ),
    });
  }

  return null;
}

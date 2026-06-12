import { AddEquipButtons } from "./AddEquipButtons.jsx";
import { T } from "../../shared/tokens.js";
import { fmt$, fmtHr } from "../../shared/utils.js";
import { TYPE_META, calcItem } from "./estimateCalc.js";

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
      issues.push({
        key: `sanity-${row.key}`,
        severity: row.level === "critical" ? "critical" : "warning",
        title: `${row.label} is outside target`,
        detail: `${formatPercent(row.bucket?.pct || 0)} vs ${formatPercent(row.bucket?.target || 0)}.`,
        href: "#estimate-health",
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
      href: "#proposal-details",
    });
  }

  return issues;
}

function getSeverityBadge(severity) {
  return severityStyles[severity] || severityStyles.info;
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
              aria-pressed={active}
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
  total,
  labor,
  material,
  overhead,
  profit,
  bond,
  laborHours,
  statusLabel,
  estimateName,
}) {
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
            Estimate Command Center
          </div>
          <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
            {estimateName || "Untitled estimate"} · {statusLabel}
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>
          {fmtHr(laborHours)} raw labor
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 1.2fr) repeat(auto-fit, minmax(108px, 1fr))",
          gap: 0,
          alignItems: "stretch",
        }}
      >
        {[
          { label: "Estimate Total", value: total, accent: T.blue, emphasized: true },
          { label: "Labor Dollars", value: labor, accent: T.steel },
          { label: "Material Dollars", value: material, accent: T.blue },
          { label: "Overhead", value: overhead, accent: "#7C3AED" },
          { label: "Profit", value: profit, accent: T.green },
          { label: "Bond", value: bond, accent: "#B45309" },
          { label: "Total Labor Hours", value: fmtHr(laborHours), accent: T.text, textValue: true },
          { label: "Estimate Status", value: statusLabel, accent: T.text, status: true },
        ].map((metric, index) => (
          <div
            key={metric.label}
            style={{
              padding: metric.emphasized ? "10px 14px" : "9px 12px",
              borderRight: index < 7 ? "1px solid " + T.border : "none",
              background: metric.emphasized ? "#F7FBFA" : T.surface,
              minHeight: metric.emphasized ? 72 : 60,
            }}
          >
            <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.1 }}>
              {metric.label}
            </div>
            <div
              style={{
                marginTop: 5,
                fontSize: metric.emphasized ? 23 : 16,
                fontWeight: metric.emphasized ? 800 : 700,
                color: metric.accent,
                fontFamily: metric.textValue || metric.status ? "inherit" : T.mono,
                lineHeight: 1.1,
              }}
            >
              {metric.textValue ? metric.value : metric.status ? (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: "#F8FAFC",
                  border: "1px solid " + T.border2,
                  color: T.steel,
                  fontSize: 12,
                  fontFamily: T.mono,
                }}>
                  {metric.value}
                </span>
              ) : (
                fmt$(metric.value)
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function EstimateHealthPanel({ rows }) {
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
          <div style={{ fontSize: 11, color: T.dim, marginTop: 2 }}>
            The 40 / 40 / 20 mix is informational, not a hard stop.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {rows.length ? rows.map((row) => {
          const severity = row.level === "good" ? "info" : row.level === "warning" ? "warning" : "critical";
          const badge = getSeverityBadge(severity);
          const diff = Math.abs((row.bucket?.pct || 0) - (row.bucket?.target || 0));
          const statusText = row.level === "good" ? "Good" : row.bucket?.pct < row.bucket?.target ? "Low" : "High";
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

export function NeedsReviewPanel({ issues }) {
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
                    <div style={{ fontSize: 11, color: T.dim, marginTop: 3, lineHeight: 1.45 }}>
                      {issue.detail}
                    </div>
                  </div>
                  {issue.href && (
                    <a href={issue.href} style={{ fontSize: 11, fontFamily: T.mono, fontWeight: 700, color: T.blue, whiteSpace: "nowrap" }}>
                      Jump to section
                    </a>
                  )}
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
  exporting,
  saving,
  deleting,
  onGenerateProposal,
  onSave,
  onInternalReport,
  onProposalDetails,
  onDelete,
  onAddEquipment,
}) {
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
            <button
              type="button"
              onClick={onGenerateProposal}
              disabled={exporting}
              style={{
                padding: "8px 12px",
                border: "1px solid " + T.border2,
                borderRadius: 999,
                background: T.green,
                color: "#fff",
                cursor: exporting ? "default" : "pointer",
                fontSize: 12,
                fontFamily: T.mono,
                fontWeight: 700,
                opacity: exporting ? 0.8 : 1,
              }}
            >
              {exporting ? "Generating..." : "Generate Proposal"}
            </button>
            {onSave && (
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
            )}
            <button
              type="button"
              onClick={onInternalReport}
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
              Internal Report
            </button>
            <button
              type="button"
              onClick={onProposalDetails}
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
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                style={{
                  padding: "7px 10px",
                  border: "1px solid " + T.rose,
                  borderRadius: 999,
                  background: "#fff",
                  color: T.rose,
                  cursor: deleting ? "default" : "pointer",
                  fontSize: 11,
                  fontFamily: T.mono,
                  fontWeight: 700,
                  opacity: deleting ? 0.75 : 1,
                }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
        )}
        <div style={{ marginLeft: "auto" }}>
          <AddEquipButtons onAdd={onAddEquipment} compact neutral />
        </div>
      </div>
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
        <div style={{ fontSize: 16, color: T.muted, fontFamily: T.mono }}>
          {expanded ? "▾" : "▸"}
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

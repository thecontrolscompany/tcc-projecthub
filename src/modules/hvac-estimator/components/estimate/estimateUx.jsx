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
      help: "Healthy install share stays close to the 40% benchmark.",
    },
    {
      key: "controlsMaterial",
      label: "Controls Material",
      bucket: sanityCheck.controlsMaterial,
      targetLabel: "target 40%",
      help: "Healthy controls material share stays close to the 40% benchmark.",
    },
    {
      key: "controlsLabor",
      label: "Controls Engineering Labor",
      bucket: sanityCheck.controlsLabor,
      targetLabel: "target 20%",
      help: "Healthy controls engineering labor share stays close to the 20% benchmark.",
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

export function groupEstimateItemsByType(items = []) {
  const groups = [];
  const byType = new Map();

  (items || []).forEach((item, index) => {
    const key = String(item.type || "custom");
    if (!byType.has(key)) {
      const group = { type: key, items: [], firstIndex: index };
      byType.set(key, group);
      groups.push(group);
    }
    byType.get(key).items.push(item);
  });

  return groups.map((group) => ({
    ...group,
    label: TYPE_META[group.type]?.label || group.type.toUpperCase(),
    color: TYPE_META[group.type]?.color || T.steel,
    bg: TYPE_META[group.type]?.bg || T.faint,
  }));
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
        marginBottom: 16,
        border: "1px solid " + T.border,
        borderRadius: 12,
        background: T.surface,
        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
        overflow: "hidden",
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "10px 14px",
        borderBottom: "1px solid " + T.border,
        background: T.panel,
      }}>
        <div>
          <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3 }}>
            Estimate Command Center
          </div>
          <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>
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
          gridTemplateColumns: "minmax(170px, 1.2fr) repeat(7, minmax(100px, 1fr))",
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
              padding: "12px 14px",
              borderRight: index < 7 ? "1px solid " + T.border : "none",
              background: metric.emphasized ? "linear-gradient(180deg, rgba(37,99,235,0.12), rgba(37,99,235,0.04))" : T.surface,
              minHeight: metric.emphasized ? 78 : 70,
            }}
          >
            <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.1 }}>
              {metric.label}
            </div>
            <div
              style={{
                marginTop: 5,
                fontSize: metric.emphasized ? 24 : 17,
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
                  background: T.blueFaint,
                  border: "1px solid " + T.blueMid,
                  color: T.blue,
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
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3 }}>
            Estimate Health
          </div>
          <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>
            The 40 / 40 / 20 mix is informational, not a hard stop.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {rows.length ? rows.map((row) => {
          const severity = row.level === "good" ? "info" : row.level === "warning" ? "warning" : "critical";
          const badge = getSeverityBadge(severity);
          const diff = Math.abs((row.bucket?.pct || 0) - (row.bucket?.target || 0));
          const statusText = row.level === "good" ? "Good" : row.bucket?.pct < row.bucket?.target ? "Low" : "High";
          return (
            <div
              key={row.key}
              style={{
                border: "1px solid " + badge.border,
                background: badge.bg,
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{row.label}</div>
                  <div style={{ fontSize: 10, color: T.dim, marginTop: 2 }}>
                    {row.targetLabel} · {statusText}
                  </div>
                </div>
                <div style={{ fontSize: 12, fontFamily: T.mono, fontWeight: 700, color: badge.color }}>
                  {formatPercent(row.bucket?.pct || 0)} of total
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ height: 8, borderRadius: 999, background: "rgba(148,163,184,0.22)", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.max(6, row.barValue)}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: row.level === "good" ? T.green : row.level === "warning" ? T.amber : T.rose,
                      boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.22)",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, fontSize: 11, color: T.muted, fontFamily: T.mono }}>
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
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3 }}>
            Needs Review
          </div>
          <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>
            Surface the issues that most deserve attention first.
          </div>
        </div>
      </div>

      {hasIssues ? (
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {sorted.map((issue) => {
            const badge = getSeverityBadge(issue.severity);
            return (
              <div
                key={issue.key}
                style={{
                  border: "1px solid " + badge.border,
                  background: badge.bg,
                  borderRadius: 10,
                  padding: "10px 12px",
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
                    <div style={{ fontSize: 11, color: T.dim, marginTop: 4, lineHeight: 1.5 }}>
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
            marginTop: 12,
            border: "1px solid " + T.green,
            background: T.greenFaint || "#ECFDF5",
            borderRadius: 10,
            padding: "12px 14px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: T.green }}>Estimate looks ready</div>
          <div style={{ marginTop: 4, fontSize: 11, color: T.dim, lineHeight: 1.5 }}>
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
  onBidAlternate,
  onSystemWizard,
  onAiParser,
  onSettings,
  onAiSettings,
  onDelete,
  onAddEquipment,
  showBidAlternates,
  showProjectSettings,
}) {
  return (
    <section
      id="estimator-actions"
      style={{
        border: "1px solid " + T.border,
        borderRadius: 12,
        background: T.surface,
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.3 }}>
              Workflow Actions
            </div>
            <div style={{ fontSize: 12, color: T.dim, marginTop: 2 }}>
              Keep the important steps closest to the estimate.
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div style={{ border: "1px solid " + T.border, borderRadius: 10, background: T.panel, padding: "10px 12px" }}>
            <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
              Primary actions
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {!customerMode && (
                <>
                  <button
                    type="button"
                    onClick={onGenerateProposal}
                    disabled={exporting}
                    style={{
                      padding: "8px 12px",
                      border: "none",
                      borderRadius: 8,
                      background: T.blue,
                      color: "#fff",
                      cursor: exporting ? "default" : "pointer",
                      fontSize: 12,
                      fontFamily: T.mono,
                      fontWeight: 700,
                      opacity: exporting ? 0.75 : 1,
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
                        borderRadius: 8,
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
                      borderRadius: 8,
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
                </>
              )}
              <button
                type="button"
                onClick={onProposalDetails}
                style={{
                  padding: "8px 12px",
                  border: "1px solid " + T.blueMid,
                  borderRadius: 8,
                  background: T.blueFaint,
                  color: T.blue,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: T.mono,
                  fontWeight: 700,
                }}
              >
                Proposal Details
              </button>
            </div>
          </div>

          <div style={{ border: "1px solid " + T.border, borderRadius: 10, background: T.panel, padding: "10px 12px" }}>
            <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
              Add equipment
            </div>
            <AddEquipButtons onAdd={onAddEquipment} compact />
          </div>

          <div style={{ border: "1px solid " + T.border, borderRadius: 10, background: T.panel, padding: "10px 12px" }}>
            <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
              Tools
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {showBidAlternates && !customerMode && (
                <button
                  type="button"
                  onClick={onBidAlternate}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid " + T.green,
                    borderRadius: 8,
                    background: T.greenFaint || "#ECFDF5",
                    color: T.green,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: T.mono,
                    fontWeight: 700,
                  }}
                >
                  Bid Alternate
                </button>
              )}
              {!customerMode && (
                <button
                  type="button"
                  onClick={onSystemWizard}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid " + T.border2,
                    borderRadius: 8,
                    background: T.surface,
                    color: T.muted,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: T.mono,
                    fontWeight: 700,
                  }}
                >
                  System Wizard
                </button>
              )}
              {!customerMode && (
                <button
                  type="button"
                  onClick={onAiParser}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid " + T.border2,
                    borderRadius: 8,
                    background: T.surface,
                    color: T.muted,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: T.mono,
                    fontWeight: 700,
                  }}
                >
                  AI Parser
                </button>
              )}
              {showProjectSettings && !customerMode && (
                <button
                  type="button"
                  onClick={onSettings}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid " + T.border2,
                    borderRadius: 8,
                    background: T.surface,
                    color: T.muted,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: T.mono,
                    fontWeight: 700,
                  }}
                >
                  Settings
                </button>
              )}
              {onAiSettings && !customerMode && (
                <button
                  type="button"
                  onClick={onAiSettings}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid " + T.border2,
                    borderRadius: 8,
                    background: T.surface,
                    color: T.muted,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: T.mono,
                    fontWeight: 700,
                  }}
                >
                  AI Settings
                </button>
              )}
            </div>
          </div>

          {onDelete && !customerMode && (
            <div style={{ border: "1px solid " + T.border, borderRadius: 10, background: T.panel, padding: "10px 12px" }}>
              <div style={{ fontSize: 9, color: T.muted, fontFamily: T.mono, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>
                Destructive action
              </div>
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                style={{
                  padding: "8px 12px",
                  border: "1px solid " + T.rose,
                  borderRadius: 8,
                  background: "#FFF1F2",
                  color: T.rose,
                  cursor: deleting ? "default" : "pointer",
                  fontSize: 12,
                  fontFamily: T.mono,
                  fontWeight: 700,
                  opacity: deleting ? 0.75 : 1,
                }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          )}
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

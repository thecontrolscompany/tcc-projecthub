"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";

type RiskLevel = "low" | "medium" | "high";

type RiskRow = {
  id: string;
  title: string;
  level: RiskLevel;
  dueDate: string;
  mitigation: string;
};

type BuilderDraft = {
  reportDate: string;
  periodCovered: string;
  statusDate: string;
  contractStart: string;
  contractCompletion: string;
  contractValue: string;
  overallProgressPct: string;
  completedThisPeriod: string;
  lookAheadWeekOneLabel: string;
  lookAheadWeekOnePlan: string;
  lookAheadWeekTwoLabel: string;
  lookAheadWeekTwoPlan: string;
  occupantImpact: string;
  sapfCoordination: string;
  aesUpdate: string;
  greshamUpdate: string;
  financialNotes: string;
  risks: RiskRow[];
};

type SavedPacketResponse = {
  id: string;
  packet_date: string;
  updated_at: string;
  body: BuilderDraft;
  sharepoint_web_url: string | null;
};

function storageKey(projectId: string) {
  return `tcc-projecthub:eglin-1416-report-builder:${projectId}:v1`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function createDefaultDraft(): BuilderDraft {
  const reportDate = todayIso();

  return {
    reportDate,
    periodCovered: `${format(new Date(reportDate), "MMMM yyyy")} - ${format(new Date(reportDate), "MMMM d, yyyy")}`,
    statusDate: reportDate,
    contractStart: "2025-09-18",
    contractCompletion: "2027-03-17",
    contractValue: "1596000",
    overallProgressPct: "48.0",
    completedThisPeriod: [
      "Completed current trunk-wiring work in active field areas.",
      "Maintained coordination with the government team on access and sequencing.",
    ].join("\n"),
    lookAheadWeekOneLabel: "This Week",
    lookAheadWeekOnePlan: "",
    lookAheadWeekTwoLabel: "Next Week",
    lookAheadWeekTwoPlan: "",
    occupantImpact: "",
    sapfCoordination: "",
    aesUpdate: "",
    greshamUpdate: "",
    financialNotes: "",
    risks: [
      { id: "risk-1", title: "", level: "high", dueDate: "", mitigation: "" },
      { id: "risk-2", title: "", level: "medium", dueDate: "", mitigation: "" },
      { id: "risk-3", title: "", level: "medium", dueDate: "", mitigation: "" },
      { id: "risk-4", title: "", level: "low", dueDate: "", mitigation: "" },
    ],
  };
}

function normalizeLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s\-*•]+/, "").trim())
    .filter(Boolean);
}

function formatLongDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "MMMM d, yyyy");
}

function formatShortDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "MMM d, yyyy");
}

function formatCurrencyValue(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function clampPercent(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(numeric, 0), 100);
}

function riskLabel(level: RiskLevel) {
  if (level === "high") return "HIGH";
  if (level === "medium") return "MEDIUM";
  return "LOW";
}

function bulletText(lines: string[]) {
  if (lines.length === 0) return "No content yet.";
  return lines.map((line) => `- ${line}`).join("\n");
}

function CopyButton({
  label,
  text,
  copyKey,
  copiedKey,
  onCopy,
}: {
  label: string;
  text: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(copyKey, text)}
      className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
    >
      {copiedKey === copyKey ? "Copied" : label}
    </button>
  );
}

function OutputCard({
  title,
  description,
  text,
  copyKey,
  copiedKey,
  onCopy,
}: {
  title: string;
  description: string;
  text: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <p className="mt-1 text-sm text-text-tertiary">{description}</p>
        </div>
        <CopyButton
          label="Copy"
          text={text}
          copyKey={copyKey}
          copiedKey={copiedKey}
          onCopy={onCopy}
        />
      </div>
      <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-surface-base p-4 text-sm leading-6 text-text-primary">
        {text}
      </pre>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-base p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-2 text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}

export function Eglin1416ReportBuilder({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<BuilderDraft>(() => createDefaultDraft());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [latestPacket, setLatestPacket] = useState<SavedPacketResponse | null>(null);
  const [remoteLoaded, setRemoteLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey(projectId));
      if (!stored) {
        setHasLoaded(true);
        return;
      }

      const parsed = JSON.parse(stored) as Partial<BuilderDraft>;
      setDraft((current) => ({
        ...current,
        ...parsed,
        risks: Array.isArray(parsed.risks) && parsed.risks.length > 0 ? parsed.risks : current.risks,
      }));
    } catch {
      // ignore bad local drafts and fall back to defaults
    } finally {
      setHasLoaded(true);
    }
  }, [projectId]);

  useEffect(() => {
    if (!hasLoaded) return;
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(draft));
  }, [draft, hasLoaded, projectId]);

  useEffect(() => {
    if (!copiedKey) return;
    const timeout = window.setTimeout(() => setCopiedKey(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copiedKey]);

  useEffect(() => {
    if (!saveMessage) return;
    const timeout = window.setTimeout(() => setSaveMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

  function updateField<K extends keyof BuilderDraft>(field: K, value: BuilderDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateRisk(index: number, field: keyof RiskRow, value: string) {
    setDraft((current) => ({
      ...current,
      risks: current.risks.map((risk, riskIndex) =>
        riskIndex === index ? { ...risk, [field]: value } : risk
      ),
    }));
  }

  async function copySection(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
    } catch {
      setCopiedKey(null);
    }
  }

  function resetDraft() {
    const nextDraft = createDefaultDraft();
    setDraft(nextDraft);
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(nextDraft));
  }

  useEffect(() => {
    let active = true;

    async function loadLatestPacket() {
      try {
        const response = await fetch(
          `/api/pm/report-packets?projectId=${encodeURIComponent(projectId)}&reportType=eglin_1416_progress`,
          { credentials: "include" }
        );
        const json = await response.json().catch(() => null);
        if (!active || !response.ok || !json?.packet) {
          return;
        }

        const packet = json.packet as SavedPacketResponse;
        setLatestPacket(packet);

        const hasLocalDraft = Boolean(window.localStorage.getItem(storageKey(projectId)));
        if (!hasLocalDraft && packet.body) {
          setDraft((current) => ({
            ...current,
            ...packet.body,
            risks: Array.isArray(packet.body.risks) && packet.body.risks.length > 0 ? packet.body.risks : current.risks,
          }));
        }
      } finally {
        if (active) {
          setRemoteLoaded(true);
        }
      }
    }

    void loadLatestPacket();

    return () => {
      active = false;
    };
  }, [projectId]);

  async function savePacket(markdown: string) {
    setSaveState("saving");
    setSaveMessage(null);

    try {
      const response = await fetch("/api/pm/report-packets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          reportType: "eglin_1416_progress",
          packetDate: draft.reportDate,
          title: `${projectName} - Eglin 1416 Report Packet - ${draft.reportDate}`,
          body: draft,
          markdown,
        }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.packet) {
        throw new Error(json?.error ?? "Unable to save report packet.");
      }

      const packet = json.packet as SavedPacketResponse;
      setLatestPacket(packet);
      setSaveState("saved");
      setSaveMessage(
        packet.sharepoint_web_url
          ? "Saved to Supabase and SharePoint."
          : "Saved to Supabase. SharePoint upload was skipped."
      );
      return packet;
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Unable to save report packet.");
      return null;
    }
  }

  async function handleSaveAndGenerate() {
    const packet = await savePacket(centralPacketMarkdown);
    if (!packet) return;

    router.push(
      `/reports/project/eglin-1416?projectId=${encodeURIComponent(projectId)}&packetDate=${encodeURIComponent(packet.packet_date)}`
    );
  }

  const timeline = useMemo(() => {
    const start = new Date(`${draft.contractStart}T00:00:00`);
    const completion = new Date(`${draft.contractCompletion}T00:00:00`);
    const status = new Date(`${draft.statusDate}T00:00:00`);

    if ([start, completion, status].some((date) => Number.isNaN(date.getTime()))) {
      return {
        totalDays: 0,
        elapsedDays: 0,
        remainingDays: 0,
        elapsedPct: 0,
      };
    }

    const totalDays = Math.max(differenceInCalendarDays(completion, start), 0);
    const elapsedDays = Math.min(Math.max(differenceInCalendarDays(status, start), 0), totalDays);
    const remainingDays = Math.max(totalDays - elapsedDays, 0);
    const elapsedPct = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0;

    return {
      totalDays,
      elapsedDays,
      remainingDays,
      elapsedPct,
    };
  }, [draft.contractCompletion, draft.contractStart, draft.statusDate]);

  const riskBullets = useMemo(
    () =>
      draft.risks
        .filter((risk) => risk.title.trim() || risk.mitigation.trim())
        .map((risk) => {
          const dueText = risk.dueDate ? `target ${formatShortDate(risk.dueDate)}` : "target date not set";
          const mitigation = risk.mitigation.trim() || "Mitigation to be confirmed.";
          return `[${riskLabel(risk.level)}] ${risk.title || "Open item"} (${dueText}) - ${mitigation}`;
        }),
    [draft.risks]
  );

  const executiveBullets = useMemo(() => {
    const lines: string[] = [];
    const progress = clampPercent(draft.overallProgressPct).toFixed(1);

    lines.push(`Overall contract progress is ${progress}% as of ${formatLongDate(draft.statusDate)}.`);
    lines.push(
      `Elapsed contract time is ${timeline.elapsedPct.toFixed(1)}% (${timeline.elapsedDays} of ${timeline.totalDays} calendar days), with ${timeline.remainingDays} days remaining to completion.`
    );
    lines.push(...normalizeLines(draft.completedThisPeriod));

    const weekOnePlan = draft.lookAheadWeekOnePlan.trim();
    if (weekOnePlan) {
      lines.push(`${draft.lookAheadWeekOneLabel || "This Week"}: ${weekOnePlan}`);
    }

    const weekTwoPlan = draft.lookAheadWeekTwoPlan.trim();
    if (weekTwoPlan) {
      lines.push(`${draft.lookAheadWeekTwoLabel || "Next Week"}: ${weekTwoPlan}`);
    }

    return lines;
  }, [draft.completedThisPeriod, draft.lookAheadWeekOneLabel, draft.lookAheadWeekOnePlan, draft.lookAheadWeekTwoLabel, draft.lookAheadWeekTwoPlan, draft.overallProgressPct, draft.statusDate, timeline.elapsedDays, timeline.elapsedPct, timeline.remainingDays, timeline.totalDays]);

  const lookAheadBullets = useMemo(() => {
    const lines: string[] = [];

    if (draft.lookAheadWeekOnePlan.trim()) {
      lines.push(`${draft.lookAheadWeekOneLabel || "This Week"}: ${draft.lookAheadWeekOnePlan.trim()}`);
    }
    if (draft.lookAheadWeekTwoPlan.trim()) {
      lines.push(`${draft.lookAheadWeekTwoLabel || "Next Week"}: ${draft.lookAheadWeekTwoPlan.trim()}`);
    }

    lines.push(...normalizeLines(draft.occupantImpact).map((line) => `Occupant impact: ${line}`));
    lines.push(...normalizeLines(draft.sapfCoordination).map((line) => `SAPF coordination: ${line}`));

    return lines;
  }, [draft.lookAheadWeekOneLabel, draft.lookAheadWeekOnePlan, draft.lookAheadWeekTwoLabel, draft.lookAheadWeekTwoPlan, draft.occupantImpact, draft.sapfCoordination]);

  const partnerBullets = useMemo(() => {
    const lines: string[] = [];
    lines.push(...normalizeLines(draft.aesUpdate).map((line) => `AES: ${line}`));
    lines.push(...normalizeLines(draft.greshamUpdate).map((line) => `Gresham Smith: ${line}`));
    return lines;
  }, [draft.aesUpdate, draft.greshamUpdate]);

  const financialBullets = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Contract value: ${formatCurrencyValue(draft.contractValue)}.`);
    lines.push(`Current report date: ${formatLongDate(draft.reportDate)}.`);
    lines.push(`Overall contract progress: ${clampPercent(draft.overallProgressPct).toFixed(1)}%.`);
    lines.push(...normalizeLines(draft.financialNotes));
    return lines;
  }, [draft.contractValue, draft.financialNotes, draft.overallProgressPct, draft.reportDate]);

  const checklistBullets = useMemo(
    () => [
      `Update Report Date to ${formatLongDate(draft.reportDate)}.`,
      `Update Report Period to ${draft.periodCovered || `${formatLongDate(draft.contractStart)} - ${formatLongDate(draft.reportDate)}`}.`,
      `Update Project Status Date to ${formatLongDate(draft.statusDate)}.`,
      `Set time elapsed to ${timeline.elapsedPct.toFixed(1)}%.`,
      `Set overall progress to ${clampPercent(draft.overallProgressPct).toFixed(1)}%.`,
      `Set elapsed days to ${timeline.elapsedDays} and remaining days to ${timeline.remainingDays}.`,
      `Refresh exhibit date and any "Current Report Date" labels to ${formatLongDate(draft.reportDate)}.`,
      "Verify repeated dates and percentages across header, charts, timeline card, footer, and exhibit.",
    ],
    [draft.contractStart, draft.overallProgressPct, draft.periodCovered, draft.reportDate, draft.statusDate, timeline.elapsedDays, timeline.elapsedPct, timeline.remainingDays]
  );

  const fullPacketText = useMemo(() => {
    return [
      "Executive Summary",
      bulletText(executiveBullets),
      "",
      "Two-Week Look-Ahead",
      bulletText(lookAheadBullets),
      "",
      "Partner Updates",
      bulletText(partnerBullets),
      "",
      "Financial / Progress Notes",
      bulletText(financialBullets),
      "",
      "Open Items / Risks",
      bulletText(riskBullets),
      "",
      "HTML Update Checklist",
      bulletText(checklistBullets),
    ].join("\n");
  }, [checklistBullets, executiveBullets, financialBullets, lookAheadBullets, partnerBullets, riskBullets]);

  const centralPacketMarkdown = useMemo(() => {
    return [
      `# ${projectName} - Eglin 1416 Report Packet`,
      "",
      `- Report Date: ${formatLongDate(draft.reportDate)}`,
      `- Project Status Date: ${formatLongDate(draft.statusDate)}`,
      `- Report Period: ${draft.periodCovered}`,
      `- Contract Value: ${formatCurrencyValue(draft.contractValue)}`,
      `- Overall Progress: ${clampPercent(draft.overallProgressPct).toFixed(1)}%`,
      `- Elapsed Time: ${timeline.elapsedPct.toFixed(1)}%`,
      `- Elapsed Days: ${timeline.elapsedDays}`,
      `- Remaining Days: ${timeline.remainingDays}`,
      "",
      "## Executive Summary",
      bulletText(executiveBullets),
      "",
      "## Two-Week Look-Ahead",
      bulletText(lookAheadBullets),
      "",
      "## Partner Updates",
      bulletText(partnerBullets),
      "",
      "## Financial / Progress Notes",
      bulletText(financialBullets),
      "",
      "## Open Items / Risks",
      bulletText(riskBullets),
      "",
      "## HTML Update Checklist",
      bulletText(checklistBullets),
    ].join("\n");
  }, [
    checklistBullets,
    draft.contractValue,
    draft.overallProgressPct,
    draft.periodCovered,
    draft.reportDate,
    draft.statusDate,
    executiveBullets,
    financialBullets,
    lookAheadBullets,
    partnerBullets,
    projectName,
    riskBullets,
    timeline.elapsedDays,
    timeline.elapsedPct,
    timeline.remainingDays,
  ]);

  const inputCls =
    "w-full rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm text-text-primary placeholder-text-tertiary focus:border-status-success/50 focus:outline-none";
  const labelCls = "mb-1.5 block text-sm font-medium text-text-secondary";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-status-success/20 bg-status-success/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-status-success">Project-Specific Builder</p>
            <h1 className="mt-1 text-2xl font-bold text-text-primary">Eglin 1416 Report Builder</h1>
            <p className="mt-1 max-w-3xl text-sm text-text-secondary">
              This is an internal helper for the recurring Eglin 1416 customer update. It stores a local draft in this browser and produces copy-ready bullet points for the report HTML.
            </p>
            <div className="mt-3 space-y-1 text-xs text-text-tertiary">
              <p>Project: {projectName}</p>
              <p>
                Latest central save:{" "}
                {latestPacket ? formatLongDate(latestPacket.packet_date) : remoteLoaded ? "None yet" : "Loading..."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void savePacket(centralPacketMarkdown)}
              disabled={saveState === "saving"}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-60"
            >
              {saveState === "saving" ? "Saving..." : "Save Packet Centrally"}
            </button>
            <button
              type="button"
              onClick={() => void handleSaveAndGenerate()}
              disabled={saveState === "saving"}
              className="rounded-xl bg-status-success px-4 py-2 text-sm font-semibold text-text-inverse transition hover:opacity-90 disabled:opacity-60"
            >
              {saveState === "saving" ? "Saving..." : "Save + Generate Report"}
            </button>
            {latestPacket && (
              <a
                href={`/reports/project/eglin-1416?projectId=${encodeURIComponent(projectId)}&packetDate=${encodeURIComponent(latestPacket.packet_date)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
              >
                Open Latest Report
              </a>
            )}
            {latestPacket?.sharepoint_web_url && (
              <a
                href={latestPacket.sharepoint_web_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
              >
                Open Saved Packet
              </a>
            )}
            <a
              href="/pm"
              className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
            >
              Back to PM Portal
            </a>
            <button
              type="button"
              onClick={resetDraft}
              className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
            >
              Reset Draft
            </button>
          </div>
        </div>
        {saveMessage && (
          <p className={`mt-4 text-sm ${saveState === "error" ? "text-status-danger" : "text-status-success"}`}>
            {saveMessage}
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h2 className="text-base font-semibold text-text-primary">Report Setup</h2>
            <p className="mt-1 text-sm text-text-tertiary">These fields drive the repeated dates, percentages, and timeline values used throughout the report.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Report Date</label>
                <input type="date" value={draft.reportDate} onChange={(event) => updateField("reportDate", event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Project Status Date</label>
                <input type="date" value={draft.statusDate} onChange={(event) => updateField("statusDate", event.target.value)} className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Report Period</label>
                <input
                  type="text"
                  value={draft.periodCovered}
                  onChange={(event) => updateField("periodCovered", event.target.value)}
                  className={inputCls}
                  placeholder="March 2026 - April 13, 2026"
                />
              </div>
              <div>
                <label className={labelCls}>Contract Start</label>
                <input type="date" value={draft.contractStart} onChange={(event) => updateField("contractStart", event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Contract Completion</label>
                <input type="date" value={draft.contractCompletion} onChange={(event) => updateField("contractCompletion", event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Contract Value</label>
                <input type="number" value={draft.contractValue} onChange={(event) => updateField("contractValue", event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Overall Progress %</label>
                <input type="number" step="0.1" min="0" max="100" value={draft.overallProgressPct} onChange={(event) => updateField("overallProgressPct", event.target.value)} className={inputCls} />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h2 className="text-base font-semibold text-text-primary">Field Progress Inputs</h2>
            <p className="mt-1 text-sm text-text-tertiary">Use one bullet per line. These become the executive summary and progress bullets.</p>
            <div className="mt-4 space-y-4">
              <div>
                <label className={labelCls}>Completed This Period</label>
                <textarea rows={5} value={draft.completedThisPeriod} onChange={(event) => updateField("completedThisPeriod", event.target.value)} className={inputCls} placeholder="Completed current trunk-wiring work in active field areas." />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelCls}>Look-Ahead Label 1</label>
                  <input type="text" value={draft.lookAheadWeekOneLabel} onChange={(event) => updateField("lookAheadWeekOneLabel", event.target.value)} className={inputCls} placeholder="April 13-17" />
                </div>
                <div>
                  <label className={labelCls}>Look-Ahead Plan 1</label>
                  <input type="text" value={draft.lookAheadWeekOnePlan} onChange={(event) => updateField("lookAheadWeekOnePlan", event.target.value)} className={inputCls} placeholder="AHU 20/21 controller replacement begins." />
                </div>
                <div>
                  <label className={labelCls}>Look-Ahead Label 2</label>
                  <input type="text" value={draft.lookAheadWeekTwoLabel} onChange={(event) => updateField("lookAheadWeekTwoLabel", event.target.value)} className={inputCls} placeholder="April 20-24" />
                </div>
                <div>
                  <label className={labelCls}>Look-Ahead Plan 2</label>
                  <input type="text" value={draft.lookAheadWeekTwoPlan} onChange={(event) => updateField("lookAheadWeekTwoPlan", event.target.value)} className={inputCls} placeholder="Continue controller changeover and testing." />
                </div>
              </div>
              <div>
                <label className={labelCls}>Occupant / Shutdown Impacts</label>
                <textarea rows={4} value={draft.occupantImpact} onChange={(event) => updateField("occupantImpact", event.target.value)} className={inputCls} placeholder="Temporary HVAC outage expected in affected zone during changeover." />
              </div>
              <div>
                <label className={labelCls}>SAPF / Access Coordination</label>
                <textarea rows={4} value={draft.sapfCoordination} onChange={(event) => updateField("sapfCoordination", event.target.value)} className={inputCls} placeholder="No SAPF entry required during this period." />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h2 className="text-base font-semibold text-text-primary">Partner Inputs</h2>
            <p className="mt-1 text-sm text-text-tertiary">Paste or refine the bullet lines from AES and Gresham updates.</p>
            <div className="mt-4 space-y-4">
              <div>
                <label className={labelCls}>AES Update</label>
                <textarea rows={5} value={draft.aesUpdate} onChange={(event) => updateField("aesUpdate", event.target.value)} className={inputCls} placeholder="Major hardware is procured and programmed." />
              </div>
              <div>
                <label className={labelCls}>Gresham Smith Update</label>
                <textarea rows={4} value={draft.greshamUpdate} onChange={(event) => updateField("greshamUpdate", event.target.value)} className={inputCls} placeholder="Cx kickoff meeting scheduled for the week of ..." />
              </div>
              <div>
                <label className={labelCls}>Financial / Progress Notes</label>
                <textarea rows={4} value={draft.financialNotes} onChange={(event) => updateField("financialNotes", event.target.value)} className={inputCls} placeholder="Use for billing, percent-complete, CLIN, or progress-chart notes." />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h2 className="text-base font-semibold text-text-primary">Open Items / Risks</h2>
            <p className="mt-1 text-sm text-text-tertiary">Keep this focused on what still matters this week. Blank rows are ignored in the generated output.</p>
            <div className="mt-4 space-y-4">
              {draft.risks.map((risk, index) => (
                <div key={risk.id} className="rounded-xl border border-border-default bg-surface-base p-4">
                  <div className="grid gap-4 md:grid-cols-[1.4fr,0.8fr,0.8fr]">
                    <div>
                      <label className={labelCls}>Risk / Open Item</label>
                      <input type="text" value={risk.title} onChange={(event) => updateRisk(index, "title", event.target.value)} className={inputCls} placeholder="Controller delivery to site" />
                    </div>
                    <div>
                      <label className={labelCls}>Severity</label>
                      <select value={risk.level} onChange={(event) => updateRisk(index, "level", event.target.value)} className={inputCls}>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Target Date</label>
                      <input type="date" value={risk.dueDate} onChange={(event) => updateRisk(index, "dueDate", event.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className={labelCls}>Mitigation / Current Note</label>
                    <textarea rows={3} value={risk.mitigation} onChange={(event) => updateRisk(index, "mitigation", event.target.value)} className={inputCls} placeholder="Vendor tracking delivery; field team will phase work if shipment slips." />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h2 className="text-base font-semibold text-text-primary">Report Numbers</h2>
            <p className="mt-1 text-sm text-text-tertiary">Use these values to update the repeated timeline and progress callouts in the HTML report.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MetricCard label="Report Date" value={formatLongDate(draft.reportDate) || "-"} />
              <MetricCard label="Status Date" value={formatLongDate(draft.statusDate) || "-"} />
              <MetricCard label="Elapsed Time %" value={`${timeline.elapsedPct.toFixed(1)}%`} />
              <MetricCard label="Overall Progress %" value={`${clampPercent(draft.overallProgressPct).toFixed(1)}%`} />
              <MetricCard label="Elapsed Days" value={`${timeline.elapsedDays}`} />
              <MetricCard label="Remaining Days" value={`${timeline.remainingDays}`} />
              <MetricCard label="Contract Value" value={formatCurrencyValue(draft.contractValue)} />
              <MetricCard label="Report Period" value={draft.periodCovered || "-"} />
            </div>
          </section>

          <OutputCard title="Executive Summary Bullets" description="Short bullets for the top of the report or the customer-facing status summary." text={bulletText(executiveBullets)} copyKey="executive" copiedKey={copiedKey} onCopy={copySection} />
          <OutputCard title="Two-Week Look-Ahead Bullets" description="Copy-ready schedule, impact, and coordination bullets." text={bulletText(lookAheadBullets)} copyKey="look-ahead" copiedKey={copiedKey} onCopy={copySection} />
          <OutputCard title="Partner Update Bullets" description="Vendor and commissioning bullets pulled from AES and Gresham inputs." text={bulletText(partnerBullets)} copyKey="partners" copiedKey={copiedKey} onCopy={copySection} />
          <OutputCard title="Financial / Progress Bullets" description="Use these for financial summary notes or progress callouts." text={bulletText(financialBullets)} copyKey="financial" copiedKey={copiedKey} onCopy={copySection} />
          <OutputCard title="Open Items / Risk Bullets" description="These map well to the report's open items and risk register section." text={bulletText(riskBullets)} copyKey="risks" copiedKey={copiedKey} onCopy={copySection} />
          <OutputCard title="HTML Update Checklist" description="Quick list of repeated values to touch before exporting the new PDF." text={bulletText(checklistBullets)} copyKey="checklist" copiedKey={copiedKey} onCopy={copySection} />
          <OutputCard title="Full Weekly Packet" description="Single copy block for your working notes or issue checklist." text={fullPacketText} copyKey="full-packet" copiedKey={copiedKey} onCopy={copySection} />
        </div>
      </div>
    </div>
  );
}

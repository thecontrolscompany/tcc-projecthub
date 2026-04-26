"use client";

import { useEffect, useMemo, useState } from "react";

type ProjectBillingPeriod = {
  id: string;
  project_id: string;
  period_month: string;
  estimated_income_snapshot: number;
  prior_pct: number;
  pct_complete: number;
  prev_billed: number;
  actual_billed: number | null;
  notes: string | null;
  synced_from_onedrive: boolean;
};

type BillingDraft = ProjectBillingPeriod & {
  actual_billed_input: string;
  pct_complete_input: string;
  notes_input: string;
};

type ProjectBillingResponse = {
  project?: {
    id: string;
    name: string;
    estimated_income: number | null;
    contract_price: number | null;
  } | null;
  periods?: ProjectBillingPeriod[];
  error?: string;
};

const inputClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const compactInputClassName =
  "w-full rounded-lg border border-border-default bg-surface-overlay px-2 py-1.5 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

function currency(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMonth(value: string) {
  return new Date(`${value.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function toDraft(period: ProjectBillingPeriod): BillingDraft {
  return {
    ...period,
    actual_billed_input: period.actual_billed === null ? "" : String(period.actual_billed),
    pct_complete_input: String(Math.round((period.pct_complete ?? 0) * 1000) / 10),
    notes_input: period.notes ?? "",
  };
}

function parseCurrencyInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercentInput(value: string) {
  const parsed = Number(value.replace(/%/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1, parsed / 100));
}

export function ProjectBillingSection({ projectId }: { projectId: string }) {
  const [projectName, setProjectName] = useState("");
  const [projectContractValue, setProjectContractValue] = useState(0);
  const [periods, setPeriods] = useState<BillingDraft[]>([]);
  const [newMonth, setNewMonth] = useState(currentMonthValue());
  const [newActualBilled, setNewActualBilled] = useState("");
  const [newPctComplete, setNewPctComplete] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBilling() {
      setLoading(true);
      setError(null);
      setStatus(null);

      try {
        const response = await fetch(`/api/admin/project-billing?projectId=${encodeURIComponent(projectId)}`, {
          credentials: "include",
        });
        const json = (await response.json()) as ProjectBillingResponse;

        if (!response.ok) {
          throw new Error(json.error ?? "Failed to load billing.");
        }

        if (!cancelled) {
          setProjectName(json.project?.name ?? "");
          setProjectContractValue(Number(json.project?.contract_price ?? json.project?.estimated_income ?? 0));
          setPeriods((json.periods ?? []).map(toDraft));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load billing.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBilling();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const totals = useMemo(() => {
    return periods.reduce(
      (acc, period) => {
        acc.actualBilled += parseCurrencyInput(period.actual_billed_input) ?? 0;
        acc.contractValue = Math.max(acc.contractValue, Number(period.estimated_income_snapshot ?? 0));
        return acc;
      },
      { actualBilled: 0, contractValue: projectContractValue }
    );
  }, [periods, projectContractValue]);

  const remaining = Math.max(totals.contractValue - totals.actualBilled, 0);
  const isDirty = useMemo(
    () =>
      periods.some(
        (period) =>
          (parseCurrencyInput(period.actual_billed_input) ?? null) !== (period.actual_billed ?? null) ||
          parsePercentInput(period.pct_complete_input) !== (period.pct_complete ?? 0) ||
          period.notes_input !== (period.notes ?? "")
      ),
    [periods]
  );

  function updatePeriod(id: string, patch: Partial<Pick<BillingDraft, "actual_billed_input" | "pct_complete_input" | "notes_input">>) {
    setStatus(null);
    setPeriods((current) => current.map((period) => (period.id === id ? { ...period, ...patch } : period)));
  }

  async function savePeriods() {
    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/project-billing", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          updates: periods.map((period) => ({
            id: period.id,
            actual_billed: parseCurrencyInput(period.actual_billed_input),
            pct_complete: parsePercentInput(period.pct_complete_input),
            notes: period.notes_input,
          })),
        }),
      });
      const json = (await response.json()) as ProjectBillingResponse;

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to save billing.");
      }

      setPeriods((json.periods ?? []).map(toDraft));
      setStatus("Billing saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save billing.");
    } finally {
      setSaving(false);
    }
  }

  async function addPeriod() {
    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/project-billing", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          periodMonth: newMonth,
          actual_billed: parseCurrencyInput(newActualBilled),
          pct_complete: parsePercentInput(newPctComplete),
        }),
      });
      const json = (await response.json()) as ProjectBillingResponse;

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to add billing month.");
      }

      setPeriods((json.periods ?? []).map(toDraft));
      setNewActualBilled("");
      setNewPctComplete("");
      setStatus("Billing month added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add billing month.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-border-default bg-surface-raised p-4 text-sm text-text-secondary">
        Loading billing...
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="font-heading text-lg font-semibold text-text-primary">Billing</h4>
          <p className="mt-1 text-sm text-text-secondary">
            Monthly billing entries for {projectName || "this project"}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void savePeriods()}
          disabled={!isDirty || saving}
          className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Billing"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      )}
      {status && (
        <div className="rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          {status}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryTile label="Contract" value={currency(totals.contractValue)} />
        <SummaryTile label="Billed" value={currency(totals.actualBilled)} />
        <SummaryTile label="Remaining" value={currency(remaining)} />
      </div>

      <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
        <div className="grid gap-3 md:grid-cols-[180px,180px,160px,auto] md:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Month</span>
            <input type="month" value={newMonth} onChange={(event) => setNewMonth(event.target.value)} className={inputClassName} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Actual Billed</span>
            <input
              value={newActualBilled}
              onChange={(event) => setNewActualBilled(event.target.value)}
              className={inputClassName}
              placeholder="$0.00"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">% Complete</span>
            <input
              value={newPctComplete}
              onChange={(event) => setNewPctComplete(event.target.value)}
              className={inputClassName}
              placeholder="0"
            />
          </label>
          <button
            type="button"
            onClick={() => void addPeriod()}
            disabled={saving || !newMonth}
            className="rounded-xl bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Month
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
        {periods.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-secondary">
            No billing months entered yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-default text-sm">
              <thead className="bg-surface-overlay">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Month</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Prior Billed</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Actual Billed</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">% Complete</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {periods.map((period) => (
                  <tr key={period.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-text-primary">
                      {formatMonth(period.period_month)}
                      {period.synced_from_onedrive && (
                        <span className="ml-2 rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs font-semibold text-brand-primary">
                          Synced
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-text-secondary">
                      {currency(period.prev_billed)}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={period.actual_billed_input}
                        onChange={(event) => updatePeriod(period.id, { actual_billed_input: event.target.value })}
                        className={`${compactInputClassName} text-right`}
                        placeholder="$0.00"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={period.pct_complete_input}
                        onChange={(event) => updatePeriod(period.id, { pct_complete_input: event.target.value })}
                        className={`${compactInputClassName} text-right`}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={period.notes_input}
                        onChange={(event) => updatePeriod(period.id, { notes_input: event.target.value })}
                        className={compactInputClassName}
                        placeholder="Optional notes"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</div>
      <div className="mt-1 text-lg font-semibold text-text-primary">{value}</div>
    </div>
  );
}

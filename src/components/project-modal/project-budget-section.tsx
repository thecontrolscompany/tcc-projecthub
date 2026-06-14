"use client";

import { useEffect, useMemo, useState } from "react";

type BudgetCategory = "labor" | "material" | "subcontractor" | "other";
type ManualCategory = "labor" | "subcontractor" | "other";

type BudgetLine = {
  id: string;
  project_id: string;
  category: BudgetCategory;
  description: string | null;
  budgeted_cost: number;
  actual_cost: number | null;
  notes: string | null;
};

type CategoryTotal = { budgeted: number; actual: number };

type BudgetSummary = {
  laborRate: number;
  lines: BudgetLine[];
  totals: {
    labor: CategoryTotal & { actualHours: number };
    material: CategoryTotal;
    subcontractor: CategoryTotal;
    other: CategoryTotal;
  };
  error?: string;
};

const inputClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const compactInputClassName =
  "w-full rounded-lg border border-border-default bg-surface-overlay px-2 py-1.5 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  labor: "Labor",
  material: "Materials",
  subcontractor: "Subcontractors",
  other: "Other",
};

function currency(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function variance(budgeted: number, actual: number) {
  const value = budgeted - actual;
  const formatted = currency(Math.abs(value));
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

function pctOf(actual: number, budgeted: number) {
  if (budgeted <= 0) return actual > 0 ? Infinity : null;
  return actual / budgeted;
}

function formatPct(pct: number | null) {
  if (pct === null) return "—";
  if (!Number.isFinite(pct)) return ">999%";
  return `${Math.round(pct * 100)}%`;
}

function pctToneClass(pct: number | null) {
  if (pct === null) return "bg-surface-overlay text-text-secondary";
  if (!Number.isFinite(pct) || pct > 1) return "bg-status-danger/10 text-status-danger";
  if (pct >= 0.9) return "bg-status-warning/10 text-status-warning";
  return "bg-status-success/10 text-status-success";
}

function parseCurrencyInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function ProjectBudgetSection({ projectId }: { projectId: string }) {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [laborRateInput, setLaborRateInput] = useState("");
  const [savingLaborRate, setSavingLaborRate] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/project-budget?projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      const json = (await response.json()) as BudgetSummary;

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load budget.");
      }

      setSummary(json);
      setLaborRateInput(String(json.laborRate));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load budget.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const totals = useMemo(() => {
    if (!summary) return null;
    const { labor, material, subcontractor, other } = summary.totals;
    const totalBudgeted = labor.budgeted + material.budgeted + subcontractor.budgeted + other.budgeted;
    const totalActual = labor.actual + material.actual + subcontractor.actual + other.actual;
    return { totalBudgeted, totalActual };
  }, [summary]);

  async function saveLaborRate() {
    const laborRate = parseCurrencyInput(laborRateInput);
    if (laborRate === null || laborRate < 0) {
      setError("Enter a valid labor rate.");
      return;
    }

    setSavingLaborRate(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/project-budget", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, laborRate }),
      });
      const json = (await response.json()) as BudgetSummary;

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to save labor rate.");
      }

      setSummary(json);
      setLaborRateInput(String(json.laborRate));
      setStatus("Labor rate saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save labor rate.");
    } finally {
      setSavingLaborRate(false);
    }
  }

  async function saveLine(id: string, patch: { description?: string | null; budgeted_cost?: number; actual_cost?: number | null; notes?: string | null }) {
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/project-budget", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, id, ...patch }),
      });
      const json = (await response.json()) as BudgetSummary;

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to save budget line.");
      }

      setSummary(json);
      setStatus("Budget line saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save budget line.");
    }
  }

  async function deleteLine(id: string) {
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/project-budget", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, id }),
      });
      const json = (await response.json()) as BudgetSummary;

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to remove budget line.");
      }

      setSummary(json);
      setStatus("Budget line removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove budget line.");
    }
  }

  async function addLine(category: ManualCategory, draft: { description: string; budgeted_cost: string; actual_cost: string; notes: string }) {
    setError(null);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/project-budget", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          category,
          description: draft.description,
          budgeted_cost: parseCurrencyInput(draft.budgeted_cost) ?? 0,
          actual_cost: parseCurrencyInput(draft.actual_cost),
          notes: draft.notes,
        }),
      });
      const json = (await response.json()) as BudgetSummary;

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to add budget line.");
      }

      setSummary(json);
      setStatus("Budget line added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add budget line.");
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-border-default bg-surface-raised p-4 text-sm text-text-secondary">
        Loading budget...
      </section>
    );
  }

  if (!summary || !totals) {
    return (
      <section className="rounded-2xl border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger">
        {error ?? "Unable to load budget."}
      </section>
    );
  }

  const { labor, material, subcontractor, other } = summary.totals;

  return (
    <section className="space-y-5">
      <div>
        <h4 className="font-heading text-lg font-semibold text-text-primary">Budget vs Actual</h4>
        <p className="mt-1 text-sm text-text-secondary">
          Estimated vs actual cost by category. Material figures come from BOM unit costs and receipts; labor actual comes
          from QB Time hours.
        </p>
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

      <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-default text-sm">
            <thead className="bg-surface-overlay">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Category</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Budgeted</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Actual</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Variance</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">% Used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              <SummaryRow label={CATEGORY_LABELS.labor} budgeted={labor.budgeted} actual={labor.actual} note={`${labor.actualHours} hrs @ ${currency(summary.laborRate)}/hr`} />
              <SummaryRow label={CATEGORY_LABELS.material} budgeted={material.budgeted} actual={material.actual} note="From BOM unit costs / receipts" />
              <SummaryRow label={CATEGORY_LABELS.subcontractor} budgeted={subcontractor.budgeted} actual={subcontractor.actual} />
              <SummaryRow label={CATEGORY_LABELS.other} budgeted={other.budgeted} actual={other.actual} />
              <tr className="bg-surface-overlay font-semibold text-text-primary">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right">{currency(totals.totalBudgeted)}</td>
                <td className="px-4 py-3 text-right">{currency(totals.totalActual)}</td>
                <td className="px-4 py-3 text-right">{variance(totals.totalBudgeted, totals.totalActual)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${pctToneClass(pctOf(totals.totalActual, totals.totalBudgeted))}`}>
                    {formatPct(pctOf(totals.totalActual, totals.totalBudgeted))}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
        <div className="grid gap-3 sm:grid-cols-[200px,160px,auto] sm:items-end">
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">Labor Rate ($/hr)</span>
            <span className="block text-xs text-text-tertiary">Used to convert QB Time hours into actual labor cost.</span>
          </div>
          <input value={laborRateInput} onChange={(e) => setLaborRateInput(e.target.value)} className={inputClassName} placeholder="42.95" />
          <button
            type="button"
            onClick={() => void saveLaborRate()}
            disabled={savingLaborRate || laborRateInput === String(summary.laborRate)}
            className="rounded-xl bg-surface-overlay px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingLaborRate ? "Saving..." : "Save Rate"}
          </button>
        </div>
      </div>

      <BudgetCategorySection
        title="Labor Budget"
        description="Manual budgeted labor cost (e.g. estimated labor hours x rate). Actual is computed above from QB Time."
        category="labor"
        lines={summary.lines.filter((line) => line.category === "labor")}
        showActualCost={false}
        onSave={saveLine}
        onDelete={deleteLine}
        onAdd={addLine}
      />

      <BudgetCategorySection
        title="Subcontractors"
        description="Budgeted and actual subcontractor cost (manual until QBO bills are connected)."
        category="subcontractor"
        lines={summary.lines.filter((line) => line.category === "subcontractor")}
        showActualCost
        onSave={saveLine}
        onDelete={deleteLine}
        onAdd={addLine}
      />

      <BudgetCategorySection
        title="Other"
        description="Any other budgeted/actual cost not covered by labor, materials, or subcontractors."
        category="other"
        lines={summary.lines.filter((line) => line.category === "other")}
        showActualCost
        onSave={saveLine}
        onDelete={deleteLine}
        onAdd={addLine}
      />
    </section>
  );
}

function SummaryRow({ label, budgeted, actual, note }: { label: string; budgeted: number; actual: number; note?: string }) {
  const pct = pctOf(actual, budgeted);
  return (
    <tr>
      <td className="px-4 py-3 font-medium text-text-primary">
        {label}
        {note && <span className="mt-0.5 block text-xs font-normal text-text-tertiary">{note}</span>}
      </td>
      <td className="px-4 py-3 text-right text-text-primary">{currency(budgeted)}</td>
      <td className="px-4 py-3 text-right text-text-primary">{currency(actual)}</td>
      <td className="px-4 py-3 text-right text-text-secondary">{variance(budgeted, actual)}</td>
      <td className="px-4 py-3 text-right">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${pctToneClass(pct)}`}>{formatPct(pct)}</span>
      </td>
    </tr>
  );
}

function BudgetCategorySection({
  title,
  description,
  category,
  lines,
  showActualCost,
  onSave,
  onDelete,
  onAdd,
}: {
  title: string;
  description: string;
  category: ManualCategory;
  lines: BudgetLine[];
  showActualCost: boolean;
  onSave: (id: string, patch: { description?: string | null; budgeted_cost?: number; actual_cost?: number | null; notes?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAdd: (category: ManualCategory, draft: { description: string; budgeted_cost: string; actual_cost: string; notes: string }) => Promise<void>;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h5 className="font-heading text-base font-semibold text-text-primary">{title}</h5>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>

      <div className="space-y-2">
        {lines.map((line) => (
          <BudgetLineRow key={line.id} line={line} showActualCost={showActualCost} onSave={onSave} onDelete={onDelete} />
        ))}
        <AddBudgetLineRow category={category} showActualCost={showActualCost} onAdd={onAdd} />
      </div>
    </section>
  );
}

function BudgetLineRow({
  line,
  showActualCost,
  onSave,
  onDelete,
}: {
  line: BudgetLine;
  showActualCost: boolean;
  onSave: (id: string, patch: { description?: string | null; budgeted_cost?: number; actual_cost?: number | null; notes?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [description, setDescription] = useState(line.description ?? "");
  const [budgetedCost, setBudgetedCost] = useState(String(line.budgeted_cost ?? 0));
  const [actualCost, setActualCost] = useState(line.actual_cost === null ? "" : String(line.actual_cost));
  const [notes, setNotes] = useState(line.notes ?? "");
  const [saving, setSaving] = useState(false);

  const isDirty =
    description !== (line.description ?? "") ||
    parseCurrencyInput(budgetedCost) !== Number(line.budgeted_cost ?? 0) ||
    parseCurrencyInput(actualCost) !== (line.actual_cost ?? null) ||
    notes !== (line.notes ?? "");

  async function save() {
    setSaving(true);
    try {
      await onSave(line.id, {
        description: description.trim() || null,
        budgeted_cost: parseCurrencyInput(budgetedCost) ?? 0,
        actual_cost: parseCurrencyInput(actualCost),
        notes: notes.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`grid gap-2 rounded-xl border border-border-default bg-surface-base p-3 sm:items-center ${showActualCost ? "sm:grid-cols-[1fr,140px,140px,1fr,auto,auto]" : "sm:grid-cols-[1fr,140px,1fr,auto,auto]"}`}>
      <input value={description} onChange={(e) => setDescription(e.target.value)} className={compactInputClassName} placeholder="Description" />
      <input value={budgetedCost} onChange={(e) => setBudgetedCost(e.target.value)} className={`${compactInputClassName} text-right`} placeholder="$0.00" />
      {showActualCost && (
        <input value={actualCost} onChange={(e) => setActualCost(e.target.value)} className={`${compactInputClassName} text-right`} placeholder="$0.00" />
      )}
      <input value={notes} onChange={(e) => setNotes(e.target.value)} className={compactInputClassName} placeholder="Notes" />
      <button
        type="button"
        onClick={() => void save()}
        disabled={!isDirty || saving}
        className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "..." : "Save"}
      </button>
      <button
        type="button"
        onClick={() => void onDelete(line.id)}
        className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-raised hover:text-text-primary"
      >
        Remove
      </button>
    </div>
  );
}

function AddBudgetLineRow({
  category,
  showActualCost,
  onAdd,
}: {
  category: ManualCategory;
  showActualCost: boolean;
  onAdd: (category: ManualCategory, draft: { description: string; budgeted_cost: string; actual_cost: string; notes: string }) => Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const [budgetedCost, setBudgetedCost] = useState("");
  const [actualCost, setActualCost] = useState("");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);

  async function add() {
    setAdding(true);
    try {
      await onAdd(category, { description, budgeted_cost: budgetedCost, actual_cost: actualCost, notes });
      setDescription("");
      setBudgetedCost("");
      setActualCost("");
      setNotes("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={`grid gap-2 rounded-xl border border-dashed border-border-default bg-surface-raised p-3 sm:items-center ${showActualCost ? "sm:grid-cols-[1fr,140px,140px,1fr,auto]" : "sm:grid-cols-[1fr,140px,1fr,auto]"}`}>
      <input value={description} onChange={(e) => setDescription(e.target.value)} className={compactInputClassName} placeholder="New line description" />
      <input value={budgetedCost} onChange={(e) => setBudgetedCost(e.target.value)} className={`${compactInputClassName} text-right`} placeholder="Budgeted $" />
      {showActualCost && (
        <input value={actualCost} onChange={(e) => setActualCost(e.target.value)} className={`${compactInputClassName} text-right`} placeholder="Actual $" />
      )}
      <input value={notes} onChange={(e) => setNotes(e.target.value)} className={compactInputClassName} placeholder="Notes" />
      <button
        type="button"
        onClick={() => void add()}
        disabled={adding || !description.trim()}
        className="rounded-lg bg-surface-overlay px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:bg-surface-base disabled:cursor-not-allowed disabled:opacity-50"
      >
        {adding ? "Adding..." : "Add"}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ParsedPocImportRow } from "@/lib/poc/import";
import type { PocLineItem } from "@/types/database";

type ParsedPocSheet = {
  filename: string;
  worksheetName: string;
  rows: ParsedPocImportRow[];
  totalWeight: number;
  overallPct: number;
  existingCount: number;
};

type PocSheetImportDialogProps = {
  projectId: string;
  onClose: () => void;
  onImported: () => void;
};

function PocSheetImportDialog({ projectId, onClose, onImported }: PocSheetImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState<ParsedPocSheet | null>(null);
  const [result, setResult] = useState<{ imported: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleParse() {
    if (!file) return;

    setParsing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);

      const response = await fetch("/api/admin/parse-poc-sheet", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to parse POC sheet.");
      }

      setParsed({
        filename: (json?.filename as string) ?? file.name,
        worksheetName: (json?.worksheetName as string) ?? "Sheet1",
        rows: ((json?.rows as ParsedPocImportRow[] | undefined) ?? []),
        totalWeight: typeof json?.totalWeight === "number" ? json.totalWeight : 0,
        overallPct: typeof json?.overallPct === "number" ? json.overallPct : 0,
        existingCount: typeof json?.existingCount === "number" ? json.existingCount : 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse POC sheet.");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!parsed) return;

    setImporting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/import-poc-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          filename: parsed.filename,
          rows: parsed.rows,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to import POC sheet.");
      }

      setResult({
        imported: typeof json?.imported === "number" ? json.imported : parsed.rows.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import POC sheet.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="w-full max-w-3xl rounded-2xl border border-border-default bg-surface-base shadow-xl">
        <div className="flex items-start justify-between border-b border-border-default px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">POC Import</p>
            <h3 className="mt-1 text-xl font-bold text-text-primary">Import POC Sheet</h3>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">x</button>
        </div>

        <div className="space-y-4 px-6 py-6">
          {error && (
            <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
              {error}
            </div>
          )}

          {!parsed && !result && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Select a POC Sheet file (.xlsx or .xlsm) to import category names, weights, and current % complete.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="file"
                  accept=".xlsx,.xlsm"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="text-sm text-text-secondary"
                />
                <span className="text-sm text-text-tertiary">{file?.name ?? "No file chosen"}</span>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleParse()}
                  disabled={!file || parsing}
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
                >
                  {parsing ? "Parsing..." : "Parse File"}
                </button>
              </div>
            </div>
          )}

          {parsed && !result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">{parsed.filename}</p>
                  <p className="text-xs text-text-tertiary">
                    Worksheet: {parsed.worksheetName} · {parsed.rows.length} rows · Total weight {parsed.totalWeight} · Overall {(parsed.overallPct * 100).toFixed(1)}%
                  </p>
                </div>
                {parsed.existingCount > 0 && (
                  <span className="rounded-full bg-status-warning/10 px-2.5 py-1 text-xs font-medium text-status-warning">
                    Replaces {parsed.existingCount} existing items
                  </span>
                )}
              </div>

              <div className="max-h-[420px] overflow-auto rounded-2xl border border-border-default">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-raised">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Category</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Weight</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">% Complete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map((row, index) => (
                      <tr key={`${row.category}-${index}`} className="border-b border-border-default">
                        <td className="px-4 py-2.5 text-text-primary">{row.category}</td>
                        <td className="px-4 py-2.5 text-right text-text-secondary">{row.weight}</td>
                        <td className="px-4 py-2.5 text-right text-text-secondary">{(row.pctComplete * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-surface-overlay px-4 py-2 text-sm text-text-secondary hover:bg-surface-overlay"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={parsed.rows.length === 0 || importing}
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
                >
                  {importing ? "Importing..." : `Import ${parsed.rows.length} Line Item${parsed.rows.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <p className="text-base font-semibold text-text-primary">Import complete.</p>
              <div className="space-y-2 text-sm text-text-secondary">
                <p>✓ {result.imported} line items imported</p>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onImported}
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PocSetupSection({ projectId }: { projectId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<PocLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState("");
  const [newWeight, setNewWeight] = useState("10");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function loadItems() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/data?section=project-poc-items&projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      const json = await response.json();
      setItems((((response.ok ? json?.items : []) ?? []) as PocLineItem[]));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  async function persistSortOrder(nextItems: PocLineItem[]) {
    await Promise.all(
      nextItems.map((item, index) =>
        supabase.from("poc_line_items").update({ sort_order: index }).eq("id", item.id)
      )
    );
  }

  async function handleAdd() {
    if (!newCategory.trim() || !newWeight) return;
    setAdding(true);
    setStatusMessage(null);
    const { data, error } = await supabase
      .from("poc_line_items")
      .insert({
        project_id: projectId,
        category: newCategory.trim(),
        weight: Number(newWeight),
        pct_complete: 0,
        sort_order: items.length,
      })
      .select()
      .single();
    if (!error && data) {
      setItems((prev) => [...prev, data as PocLineItem]);
      setNewCategory("");
      setNewWeight("10");
      setStatusMessage("POC item added.");
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    setStatusMessage(null);
    await supabase.from("poc_line_items").delete().eq("id", id);
    const nextItems = items.filter((item) => item.id !== id).map((item, index) => ({ ...item, sort_order: index }));
    setItems(nextItems);
    await persistSortOrder(nextItems);
    setStatusMessage("POC item removed.");
  }

  async function handleWeightChange(id: string, weight: number) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, weight } : item)));
    setSaving(id);
    await supabase.from("poc_line_items").update({ weight }).eq("id", id);
    setSaving(null);
  }

  async function handleCategorySave(id: string, category: string) {
    setSaving(id);
    await supabase.from("poc_line_items").update({ category }).eq("id", id);
    setSaving(null);
  }

  async function moveItem(id: string, direction: -1 | 1) {
    const currentIndex = items.findIndex((item) => item.id === id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= items.length) return;

    const reordered = [...items];
    const [movedItem] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, movedItem);
    const nextItems = reordered.map((item, index) => ({ ...item, sort_order: index }));
    setItems(nextItems);
    setSaving(id);
    await persistSortOrder(nextItems);
    setSaving(null);
  }

  async function handleClearAll() {
    if (items.length === 0) return;
    const confirmed = window.confirm("Delete all POC line items for this project?");
    if (!confirmed) return;

    setSaving("all");
    setStatusMessage(null);
    await supabase.from("poc_line_items").delete().eq("project_id", projectId);
    setItems([]);
    setSaving(null);
    setStatusMessage("All POC items cleared for this project.");
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-heading text-lg font-semibold text-text-primary">POC Line Items</h4>
          <p className="text-xs text-text-secondary">Project-scoped categories and weights used to calculate % complete.</p>
        </div>
        <div className="flex items-center gap-2">
          {totalWeight > 0 && <span className="text-xs text-text-tertiary">Total weight: {totalWeight}</span>}
          <button
            type="button"
            onClick={() => setShowImportDialog(true)}
            className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
          >
            Import POC Sheet...
          </button>
          <button
            type="button"
            onClick={() => void handleClearAll()}
            disabled={items.length === 0 || saving === "all"}
            className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-1.5 text-xs font-medium text-status-danger transition hover:bg-status-danger/20 disabled:opacity-50"
          >
            {saving === "all" ? "Clearing..." : "Clear All"}
          </button>
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        Define the categories and relative weights for the % complete calculation. PMs update each category&apos;s completion in their weekly report.
      </p>
      {statusMessage && (
        <div className="rounded-xl border border-status-success/20 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          {statusMessage}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-tertiary">Loading...</p>
      ) : (
        <div className="space-y-2">
          {items.length === 0 && (
            <p className="text-sm text-text-tertiary">No POC line items yet. Add categories below.</p>
          )}
          {items.map((item, index) => {
            const currentPercent = item.pct_complete * 100;
            const percentOfTotal = totalWeight > 0 ? (item.weight / totalWeight) * 100 : 0;
            const contribution = totalWeight > 0 ? (item.weight * item.pct_complete) / totalWeight * 100 : 0;
            const badgeClass =
              currentPercent > 50
                ? "bg-status-success/10 text-status-success"
                : currentPercent >= 20
                  ? "bg-status-warning/10 text-status-warning"
                  : "bg-surface-overlay text-text-secondary";

            return (
              <div key={item.id} className="rounded-xl border border-border-default bg-surface-raised px-4 py-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={item.category}
                        onChange={(e) => {
                          const nextCategory = e.target.value;
                          setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, category: nextCategory } : row)));
                        }}
                        onBlur={(e) => void handleCategorySave(item.id, e.target.value)}
                        className="min-w-[220px] rounded-lg border border-border-default bg-surface-overlay px-2.5 py-1 text-sm font-medium text-text-primary focus:border-brand-primary/50 focus:outline-none"
                      />
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
                        {currentPercent.toFixed(0)}%
                      </span>
                      <span className="text-xs text-text-tertiary">{percentOfTotal.toFixed(0)}% of total weight</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs text-text-tertiary">
                        <span>Weighted contribution</span>
                        <span>{contribution.toFixed(1)} points</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-overlay">
                        <div
                          className="h-full rounded-full bg-brand-primary/60 transition-all"
                          style={{ width: `${Math.min(contribution, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void moveItem(item.id, -1)}
                        disabled={index === 0}
                        className="rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-xs text-text-secondary transition hover:bg-surface-base hover:text-text-primary disabled:opacity-40"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => void moveItem(item.id, 1)}
                        disabled={index === items.length - 1}
                        className="rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-xs text-text-secondary transition hover:bg-surface-base hover:text-text-primary disabled:opacity-40"
                      >
                        Down
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-text-tertiary">weight</span>
                      <input
                        type="number"
                        min={1}
                        value={item.weight}
                        onChange={(e) => handleWeightChange(item.id, Number(e.target.value))}
                        className="w-16 rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-center text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
                      />
                    </div>
                    {saving === item.id && <span className="text-xs text-text-tertiary">saving...</span>}
                    <button onClick={() => handleDelete(item.id)} className="text-xs text-status-danger hover:underline">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
              placeholder="Category name (e.g. AHU's)"
              className="flex-1 rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary/50 focus:outline-none"
            />
            <input
              type="number"
              min={1}
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="Weight"
              className="w-20 rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-center text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
            />
            <button
              onClick={() => void handleAdd()}
              disabled={adding || !newCategory.trim()}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-brand-hover disabled:opacity-50"
            >
              {adding ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      )}

      {showImportDialog && (
        <PocSheetImportDialog
          projectId={projectId}
          onClose={() => setShowImportDialog(false)}
          onImported={() => {
            setShowImportDialog(false);
            setStatusMessage("POC sheet imported for this project.");
            void loadItems();
          }}
        />
      )}
    </section>
  );
}

export function EstimatorAndPocSection({
  projectId,
  sourceEstimateId,
  onSourceEstimateIdChange,
}: {
  projectId: string;
  sourceEstimateId: string;
  onSourceEstimateIdChange: (v: string) => void;
}) {
  const [showEstimator, setShowEstimator] = useState(Boolean(sourceEstimateId));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-heading text-lg font-semibold text-text-primary">POC Setup</h4>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={showEstimator}
            onChange={(e) => setShowEstimator(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-brand-primary)]"
          />
          Link Estimate
        </label>
      </div>
      {showEstimator && (
        <div className="space-y-1.5 rounded-xl border border-border-default bg-surface-raised px-4 py-3">
          <label className="block text-sm font-medium text-text-secondary">Estimator Reference ID</label>
          <input
            value={sourceEstimateId}
            onChange={(e) => onSourceEstimateIdChange(e.target.value)}
            placeholder="Paste estimate ID from estimates.thecontrolscompany.com"
            className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
          />
          <p className="text-xs text-text-tertiary">
            Links POC categories to the original estimate. Future feature — save the ID now for later sync.
          </p>
        </div>
      )}
      <PocSetupSection projectId={projectId} />
    </div>
  );
}

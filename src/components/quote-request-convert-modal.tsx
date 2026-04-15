"use client";

import { useState } from "react";
import type { QuoteRequest } from "@/types/database";

const inputClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

export function QuoteRequestConvertModal({
  quote,
  onClose,
  onConverted,
}: {
  quote: QuoteRequest;
  onClose: () => void;
  onConverted: (projectId: string, projectName: string, jobNumber: string) => void;
}) {
  const [name, setName] = useState(quote.project_name ?? quote.project_description);
  const [siteAddress, setSiteAddress] = useState(quote.project_location ?? quote.site_address ?? "");
  const [estimatedIncome, setEstimatedIncome] = useState(String(quote.final_price_amount ?? quote.opportunity_value ?? quote.estimated_value ?? 0));
  const [bondRequired, setBondRequired] = useState(false);
  const [bondAmount, setBondAmount] = useState(String(quote.bond_amount ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConvert(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const base = Number(estimatedIncome || 0);
      const bond = bondRequired ? Number(bondAmount || 0) : 0;
      const response = await fetch("/api/admin/convert-quote-to-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          quote_id: quote.id,
          name,
          site_address: siteAddress,
          estimated_income: base + bond,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Unable to convert quote.");
      }

      onConverted(json.project_id, `${json.job_number} - ${name.trim()}`, json.job_number);
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : "Unable to convert quote.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl border border-border-default bg-surface-base shadow-2xl">
        <div className="flex items-start justify-between border-b border-border-default px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Opportunity Hub</p>
            <h3 className="mt-1 text-xl font-bold text-text-primary">Convert Opportunity to Project</h3>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            x
          </button>
        </div>

        <form onSubmit={handleConvert} className="space-y-5 px-6 py-6">
          {error ? (
            <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
              {error}
            </div>
          ) : null}

          <Field label="Project Name">
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClassName} />
          </Field>

          <Field label="Site Address">
            <input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} className={inputClassName} />
          </Field>

          <Field label="Estimated Income">
            <input type="number" min="0" step="0.01" value={estimatedIncome} onChange={(e) => setEstimatedIncome(e.target.value)} className={inputClassName} />
          </Field>

          <Field label="Bond required">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={bondRequired}
                onChange={(e) => setBondRequired(e.target.checked)}
                className="rounded border-border-default"
              />
              Include performance &amp; payment bond in project value
            </label>
          </Field>

          {bondRequired && (
            <Field label="Bond amount">
              <input
                type="number"
                min="0"
                step="0.01"
                value={bondAmount}
                onChange={(e) => setBondAmount(e.target.value)}
                className={inputClassName}
                placeholder="0.00"
              />
            </Field>
          )}

          <div className="rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-secondary">
            Job number will be auto-generated when the project is created.
          </div>

          <div className="flex justify-end gap-3 border-t border-border-default pt-4">
            <button type="button" onClick={onClose} className="rounded-xl bg-surface-overlay px-4 py-2 text-sm text-text-secondary hover:bg-surface-overlay">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="rounded-xl bg-status-success px-4 py-2 text-sm font-semibold text-text-inverse hover:opacity-90 disabled:opacity-60">
              {saving ? "Converting..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

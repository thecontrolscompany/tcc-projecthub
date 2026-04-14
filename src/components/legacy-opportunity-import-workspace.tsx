"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import {
  buildNormalizedPreview,
  inferImportMapping,
  OPPORTUNITY_IMPORT_FIELD_LABELS,
  parseDelimitedText,
  type InferredOpportunityField,
  type ParsedImportPreview,
} from "@/lib/opportunity-import";
import type { LegacyOpportunityImportBatch } from "@/types/database";

export function LegacyOpportunityImportWorkspace() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedImportPreview | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);
  const [batches, setBatches] = useState<LegacyOpportunityImportBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [savingBatch, setSavingBatch] = useState(false);
  const [savedBatchId, setSavedBatchId] = useState<string | null>(null);

  const mapping = useMemo(() => {
    if (!preview) return null;
    return inferImportMapping(preview.headers);
  }, [preview]);

  const normalizedPreview = useMemo(() => {
    if (!preview) return [];
    return buildNormalizedPreview(preview);
  }, [preview]);

  useEffect(() => {
    void loadBatches();
  }, []);

  async function loadBatches() {
    setLoadingBatches(true);
    try {
      const response = await fetch("/api/opportunities/import/batches", { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) {
        setMigrationMessage(json?.migrationRequired ? json.error ?? "Run migrations 045 and 046 first." : null);
        throw new Error(json?.error ?? "Unable to load import batches.");
      }

      setMigrationMessage(null);
      setBatches((json.batches ?? []) as LegacyOpportunityImportBatch[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load import batches.");
    } finally {
      setLoadingBatches(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setSavedBatchId(null);

    try {
      const text = await file.text();
      const parsed = parseDelimitedText(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        throw new Error("The file needs a header row and at least one data row.");
      }

      setPreview(parsed);
    } catch (uploadError) {
      setPreview(null);
      setError(uploadError instanceof Error ? uploadError.message : "Unable to parse import file.");
    }
  }

  async function handleStageBatch() {
    if (!preview || !fileName) return;

    setSavingBatch(true);
    setError(null);
    setSavedBatchId(null);

    try {
      const response = await fetch("/api/opportunities/import/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_name: fileName.replace(/\.[^.]+$/, ""),
          source_file_name: fileName,
          notes,
          preview,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        if (json?.migrationRequired) {
          setMigrationMessage(json.error ?? "Run migrations 045 and 046 first.");
        }
        throw new Error(json?.error ?? "Unable to stage import batch.");
      }

      setSavedBatchId(json.batch.id);
      setNotes("");
      await loadBatches();
    } catch (stageError) {
      setError(stageError instanceof Error ? stageError.message : "Unable to stage import batch.");
    } finally {
      setSavingBatch(false);
    }
  }

  return (
    <div className="space-y-6">
      <OpportunityHubSubnav />

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Opportunity Hub</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Legacy Import Workspace</h1>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          Stage older bid history safely before it becomes live pipeline data. Parsed rows will flow into a review queue where we can match them to active projects or existing pursuits.
        </p>
      </div>

      {migrationMessage ? (
        <div className="rounded-2xl border border-status-warning/30 bg-status-warning/10 px-5 py-4 text-sm text-status-warning">
          {migrationMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 px-5 py-4 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      {savedBatchId ? (
        <div className="rounded-2xl border border-status-success/30 bg-status-success/10 px-5 py-4 text-sm text-status-success">
          Legacy batch staged successfully.{" "}
          <Link href={`/quotes/import/review?batch=${savedBatchId}`} className="font-semibold underline">
            Open the review queue
          </Link>
          .
        </div>
      ) : null}

      <div className="rounded-2xl border border-border-default bg-surface-raised p-6">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border-default bg-surface-base px-6 py-10 text-center transition hover:border-brand-primary/50">
          <span className="text-sm font-semibold text-text-primary">Drop a legacy CSV here or click to browse</span>
          <span className="mt-2 text-sm text-text-secondary">The preview works with comma-separated or tab-separated exports.</span>
          <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFileChange} />
        </label>

        {fileName ? (
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <div>
              <p className="text-sm text-text-secondary">
                Loaded file: <span className="font-medium text-text-primary">{fileName}</span>
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                {preview?.rows.length ?? 0} data rows ready for staging
              </p>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-text-secondary">Batch notes</span>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional context about this import..."
                className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </label>

            <button
              type="button"
              onClick={() => void handleStageBatch()}
              disabled={!preview || savingBatch}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-60"
            >
              {savingBatch ? "Staging..." : "Stage Batch"}
            </button>
          </div>
        ) : null}
      </div>

      {preview ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Headers found" value={String(preview.headers.length)} />
            <StatCard label="Rows parsed" value={String(preview.rows.length)} />
            <StatCard label="Delimiter" value={preview.delimiter === "tab" ? "Tab" : "Comma"} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="rounded-2xl border border-border-default bg-surface-raised p-6">
              <h2 className="text-lg font-semibold text-text-primary">Detected Mapping</h2>
              <p className="mt-1 text-sm text-text-secondary">
                These header matches become the normalized payload stored with each staged row.
              </p>

              <div className="mt-5 space-y-3">
                {(Object.keys(OPPORTUNITY_IMPORT_FIELD_LABELS) as InferredOpportunityField[]).map((field) => (
                  <div key={field} className="flex items-center justify-between rounded-xl border border-border-default bg-surface-base px-4 py-3">
                    <span className="text-sm text-text-secondary">{OPPORTUNITY_IMPORT_FIELD_LABELS[field]}</span>
                    <span className="text-sm font-medium text-text-primary">{mapping?.get(field) ?? "Not detected"}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border-default bg-surface-raised p-6">
              <h2 className="text-lg font-semibold text-text-primary">Normalized Preview</h2>
              <p className="mt-1 text-sm text-text-secondary">
                This is the exact shape that will be staged into the review tables.
              </p>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-border-default text-left text-xs uppercase tracking-wide text-text-tertiary">
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Opportunity</th>
                      <th className="px-3 py-2">Company</th>
                      <th className="px-3 py-2">Job #</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedPreview.map((row) => (
                      <tr key={row.row_number} className="border-b border-border-default last:border-b-0">
                        <td className="px-3 py-2 text-text-secondary">{row.row_number}</td>
                        <td className="px-3 py-2 text-text-primary">{row.opportunity_name || "-"}</td>
                        <td className="px-3 py-2 text-text-primary">{row.company_name || "-"}</td>
                        <td className="px-3 py-2 text-text-secondary">{row.job_number || "-"}</td>
                        <td className="px-3 py-2 text-text-secondary">{row.amount || "-"}</td>
                        <td className="px-3 py-2 text-text-secondary">{row.issues.join(", ") || "Looks good"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      ) : null}

      <section className="rounded-2xl border border-border-default bg-surface-raised p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Recent Batches</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Recently staged legacy imports ready for review and matching.
            </p>
          </div>
          <Link href="/quotes/import/review" className="text-sm font-medium text-brand-primary hover:text-brand-hover">
            Open review queue
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs uppercase tracking-wide text-text-tertiary">
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Rows</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Imported</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingBatches ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-text-tertiary">
                    Loading batches...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-text-tertiary">
                    No legacy batches staged yet.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id} className="border-b border-border-default last:border-b-0">
                    <td className="px-3 py-2 text-text-primary">{batch.source_name}</td>
                    <td className="px-3 py-2 text-text-secondary">{batch.source_file_name ?? "-"}</td>
                    <td className="px-3 py-2 text-text-secondary">{batch.row_count}</td>
                    <td className="px-3 py-2 text-text-secondary">{batch.status}</td>
                    <td className="px-3 py-2 text-text-secondary">{new Date(batch.imported_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <Link href={`/quotes/import/review?batch=${batch.id}`} className="text-sm font-medium text-brand-primary hover:text-brand-hover">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

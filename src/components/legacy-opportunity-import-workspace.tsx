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

type SavedBatchMode = "package" | "csv";

export function LegacyOpportunityImportWorkspace() {
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedImportPreview | null>(null);
  const [csvNotes, setCsvNotes] = useState("");
  const [packageSourceName, setPackageSourceName] = useState("");
  const [packageNotes, setPackageNotes] = useState("");
  const [proposalDocx, setProposalDocx] = useState<File | null>(null);
  const [proposalPdf, setProposalPdf] = useState<File | null>(null);
  const [estimateWorkbook, setEstimateWorkbook] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);
  const [batches, setBatches] = useState<LegacyOpportunityImportBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [savingBatch, setSavingBatch] = useState(false);
  const [savingPackage, setSavingPackage] = useState(false);
  const [savedBatchId, setSavedBatchId] = useState<string | null>(null);
  const [savedBatchMode, setSavedBatchMode] = useState<SavedBatchMode | null>(null);

  const mapping = useMemo(() => {
    if (!preview) return null;
    return inferImportMapping(preview.headers);
  }, [preview]);

  const normalizedPreview = useMemo(() => {
    if (!preview) return [];
    return buildNormalizedPreview(preview);
  }, [preview]);

  const selectedPackageCount = [proposalDocx, proposalPdf, estimateWorkbook].filter(Boolean).length;

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

  async function handleCsvFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    setError(null);
    setSavedBatchId(null);
    setSavedBatchMode(null);

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
    if (!preview || !csvFileName) return;

    setSavingBatch(true);
    setError(null);
    setSavedBatchId(null);
    setSavedBatchMode(null);

    try {
      const response = await fetch("/api/opportunities/import/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_name: csvFileName.replace(/\.[^.]+$/, ""),
          source_file_name: csvFileName,
          notes: csvNotes,
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
      setSavedBatchMode("csv");
      setCsvNotes("");
      await loadBatches();
    } catch (stageError) {
      setError(stageError instanceof Error ? stageError.message : "Unable to stage import batch.");
    } finally {
      setSavingBatch(false);
    }
  }

  async function handleStartPackage() {
    if (!proposalDocx && !proposalPdf && !estimateWorkbook) {
      setError("Select at least one proposal or estimate file to start a legacy package.");
      return;
    }

    setSavingPackage(true);
    setError(null);
    setSavedBatchId(null);
    setSavedBatchMode(null);

    try {
      const formData = new FormData();
      if (packageSourceName.trim()) formData.set("sourceName", packageSourceName.trim());
      if (packageNotes.trim()) formData.set("notes", packageNotes.trim());
      if (proposalDocx) formData.set("proposalDocx", proposalDocx);
      if (proposalPdf) formData.set("proposalPdf", proposalPdf);
      if (estimateWorkbook) formData.set("estimateWorkbook", estimateWorkbook);

      const response = await fetch("/api/opportunities/import/package", {
        method: "POST",
        body: formData,
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Unable to create legacy package.");
      }

      setSavedBatchId(json.batch.id);
      setSavedBatchMode("package");
      setPackageSourceName("");
      setPackageNotes("");
      setProposalDocx(null);
      setProposalPdf(null);
      setEstimateWorkbook(null);
      await loadBatches();
    } catch (packageError) {
      setError(packageError instanceof Error ? packageError.message : "Unable to create legacy package.");
    } finally {
      setSavingPackage(false);
    }
  }

  return (
    <div className="space-y-6">
      <OpportunityHubSubnav />

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Opportunity Hub</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Legacy Import Workspace</h1>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          Start with the real proposal package first. Upload the proposal `.docx`, proposal `.pdf`, and estimate `.xlsm`, let Opportunity Hub scrape the key bid data, and move straight into review. CSV import is still available below for bulk backfills.
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
          {savedBatchMode === "package" ? "Legacy document package staged successfully." : "Legacy CSV batch staged successfully."}{" "}
          <Link href={`/quotes/import/review?batch=${savedBatchId}`} className="font-semibold underline">
            Open the review queue
          </Link>
          .
        </div>
      ) : null}

      <section className="rounded-2xl border border-border-default bg-surface-raised p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-primary">Primary Intake</p>
            <h2 className="mt-1 text-lg font-semibold text-text-primary">Start from the proposal package</h2>
            <p className="mt-2 max-w-3xl text-sm text-text-secondary">
              This creates a staged legacy opportunity from the files themselves, stores the originals in the bid folder structure from the roadmap, and preloads the review queue with extracted scope, pricing, and estimate data.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleStartPackage()}
            disabled={savingPackage}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-60"
          >
            {savingPackage ? "Creating package..." : "Create review package"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="grid gap-4 md:grid-cols-3">
            <PackageFileField label="Proposal DOCX" accept=".docx" file={proposalDocx} onChange={setProposalDocx} />
            <PackageFileField label="Proposal PDF" accept=".pdf" file={proposalPdf} onChange={setProposalPdf} />
            <PackageFileField label="Estimate XLSM" accept=".xlsm" file={estimateWorkbook} onChange={setEstimateWorkbook} />
          </div>

          <div className="space-y-4 rounded-2xl border border-border-default bg-surface-base p-5">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-text-secondary">Opportunity label</span>
              <input
                value={packageSourceName}
                onChange={(event) => setPackageSourceName(event.target.value)}
                placeholder="Optional package name or bid title"
                className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-text-secondary">Package notes</span>
              <textarea
                value={packageNotes}
                onChange={(event) => setPackageNotes(event.target.value)}
                placeholder="Optional context about where these files came from"
                rows={4}
                className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <StatCard label="Files selected" value={String(selectedPackageCount)} />
              <StatCard label="DOCX" value={proposalDocx ? "Ready" : "Optional"} />
              <StatCard label="XLSM" value={estimateWorkbook ? "Ready" : "Optional"} />
            </div>

            <p className="text-xs text-text-tertiary">
              Use any combination of the three files. You only need custom dates or spreadsheet rows when the documents are missing.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border-default bg-surface-raised p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Secondary Intake</p>
          <h2 className="mt-1 text-lg font-semibold text-text-primary">Bulk CSV fallback</h2>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Use this when you only have a spreadsheet export and need to stage many legacy rows at once. Document packages can still be attached later in the review queue.
          </p>
        </div>

        <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border-default bg-surface-base px-6 py-10 text-center transition hover:border-brand-primary/50">
          <span className="text-sm font-semibold text-text-primary">Drop a legacy CSV here or click to browse</span>
          <span className="mt-2 text-sm text-text-secondary">The preview works with comma-separated or tab-separated exports.</span>
          <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleCsvFileChange} />
        </label>

        {csvFileName ? (
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <div>
              <p className="text-sm text-text-secondary">
                Loaded file: <span className="font-medium text-text-primary">{csvFileName}</span>
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                {preview?.rows.length ?? 0} data rows ready for staging
              </p>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-text-secondary">Batch notes</span>
              <input
                value={csvNotes}
                onChange={(event) => setCsvNotes(event.target.value)}
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
              {savingBatch ? "Staging..." : "Stage CSV Batch"}
            </button>
          </div>
        ) : null}
      </section>

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
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Rows</th>
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
                    <td className="px-3 py-2 text-text-secondary">
                      {batch.source_metadata?.import_mode === "document_package" ? "Document package" : "CSV import"}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{batch.source_file_name ?? "-"}</td>
                    <td className="px-3 py-2 text-text-secondary">{batch.row_count}</td>
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

function PackageFileField({
  label,
  accept,
  file,
  onChange,
}: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block rounded-2xl border border-border-default bg-surface-base p-4">
      <span className="block text-sm font-medium text-text-primary">{label}</span>
      <input
        type="file"
        accept={accept}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="mt-3 block w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface-overlay file:px-3 file:py-2 file:text-sm file:font-medium file:text-text-primary"
      />
      <p className="mt-2 text-xs text-text-tertiary">{file ? file.name : "No file selected"}</p>
    </label>
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

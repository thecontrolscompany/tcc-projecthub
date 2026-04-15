"use client";

import { useState } from "react";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import { safeJson } from "@/lib/utils/safe-json";
import type { ManifestEntry } from "@/lib/onedrive-archive-scanner";

const YEAR_BUCKETS = [
  { value: "", label: "All years" },
  { value: "_Archive", label: "Current year" },
  { value: "_2025 Bids", label: "2025" },
  { value: "_2024 Bids", label: "2024" },
  { value: "_2023 Bids", label: "2023" },
  { value: "_2022 Bids", label: "2022" },
  { value: "_2021 Bids", label: "2021" },
  { value: "_Completed", label: "Completed" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-brand-primary/10 text-brand-primary",
  lost: "bg-status-danger/10 text-status-danger",
  won: "bg-status-success/10 text-status-success",
};

export function MassImportWorkspace() {
  const [yearFilter, setYearFilter] = useState("_2022 Bids");
  const [scanning, setScanning] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [manifest, setManifest] = useState<ManifestEntry[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<{ created: number; skipped: number } | null>(null);

  async function handleScan() {
    setScanning(true);
    setScanError(null);
    setManifest(null);
    setCommitResult(null);

    try {
      const response = await fetch("/api/opportunities/import/mass/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearFilter: yearFilter || undefined }),
      });
      const json = await safeJson(response);
      if (!response.ok) throw new Error(json?.error ?? "Scan failed.");
      setManifest((json.manifest ?? []) as ManifestEntry[]);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  function setEntryField<K extends keyof ManifestEntry>(
    index: number,
    key: K,
    value: ManifestEntry[K]
  ) {
    setManifest((prev) =>
      prev
        ? prev.map((entry, entryIndex) => (entryIndex === index ? { ...entry, [key]: value } : entry))
        : prev
    );
  }

  function toggleSkipAll(skip: boolean) {
    setManifest((prev) => prev?.map((entry) => ({ ...entry, skip })) ?? prev);
  }

  async function handleCommit() {
    if (!manifest) return;
    const toImport = manifest.filter((entry) => !entry.skip);
    if (toImport.length === 0) {
      setScanError("All entries are marked as skip. Uncheck some rows before committing.");
      return;
    }
    if (!confirm(`Import ${toImport.length} pursuit${toImport.length !== 1 ? "s" : ""}? This will create pursuit and quote_request records for each.`)) return;

    setCommitting(true);
    setScanError(null);

    try {
      const response = await fetch("/api/opportunities/import/mass/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: toImport }),
      });
      const json = await safeJson(response);
      if (!response.ok) throw new Error(json?.error ?? "Import failed.");
      setCommitResult({ created: json.created ?? 0, skipped: json.skipped ?? 0 });
      setManifest(null);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setCommitting(false);
    }
  }

  const stats = manifest
    ? {
        total: manifest.length,
        toImport: manifest.filter((entry) => !entry.skip).length,
        warnings: manifest.filter((entry) => entry.warnings.length > 0).length,
        alreadyImported: manifest.filter((entry) => entry.already_imported).length,
        withGcQuotes: manifest.filter((entry) => entry.pattern === "gc_subfolders").length,
      }
    : null;

  return (
    <div className="space-y-6">
      <OpportunityHubSubnav />

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Opportunity Hub</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Mass Import</h1>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          Scan the OneDrive archive to preview all historical bid opportunities, review and edit the manifest, then commit to create pursuit records in bulk.
          No files are downloaded, only folder metadata is read.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border-default bg-surface-raised p-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">Year bucket</label>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            disabled={scanning}
            className="rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
          >
            {YEAR_BUCKETS.map((bucket) => (
              <option key={bucket.value} value={bucket.value}>{bucket.label}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => void handleScan()}
          disabled={scanning || committing}
          className="rounded-xl bg-brand-primary px-5 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-60"
        >
          {scanning ? "Scanning OneDrive..." : "Scan"}
        </button>

        {scanning ? (
          <p className="text-sm text-text-tertiary">
            Reading folder tree via Microsoft Graph API. This may take 15-30 seconds for large year buckets.
          </p>
        ) : null}
      </div>

      {scanError ? (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 px-5 py-4 text-sm text-status-danger">
          {scanError}
        </div>
      ) : null}

      {commitResult ? (
        <div className="rounded-2xl border border-status-success/30 bg-status-success/10 px-5 py-4 text-sm text-status-success">
          Import complete - {commitResult.created} pursuit{commitResult.created !== 1 ? "s" : ""} created, {commitResult.skipped} skipped (already existed).
        </div>
      ) : null}

      {stats ? (
        <div className="grid gap-4 md:grid-cols-5">
          {[
            { label: "Total found", value: stats.total },
            { label: "To import", value: stats.toImport },
            { label: "With GC quotes", value: stats.withGcQuotes },
            { label: "Warnings", value: stats.warnings },
            { label: "Name match (skip?)", value: stats.alreadyImported },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border-default bg-surface-raised p-4">
              <p className="text-sm text-text-secondary">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold text-text-primary">{stat.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {manifest && manifest.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => toggleSkipAll(false)}
                className="rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-overlay"
              >
                Include all
              </button>
              <button
                type="button"
                onClick={() => toggleSkipAll(true)}
                className="rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-overlay"
              >
                Skip all
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleCommit()}
              disabled={committing || stats?.toImport === 0}
              className="rounded-xl bg-status-success px-6 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {committing
                ? "Importing..."
                : `Go Ahead - Import ${stats?.toImport ?? 0} pursuit${(stats?.toImport ?? 0) !== 1 ? "s" : ""}`}
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border-default bg-surface-raised">
            <table className="w-full text-sm">
              <thead className="border-b border-border-default bg-surface-base">
                <tr>
                  <th className="w-10 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Skip</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Pursuit name</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Pattern</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Quotes</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Files</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Warnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {manifest.map((entry, index) => {
                  const totalFiles = entry.quotes.reduce((count, quote) => count + quote.files.length, 0);
                  const hasWarning = entry.warnings.length > 0;
                  const isDuplicate = entry.already_imported;

                  return (
                    <tr
                      key={entry.pursuit_item_id}
                      className={entry.skip ? "opacity-40" : hasWarning ? "bg-status-warning/5" : ""}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={entry.skip}
                          onChange={(e) => setEntryField(index, "skip", e.target.checked)}
                          className="h-4 w-4 rounded border-border-default"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={entry.pursuit_name}
                          onChange={(e) => setEntryField(index, "pursuit_name", e.target.value)}
                          className={`w-full min-w-[200px] rounded-lg border px-2 py-1 text-sm text-text-primary focus:border-brand-primary focus:outline-none ${
                            isDuplicate
                              ? "border-status-warning bg-status-warning/10"
                              : "border-border-default bg-surface-overlay"
                          }`}
                          title={isDuplicate ? "Name matches an existing pursuit" : undefined}
                        />
                        {isDuplicate ? (
                          <p className="mt-0.5 text-xs text-status-warning">Name already exists</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[entry.pursuit_status] ?? ""}`}>
                          {entry.pursuit_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-text-tertiary">
                        {entry.pattern === "gc_subfolders"
                          ? `${entry.quotes.length} GC quotes`
                          : entry.pattern === "completed"
                          ? "completed"
                          : "single"}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        {entry.quotes
                          .filter((quote) => quote.gc_name)
                          .map((quote) => quote.gc_name)
                          .join(", ") || "-"}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{totalFiles || "-"}</td>
                      <td className="px-3 py-2">
                        {hasWarning ? (
                          <span className="text-xs text-status-warning" title={entry.warnings.join("; ")}>
                            ! {entry.warnings[0]}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-text-tertiary">
            {stats?.toImport} of {stats?.total} entries will be imported. Rows highlighted in amber have warnings or name conflicts.
          </p>
        </div>
      ) : null}
    </div>
  );
}

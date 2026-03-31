"use client";

import { useMemo, useState } from "react";

type Classification = "active" | "completed" | "bid";
type Tab = "migration" | "cleanup";

interface MigrationCandidate {
  sourceId: string;
  sourcePath: string;
  originalName: string;
  classification: Classification;
  proposedJobNumber: string;
  proposedName: string;
  targetLibrary: "Active Projects" | "Completed Projects" | "Bids";
  createdDateTime: string;
}

interface CleanupDuplicate {
  id: string;
  name: string;
  library: string;
  itemId: string;
}

export default function MigrateSharePointPage() {
  const [tab, setTab] = useState<Tab>("migration");
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupDeleting, setCleanupDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [candidates, setCandidates] = useState<MigrationCandidate[]>([]);
  const [duplicates, setDuplicates] = useState<CleanupDuplicate[]>([]);
  const [siteId, setSiteId] = useState("");
  const [driveId, setDriveId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [result, setResult] = useState<{ succeeded: number; failed: number; skipped: number; errors: string[] } | null>(null);
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number; failed: number; errors: string[] } | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, succeeded: 0, failed: 0, skipped: 0 });

  const summary = useMemo(() => {
    return candidates.reduce(
      (acc, candidate) => {
        acc[candidate.classification] += 1;
        return acc;
      },
      { active: 0, completed: 0, bid: 0 }
    );
  }, [candidates]);

  async function handleDiscover() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/migrate-sharepoint");
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Discovery failed.");
      }

      setCandidates(json.candidates ?? []);
      setSiteId(json.siteId ?? "");
      setDriveId(json.driveId ?? "");
    } catch (err) {
      setCandidates([]);
      setError(err instanceof Error ? err.message : "Discovery failed.");
    } finally {
      setLoading(false);
    }
  }

  async function executeMigration() {
    setShowConfirm(false);
    setMigrating(true);
    setError(null);
    setResult(null);

    let offset = 0;
    const batchSize = 25;
    let total = candidates.length;
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    setProgress({ done: 0, total, succeeded: 0, failed: 0, skipped: 0 });

    try {
      while (offset < total) {
        const res = await fetch("/api/admin/migrate-sharepoint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidates, siteId, driveId, offset, batchSize }),
        });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error ?? "Migration failed.");
        }

        offset = json.nextOffset;
        total = json.total;
        succeeded += json.succeeded;
        failed += json.failed;
        skipped += json.skipped;
        errors.push(...(json.errors ?? []));

        setProgress({ done: offset, total, succeeded, failed, skipped });

        if (offset >= total) break;
      }

      setResult({ succeeded, failed, skipped, errors });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Migration failed.");
    } finally {
      setMigrating(false);
    }
  }

  async function handleScanDuplicates() {
    setCleanupLoading(true);
    setCleanupError(null);
    setCleanupResult(null);

    try {
      const res = await fetch("/api/admin/sharepoint-cleanup");
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Duplicate scan failed.");
      }

      setDriveId(json.driveId ?? driveId);
      setDuplicates(json.duplicates ?? []);
    } catch (err) {
      setDuplicates([]);
      setCleanupError(err instanceof Error ? err.message : "Duplicate scan failed.");
    } finally {
      setCleanupLoading(false);
    }
  }

  async function handleDeleteDuplicates() {
    setCleanupDeleting(true);
    setCleanupError(null);
    setCleanupResult(null);

    try {
      const res = await fetch("/api/admin/sharepoint-cleanup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveId, itemIds: duplicates.map((item) => item.itemId) }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Duplicate deletion failed.");
      }

      setCleanupResult(json);
      setDuplicates([]);
    } catch (err) {
      setCleanupError(err instanceof Error ? err.message : "Duplicate deletion failed.");
    } finally {
      setCleanupDeleting(false);
    }
  }

  function badgeClass(classification: Classification) {
    if (classification === "active") return "bg-status-success/10 text-status-success";
    if (classification === "completed") return "bg-surface-overlay text-text-tertiary";
    return "bg-status-info/10 text-status-info";
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-bold text-text-primary">SharePoint Migration Tool</h1>
        <p className="text-sm text-text-secondary">
          Copies existing OneDrive projects to SharePoint. OneDrive files are not modified.
        </p>
      </div>

      <div className="rounded-2xl border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
        This tool requires Sites.ReadWrite.All permission in Azure AD. Ensure admin consent has been granted before running.
      </div>

      <div className="rounded-2xl border border-border-default bg-surface-raised px-4 py-4 text-sm text-text-secondary">
        <p className="font-medium text-text-primary">ℹ️ How this works:</p>
        <p>• Discovers folders from your OneDrive Projects library</p>
        <p>• Creates clean numbered folder structure in SharePoint (01 Contract, 02 Estimate, etc.)</p>
        <p>• Copies entire original OneDrive folder into /99 Archive - Legacy Files/ inside each project</p>
        <p>• Assigns job numbers automatically (YYYY-NNN for projects, QR-YYYY-NNN for bids)</p>
        <p>• Projects are marked &quot;Legacy&quot; - pull important files into clean folders over time</p>
        <p>• Safe to re-run - already-migrated items are skipped automatically</p>
      </div>

      <div className="flex gap-1 border-b border-border-default">
        {(["migration", "cleanup"] as const).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={[
              "border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition",
              tab === value
                ? "border-brand-primary text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            {value === "migration" ? "Migration" : "Cleanup Duplicates"}
          </button>
        ))}
      </div>

      {tab === "migration" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button
              onClick={handleDiscover}
              disabled={loading}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
            >
              {loading ? "Scanning OneDrive..." : "Discover Projects"}
            </button>

            {candidates.length > 0 && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={migrating}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
              >
                Execute Migration
              </button>
            )}

            {candidates.length > 0 && (
              <button
                onClick={handleDiscover}
                disabled={loading || migrating}
                className="text-sm text-brand-primary hover:text-brand-primary"
              >
                Re-scan
              </button>
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-3 rounded-2xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-secondary">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-border-default border-t-brand-primary" />
              Scanning OneDrive...
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-status-danger/40 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
              {error}
            </div>
          )}

          {migrating && (
            <div className="rounded-2xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-secondary">
              Migrating... {progress.done} of {progress.total} - {progress.succeeded} new, {progress.skipped} already done, {progress.failed} errors
            </div>
          )}

          {candidates.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Found {summary.active} active projects, {summary.completed} completed projects, {summary.bid} bids
              </p>

              <div className="overflow-x-auto rounded-2xl border border-border-default bg-surface-raised">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-overlay">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Original Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Source Location</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Classification</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Proposed Job Number</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Proposed SharePoint Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Target Library</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((candidate) => (
                      <tr key={`${candidate.sourceId}-${candidate.proposedJobNumber}`} className="border-b border-border-default last:border-0">
                        <td className="px-4 py-3 text-text-primary">{candidate.originalName}</td>
                        <td className="px-4 py-3 text-text-secondary">{candidate.sourcePath}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass(candidate.classification)}`}>
                            {candidate.classification}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-text-primary">{candidate.proposedJobNumber}</td>
                        <td className="px-4 py-3 text-text-primary">{candidate.proposedName}</td>
                        <td className="px-4 py-3 text-text-secondary">{candidate.targetLibrary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3 rounded-2xl border border-border-default bg-surface-raised px-4 py-4">
              <p className="text-sm text-text-primary">
                Migration complete: {result.succeeded} new, {result.skipped} skipped, {result.failed} failed.
              </p>
              {result.errors.length > 0 && (
                <ul className="space-y-1 text-sm text-status-danger">
                  {result.errors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "cleanup" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button
              onClick={handleScanDuplicates}
              disabled={cleanupLoading}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
            >
              {cleanupLoading ? "Scanning..." : "Scan for Duplicates"}
            </button>

            {duplicates.length > 0 && (
              <button
                onClick={handleDeleteDuplicates}
                disabled={cleanupDeleting}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
              >
                Delete All Duplicates
              </button>
            )}
          </div>

          {cleanupError && (
            <div className="rounded-2xl border border-status-danger/40 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
              {cleanupError}
            </div>
          )}

          {duplicates.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-border-default bg-surface-raised">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-surface-overlay">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Library</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicates.map((duplicate) => (
                    <tr key={duplicate.id} className="border-b border-border-default last:border-0">
                      <td className="px-4 py-3 text-text-primary">{duplicate.name}</td>
                      <td className="px-4 py-3 text-text-secondary">{duplicate.library}</td>
                      <td className="px-4 py-3 text-status-danger">Queued for delete</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {cleanupResult && (
            <div className="space-y-3 rounded-2xl border border-border-default bg-surface-raised px-4 py-4">
              <p className="text-sm text-text-primary">
                Deleted {cleanupResult.deleted} duplicate folders.
              </p>
              {cleanupResult.errors.length > 0 && (
                <ul className="space-y-1 text-sm text-status-danger">
                  {cleanupResult.errors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border-default bg-surface-raised p-6 shadow-xl">
            <h2 className="font-heading text-lg font-semibold text-text-primary">Confirm Migration</h2>
            <p className="mt-2 text-sm text-text-secondary">
              This will create SharePoint folders and copy files. OneDrive is unchanged. Continue?
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-xl border border-border-default px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={executeMigration}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-hover"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

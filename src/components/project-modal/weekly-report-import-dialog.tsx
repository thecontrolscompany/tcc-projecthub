"use client";

import { useState } from "react";

type ParsedWeeklyUpdate = {
  sheetName: string;
  weekOf: string | null;
  pmName: string | null;
  crewLog: Array<{ day: string; men: number; hours: number; activities: string }>;
  materialDelivered: string | null;
  equipmentSet: string | null;
  safetyIncidents: string | null;
  inspectionsTests: string | null;
  totalMen: number;
  totalHours: number;
  alreadyExists: boolean;
  parseError: string | null;
};

type WeeklyReportImportDialogProps = {
  projectId: string;
  onClose: () => void;
};

export function WeeklyReportImportDialog({ projectId, onClose }: WeeklyReportImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedWeeklyUpdate[] | null>(null);
  const [filename, setFilename] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overwriteDates, setOverwriteDates] = useState<Set<string>>(new Set());

  const importableRows = (parsedRows ?? []).filter((row) => row.weekOf && !row.alreadyExists && !row.parseError);
  const overwriteRows = (parsedRows ?? []).filter((row) => row.weekOf && row.alreadyExists && overwriteDates.has(row.weekOf));
  const totalToImport = importableRows.length + overwriteRows.length;

  function toggleOverwrite(weekOf: string) {
    setOverwriteDates((prev) => {
      const next = new Set(prev);
      if (next.has(weekOf)) next.delete(weekOf);
      else next.add(weekOf);
      return next;
    });
  }

  async function handleParse() {
    if (!file) return;

    setParsing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);

      const response = await fetch("/api/admin/parse-weekly-report", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to parse weekly report.");
      }

      setParsedRows((json?.rows as ParsedWeeklyUpdate[]) ?? []);
      setFilename((json?.filename as string) ?? file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse weekly report.");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!parsedRows) return;

    setImporting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/import-weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          rows: parsedRows,
          filename,
          overwriteDates: Array.from(overwriteDates),
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Failed to import weekly reports.");
      }

      if (Array.isArray(json?.errors) && json.errors.length > 0) {
        setError(json.errors.join(" | "));
      }

      setResult({
        imported: typeof json?.imported === "number" ? json.imported : 0,
        skipped: typeof json?.skipped === "number" ? json.skipped : 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import weekly reports.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl border border-border-default bg-surface-base shadow-xl">
        <div className="flex items-start justify-between border-b border-border-default px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Weekly Report Import</p>
            <h3 className="mt-1 text-xl font-bold text-text-primary">Import Excel Reports</h3>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">x</button>
        </div>

        <div className="space-y-4 px-6 py-6">
          {error && (
            <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
              {error}
            </div>
          )}

          {!parsedRows && !result && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Select a Weekly Report file (.xlsx or .xlsm) to import.
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

          {parsedRows && !result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-text-secondary">
                  {importableRows.length} new{overwriteRows.length > 0 ? `, ${overwriteRows.length} overwrite` : ""}
                </p>
                <p className="text-xs text-text-tertiary">{filename}</p>
              </div>

              <div className="max-h-[420px] overflow-auto rounded-2xl border border-border-default">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-raised">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Sheet Name</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Week Of</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Days Active</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Hours</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row) => {
                      const isOverwriteChecked = !!row.weekOf && overwriteDates.has(row.weekOf);
                      const statusCell = row.parseError
                        ? <span className="text-status-danger">⚠ Parse error: {row.parseError}</span>
                        : row.alreadyExists
                          ? (
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isOverwriteChecked}
                                onChange={() => row.weekOf && toggleOverwrite(row.weekOf)}
                                className="h-3.5 w-3.5 rounded accent-brand-primary"
                              />
                              <span className={isOverwriteChecked ? "text-status-warning font-medium" : "text-text-tertiary"}>
                                {isOverwriteChecked ? "Will overwrite" : "Already imported"}
                              </span>
                            </label>
                          )
                          : <span className="text-status-success">New ✓</span>;
                      const rowClass = row.parseError
                        ? "bg-status-danger/5"
                        : isOverwriteChecked
                          ? "bg-status-warning/5"
                          : row.alreadyExists
                            ? "opacity-50"
                            : "bg-status-success/5";

                      return (
                        <tr key={`${row.sheetName}-${row.weekOf ?? "unknown"}`} className={`border-b border-border-default ${rowClass}`}>
                          <td className="px-4 py-2.5 text-text-primary">{row.sheetName}</td>
                          <td className="px-4 py-2.5 text-text-secondary">{row.weekOf ?? "—"}</td>
                          <td className="px-4 py-2.5 text-right text-text-secondary">{row.crewLog.length || "—"}</td>
                          <td className="px-4 py-2.5 text-right text-text-secondary">{row.totalHours || "—"}</td>
                          <td className="px-4 py-2.5">{statusCell}</td>
                        </tr>
                      );
                    })}
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
                  disabled={totalToImport === 0 || importing}
                  className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-50"
                >
                  {importing ? "Importing..." : `Import ${totalToImport} Report${totalToImport !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <p className="text-base font-semibold text-text-primary">Import complete.</p>
              <div className="space-y-2 text-sm text-text-secondary">
                <p>✓ {result.imported} reports imported</p>
                <p>— {result.skipped} already existed or were skipped</p>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
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

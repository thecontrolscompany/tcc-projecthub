"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";

type PreviewRow = {
  project_name_raw: string;
  period_month: string;
  amount: number;
  matched_project_id: string | null;
  matched_project_name: string | null;
  match_confidence: "exact" | "fuzzy" | "none";
};

type ProjectOption = {
  id: string;
  name: string;
};

function buildRowKey(projectNameRaw: string, periodMonth: string) {
  return `${projectNameRaw}__${periodMonth}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function BillingImportPage() {
  const router = useRouter();
  const supabase = createClient();
  const [authChecked, setAuthChecked] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [matchedCount, setMatchedCount] = useState(0);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [totalPeriods, setTotalPeriods] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profile?.role !== "admin") {
        router.replace("/login");
        return;
      }

      setAuthChecked(true);
    }

    void checkAccess();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  const resolvedImportCount = useMemo(
    () =>
      rows.filter((row) => {
        if (row.match_confidence === "exact") return Boolean(row.matched_project_id);
        if (row.match_confidence === "fuzzy") return Boolean(overrides[buildRowKey(row.project_name_raw, row.period_month)] || row.matched_project_id);
        return false;
      }).length,
    [overrides, rows]
  );

  async function handlePreview() {
    if (!file) return;

    setPreviewing(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("action", "preview");
      formData.append("file", file);

      const response = await fetch("/api/admin/billing-import", {
        method: "POST",
        body: formData,
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Preview failed.");
      }

      const previewRows = (json?.rows ?? []) as PreviewRow[];
      setRows(previewRows);
      setProjectOptions(((json?.projects ?? []) as ProjectOption[]).sort((a, b) => a.name.localeCompare(b.name)));
      setMatchedCount(Number(json?.matched_count ?? 0));
      setUnmatchedCount(Number(json?.unmatched_count ?? 0));
      setTotalPeriods(Number(json?.total_periods ?? previewRows.length));

      const nextOverrides: Record<string, string> = {};
      for (const row of previewRows) {
        if (row.match_confidence === "fuzzy") {
          nextOverrides[buildRowKey(row.project_name_raw, row.period_month)] = row.matched_project_id ?? "";
        }
      }
      setOverrides(nextOverrides);
    } catch (previewError) {
      setRows([]);
      setProjectOptions([]);
      setError(previewError instanceof Error ? previewError.message : "Preview failed.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    if (!file || rows.length === 0) return;

    setImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const overrideRows = Object.entries(overrides)
        .filter(([, projectId]) => Boolean(projectId))
        .map(([key, project_id]) => {
          const [project_name_raw, period_month] = key.split("__");
          return { project_name_raw, period_month, project_id };
        });

      const formData = new FormData();
      formData.append("action", "import");
      formData.append("file", file);
      formData.append("overrides", JSON.stringify(overrideRows));

      const response = await fetch("/api/admin/billing-import", {
        method: "POST",
        body: formData,
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Import failed.");
      }

      setSuccess(`Imported ${json.imported ?? 0} periods. Updated prev_billed for ${json.updated_prev_billed_for ?? 0} projects.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
          <p className="text-sm text-text-secondary">Checking admin access...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Historical Billing Import</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-text-primary">Import QuickBooks invoice history</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
          Upload a QuickBooks &quot;Invoice List by Date&quot; Excel export to backfill historical <code>actual_billed</code> values in billing periods.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-xl border border-border-default bg-surface-overlay px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface-base">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            Choose file
          </label>
          <span className="text-sm text-text-secondary">{file?.name ?? "No file selected"}</span>
          <button
            type="button"
            onClick={handlePreview}
            disabled={!file || previewing}
            className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {previewing ? "Previewing..." : "Preview"}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 px-5 py-4 text-sm text-status-danger">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-status-success/30 bg-status-success/10 px-5 py-4 text-sm text-status-success">
          {success}
        </div>
      )}

      {rows.length > 0 && (
        <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Preview</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Summary: {matchedCount} matched · {unmatchedCount} unmatched · {totalPeriods} billing periods
              </p>
            </div>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || resolvedImportCount === 0}
              className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? "Importing..." : `Import ${resolvedImportCount} matched rows`}
            </button>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-border-default">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-overlay">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
                  <th className="px-4 py-3">QBO Name</th>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Matched To</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rowKey = buildRowKey(row.project_name_raw, row.period_month);
                  const selectedProjectId = overrides[rowKey] ?? row.matched_project_id ?? "";

                  return (
                    <tr key={rowKey} className="border-t border-border-default text-text-primary">
                      <td className="px-4 py-3">{row.project_name_raw}</td>
                      <td className="px-4 py-3">{format(new Date(row.period_month), "MMM yyyy")}</td>
                      <td className="px-4 py-3">{formatCurrency(row.amount)}</td>
                      <td className="px-4 py-3">
                        {row.match_confidence === "exact" && (
                          <div className="flex items-center gap-2 text-status-success">
                            <span>✓</span>
                            <span>{row.matched_project_name}</span>
                          </div>
                        )}

                        {row.match_confidence === "fuzzy" && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-status-warning">
                              <span>!</span>
                              <span>{row.matched_project_name}</span>
                            </div>
                            <select
                              value={selectedProjectId}
                              onChange={(event) =>
                                setOverrides((current) => ({
                                  ...current,
                                  [rowKey]: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                            >
                              <option value="">Skip</option>
                              {projectOptions.map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {row.match_confidence === "none" && (
                          <div className="flex items-center gap-2 text-status-danger">
                            <span>x</span>
                            <span>No match - will skip</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

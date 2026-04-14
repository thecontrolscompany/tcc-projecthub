"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import type { LegacyOpportunityImportBatch, LegacyOpportunityImportRow } from "@/types/database";

type ProjectMatchSuggestion = {
  candidateId: string;
  candidateName: string;
  jobNumber: string | null;
  confidenceScore: number;
  reasons: string[];
};

type ReviewRow = LegacyOpportunityImportRow & {
  project_matches: ProjectMatchSuggestion[];
};

export function OpportunityImportReviewWorkspace() {
  const searchParams = useSearchParams();
  const [batches, setBatches] = useState<LegacyOpportunityImportBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState(searchParams.get("batch") ?? "");
  const [selectedBatch, setSelectedBatch] = useState<LegacyOpportunityImportBatch | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [summary, setSummary] = useState({ pending: 0, matched: 0, rejected: 0, noSuggestions: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadRows(selectedBatchId);
  }, [selectedBatchId]);

  async function loadRows(batchId?: string) {
    setLoading(true);
    setError(null);

    try {
      const query = batchId ? `?batch_id=${batchId}` : "";
      const response = await fetch(`/api/opportunities/import/review${query}`, { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Unable to load review queue.");
      }

      setBatches((json.batches ?? []) as LegacyOpportunityImportBatch[]);
      setSelectedBatch((json.selectedBatch ?? null) as LegacyOpportunityImportBatch | null);
      setRows((json.rows ?? []) as ReviewRow[]);
      setSummary(
        json.summary ?? { pending: 0, matched: 0, rejected: 0, noSuggestions: 0 }
      );
      if (!batchId && json.selectedBatch?.id) {
        setSelectedBatchId(json.selectedBatch.id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load review queue.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(
    row: ReviewRow,
    selected_action: "link_project" | "standalone" | "reject",
    selected_project_id?: string
  ) {
    setError(null);

    try {
      const response = await fetch("/api/opportunities/import/review/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          import_row_id: row.id,
          selected_action,
          selected_project_id: selected_project_id ?? null,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error ?? "Unable to save review decision.");
      }

      await loadRows(selectedBatchId);
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Unable to save review decision.");
    }
  }

  return (
    <div className="space-y-6">
      <OpportunityHubSubnav />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Opportunity Hub</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">Import Review Queue</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-secondary">
            Review staged legacy opportunities, inspect likely active-project matches, and decide how each row should move forward.
          </p>
        </div>

        <div className="w-full max-w-xs">
          <label className="mb-1 block text-sm font-medium text-text-secondary">Batch</label>
          <select
            value={selectedBatchId}
            onChange={(event) => setSelectedBatchId(event.target.value)}
            className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
          >
            {batches.length === 0 ? <option value="">No batches</option> : null}
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.source_name} ({batch.row_count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 px-5 py-4 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      {selectedBatch ? (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Rows in batch" value={String(selectedBatch.row_count)} />
          <StatCard label="Batch status" value={selectedBatch.status} />
          <StatCard label="Imported" value={new Date(selectedBatch.imported_at).toLocaleDateString()} />
          <StatCard label="Pending" value={String(summary.pending)} />
          <StatCard label="Matched" value={String(summary.matched)} />
          <StatCard label="No suggestions" value={String(summary.noSuggestions)} />
        </div>
      ) : null}

      <section className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-border-default bg-surface-raised px-5 py-8 text-center text-sm text-text-tertiary">
            Loading review queue...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border-default bg-surface-raised px-5 py-8 text-center text-sm text-text-tertiary">
            No staged rows found for this batch.
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="grid gap-4 rounded-2xl border border-border-default bg-surface-raised p-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Row {row.source_row_number}</p>
                    <h2 className="mt-1 text-lg font-semibold text-text-primary">{row.legacy_opportunity_name ?? "Untitled opportunity"}</h2>
                    <p className="mt-1 text-sm text-text-secondary">
                      {row.company_name ?? "Unknown company"} • {row.project_location ?? "No location"}
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-overlay px-3 py-1 text-xs font-medium text-text-secondary">
                    {row.review_status}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <InfoCard label="Job number" value={row.job_number ?? "-"} />
                  <InfoCard label="Amount" value={formatCurrency(row.amount)} />
                  <InfoCard label="Bid date" value={row.bid_date ?? "-"} />
                  <InfoCard label="Proposal date" value={row.proposal_date ?? "-"} />
                </div>

                <div className="rounded-xl border border-border-default bg-surface-base p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Validation issues</p>
                  <p className="mt-2 text-sm text-text-secondary">
                    {row.validation_issues.length ? row.validation_issues.join(", ") : "No validation issues detected"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-border-default bg-surface-base p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Suggested active project matches</p>
                  <div className="mt-3 space-y-3">
                    {row.project_matches.length === 0 ? (
                      <p className="text-sm text-text-secondary">No strong project suggestions yet.</p>
                    ) : (
                      row.project_matches.map((match) => (
                        <div key={match.candidateId} className="rounded-xl border border-border-default bg-surface-raised p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-medium text-text-primary">{match.candidateName}</p>
                              <p className="mt-1 text-sm text-text-secondary">
                                {match.jobNumber ? `Job ${match.jobNumber}` : "No job number"}
                              </p>
                            </div>
                            <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">
                              {match.confidenceScore.toFixed(0)}
                            </span>
                          </div>

                          <p className="mt-2 text-xs text-text-tertiary">{match.reasons.join(" • ") || "General name similarity"}</p>

                          <button
                            type="button"
                            onClick={() => void handleDecision(row, "link_project", match.candidateId)}
                            className="mt-4 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-text-inverse transition hover:bg-brand-hover"
                          >
                            Link to this project
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleDecision(row, "standalone")}
                    className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
                  >
                    Keep Standalone
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDecision(row, "reject")}
                    className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm font-medium text-status-danger transition hover:bg-status-danger/20"
                  >
                    Reject Row
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-base p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-2 text-sm text-text-primary">{value}</p>
    </div>
  );
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

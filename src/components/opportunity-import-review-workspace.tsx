"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import type {
  LegacyOpportunityImportBatch,
  LegacyOpportunityImportRow,
  OpportunityDocument,
  OpportunityEstimateSummary,
  OpportunityEquipmentGroup,
  OpportunityPricingItem,
  OpportunityScopeItem,
} from "@/types/database";
import { safeJson } from "@/lib/utils/safe-json";

type ProjectMatchSuggestion = {
  candidateId: string;
  candidateName: string;
  jobNumber: string | null;
  confidenceScore: number;
  reasons: string[];
};

type ReviewRow = LegacyOpportunityImportRow & {
  project_matches: ProjectMatchSuggestion[];
  documents: OpportunityDocument[];
  pricing_items: OpportunityPricingItem[];
  scope_items: OpportunityScopeItem[];
  equipment_groups: OpportunityEquipmentGroup[];
  estimate_summary: OpportunityEstimateSummary | null;
};

export function OpportunityImportReviewWorkspace() {
  const searchParams = useSearchParams();
  const [batches, setBatches] = useState<LegacyOpportunityImportBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState(searchParams.get("batch") ?? "");
  const [selectedBatch, setSelectedBatch] = useState<LegacyOpportunityImportBatch | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [summary, setSummary] = useState({ pending: 0, matched: 0, rejected: 0, noSuggestions: 0 });
  const [processedCount, setProcessedCount] = useState(0);
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
      const json = await safeJson(response);

      if (!response.ok) {
        throw new Error(json?.error ?? "Unable to load review queue.");
      }

      setBatches((json.batches ?? []) as LegacyOpportunityImportBatch[]);
      setSelectedBatch((json.selectedBatch ?? null) as LegacyOpportunityImportBatch | null);
      setRows((json.rows ?? []) as ReviewRow[]);
      setSummary(json.summary ?? { pending: 0, matched: 0, rejected: 0, noSuggestions: 0 });
      setProcessedCount(json.processedCount ?? 0);
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
    selected_id?: string
  ) {
    setError(null);

    try {
      const response = await fetch("/api/opportunities/import/review/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          import_row_id: row.id,
          selected_action,
          selected_project_id: selected_action === "link_project" ? (selected_id ?? null) : null,
        }),
      });
      const json = await safeJson(response);

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
            Review staged legacy opportunities, upload the proposal and estimate package, inspect extracted data, and decide how each row should move forward.
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
            {processedCount > 0
              ? `All ${processedCount} row${processedCount !== 1 ? "s" : ""} in this batch have been processed.`
              : "No staged rows found for this batch."}
          </div>
        ) : (
          rows.map((row) => (
            <ReviewRowCard
              key={row.id}
              row={row}
              onDecision={handleDecision}
              onRefresh={() => void loadRows(selectedBatchId)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function ReviewRowCard({
  row,
  onDecision,
  onRefresh,
}: {
  row: ReviewRow;
  onDecision: (row: ReviewRow, action: "link_project" | "standalone" | "reject", projectId?: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyDraft, setCompanyDraft] = useState(row.company_name ?? "");
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  async function handleSaveCompany() {
    if (!companyDraft.trim()) return;
    setSavingCompany(true);
    setCompanyError(null);

    try {
      const response = await fetch(`/api/opportunities/import/rows/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyDraft.trim() }),
      });
      const json = await safeJson(response);
      if (!response.ok) throw new Error(json?.error ?? "Unable to save.");
      setEditingCompany(false);
      onRefresh();
    } catch (err) {
      setCompanyError(err instanceof Error ? err.message : "Unable to save.");
    } finally {
      setSavingCompany(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border-default bg-surface-raised p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                Row {row.source_row_number} - Pursuit
              </p>
              <h2 className="mt-1 text-lg font-semibold text-text-primary">
                {row.legacy_opportunity_name ?? "Untitled opportunity"}
              </h2>

              <div className="mt-2">
                {editingCompany ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={companyDraft}
                      onChange={(e) => setCompanyDraft(e.target.value)}
                      className="rounded-lg border border-brand-primary bg-surface-overlay px-2 py-1 text-sm text-text-primary focus:outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleSaveCompany();
                        if (e.key === "Escape") setEditingCompany(false);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveCompany()}
                      disabled={savingCompany}
                      className="rounded-lg bg-brand-primary px-2 py-1 text-xs font-semibold text-text-inverse disabled:opacity-60"
                    >
                      {savingCompany ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCompany(false);
                        setCompanyDraft(row.company_name ?? "");
                      }}
                      className="rounded-lg border border-border-default px-2 py-1 text-xs text-text-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setCompanyDraft(row.company_name ?? "");
                      setEditingCompany(true);
                    }}
                    className="group flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
                    title="Click to edit customer name"
                  >
                    <span className="font-medium">{row.company_name ?? "Unknown company"}</span>
                    <span className="text-xs text-text-tertiary opacity-0 transition group-hover:opacity-100">Edit</span>
                  </button>
                )}
                {companyError ? <p className="mt-1 text-xs text-status-danger">{companyError}</p> : null}
              </div>

              <p className="mt-1 text-sm text-text-tertiary">{row.project_location ?? "No location"}</p>
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

          {row.sharepoint_folder ? (
            <div className="rounded-xl border border-border-default bg-surface-base p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">SharePoint folder</p>
              <p className="mt-2 text-sm text-text-primary">{row.sharepoint_folder}</p>
            </div>
          ) : null}
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

                    <p className="mt-2 text-xs text-text-tertiary">{match.reasons.join(" | ") || "General name similarity"}</p>

                    <button
                      type="button"
                      onClick={() => void onDecision(row, "link_project", match.candidateId)}
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
              onClick={() => void onDecision(row, "standalone")}
              className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
            >
              Keep Standalone
            </button>
            <button
              type="button"
              onClick={() => void onDecision(row, "reject")}
              className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm font-medium text-status-danger transition hover:bg-status-danger/20"
            >
              Reject Row
            </button>
          </div>
        </div>
      </div>

      <LegacyDocumentPackageCard row={row} onUploaded={onRefresh} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ExtractionList
          title="Pricing rows"
          emptyText="No pricing items extracted yet."
          items={row.pricing_items.map((item) => `${item.label} - ${formatCurrency(item.amount)}`)}
        />
        <ExtractionList
          title="Scope"
          emptyText="No equipment groups extracted yet."
          items={row.equipment_groups.map((item) =>
            `${item.quantity ? `(${item.quantity}) ` : ""}${item.system_label}${item.tag_text ? ` | Tag: ${item.tag_text}` : ""}`
          )}
        />
        <EstimateSummaryCard summary={row.estimate_summary} />
      </div>
    </div>
  );
}

function LegacyDocumentPackageCard({ row, onUploaded }: { row: ReviewRow; onUploaded: () => void }) {
  const [proposalDocx, setProposalDocx] = useState<File | null>(null);
  const [proposalPdf, setProposalPdf] = useState<File | null>(null);
  const [estimateWorkbook, setEstimateWorkbook] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!proposalDocx && !proposalPdf && !estimateWorkbook) {
      setError("Select at least one document to upload.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("importRowId", row.id);
      if (proposalDocx) formData.set("proposalDocx", proposalDocx);
      if (proposalPdf) formData.set("proposalPdf", proposalPdf);
      if (estimateWorkbook) formData.set("estimateWorkbook", estimateWorkbook);

      const response = await fetch("/api/opportunities/import/documents", {
        method: "POST",
        body: formData,
      });
      const json = await safeJson(response);

      if (!response.ok) {
        throw new Error(json?.error ?? "Unable to upload legacy document package.");
      }

      setProposalDocx(null);
      setProposalPdf(null);
      setEstimateWorkbook(null);
      onUploaded();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload legacy document package.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border-default bg-surface-base p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Legacy document package</p>
          <p className="mt-2 text-sm text-text-secondary">
            Upload the proposal `.docx`, proposal `.pdf`, and estimate `.xlsm`. The files are stored in the bid folder structure from the roadmap, and the extracted pricing/scope/summary data is written back into Opportunity Hub.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={saving}
          className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-60"
        >
          {saving ? "Uploading..." : "Upload package"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <FileField label="Proposal DOCX" accept=".docx" file={proposalDocx} onChange={setProposalDocx} />
        <FileField label="Proposal PDF" accept=".pdf" file={proposalPdf} onChange={setProposalPdf} />
        <FileField label="Estimate XLSM" accept=".xlsm" file={estimateWorkbook} onChange={setEstimateWorkbook} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <DocumentStatusCard
          title="Proposal DOCX"
          document={row.documents.find((item) => item.document_role === "proposal_docx") ?? null}
        />
        <DocumentStatusCard
          title="Proposal PDF"
          document={row.documents.find((item) => item.document_role === "proposal_pdf") ?? null}
        />
        <DocumentStatusCard
          title="Estimate XLSM"
          document={row.documents.find((item) => item.document_role === "estimate_xlsm") ?? null}
        />
      </div>
    </div>
  );
}

function FileField({
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
    <label className="block rounded-xl border border-border-default bg-surface-raised p-4">
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

function DocumentStatusCard({ title, document }: { title: string; document: OpportunityDocument | null }) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{title}</p>
      {document ? (
        <>
          <p className="mt-2 text-sm font-medium text-text-primary">{document.file_name}</p>
          <p className="mt-1 text-xs text-text-secondary">
            {document.storage_path ?? "Stored"} | {document.extraction_status}
          </p>
          {document.storage_web_url ? (
            <a href={document.storage_web_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-medium text-brand-primary hover:text-brand-hover">
              Open in SharePoint
            </a>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-text-secondary">Not uploaded yet.</p>
      )}
    </div>
  );
}

function ExtractionList({ title, items, emptyText }: { title: string; items: string[]; emptyText: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-base p-4">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-text-secondary">{emptyText}</p>
        ) : (
          items.slice(0, 8).map((item, index) => (
            <p key={`${title}-${index}`} className="text-sm text-text-secondary">
              {item}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

function EstimateSummaryCard({ summary }: { summary: OpportunityEstimateSummary | null }) {
  if (!summary) {
    return (
      <div className="rounded-2xl border border-border-default bg-surface-base p-4">
        <p className="text-sm font-semibold text-text-primary">Estimate summary</p>
        <p className="mt-3 text-sm text-text-secondary">No estimate workbook summary extracted yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-default bg-surface-base p-4">
      <p className="text-sm font-semibold text-text-primary">Estimate summary</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <InfoCard label="Labor hours" value={formatNumber(summary.labor_hours_total)} />
        <InfoCard label="Labor cost" value={formatCurrency(summary.labor_cost_total)} />
        <InfoCard label="Material cost" value={formatCurrency(summary.material_cost_total)} />
        <InfoCard label="Base bid" value={formatCurrency(summary.base_bid_amount)} />
        <InfoCard label="Bond" value={formatCurrency(summary.bond_amount)} />
        <InfoCard
          label="Total cost"
          value={formatCurrency(
            summary.base_bid_amount !== null
              ? (summary.base_bid_amount ?? 0) + (summary.bond_amount ?? 0)
              : null
          )}
        />
      </div>
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

function formatNumber(value: number | null) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

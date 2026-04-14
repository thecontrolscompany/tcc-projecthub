"use client";

import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import {
  deriveOpportunityStage,
  getOpportunityAmount,
  getOpportunityLabel,
  getOpportunityLocation,
  OPPORTUNITY_STAGE_BADGES,
  OPPORTUNITY_STAGE_LABELS,
} from "@/lib/opportunities";
import type { QuoteRequest, QuoteRequestStatus } from "@/types/database";
import { QuoteRequestConvertModal } from "@/components/quote-request-convert-modal";
import { safeJson } from "@/lib/utils/safe-json";

const inputClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const textareaClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

export function OpportunityDetailClient({ initialQuote }: { initialQuote: QuoteRequest }) {
  const [quote, setQuote] = useState(initialQuote);
  const [draftStatus, setDraftStatus] = useState<QuoteRequestStatus>(quote.status);
  const [draftNotes, setDraftNotes] = useState(quote.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);

  const stage = deriveOpportunityStage(quote);
  const location = getOpportunityLocation(quote);
  const amount = getOpportunityAmount(quote);

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/quotes/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: quote.id,
          status: draftStatus,
          notes: draftNotes,
          project_id: quote.project_id,
        }),
      });
      const json = await safeJson(response);

      if (!response.ok) {
        throw new Error(json?.error ?? "Unable to update opportunity.");
      }

      setQuote(json as QuoteRequest);
      setDraftStatus((json as QuoteRequest).status);
      setDraftNotes((json as QuoteRequest).notes ?? "");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update opportunity.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <OpportunityHubSubnav />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/quotes" className="text-sm text-text-secondary hover:text-text-primary">
            {"<-"} Back to Opportunity Hub
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Opportunity Hub</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">{getOpportunityLabel(quote)}</h1>
          <p className="mt-2 text-sm text-text-secondary">
            {quote.company_name} | Ref {quote.opportunity_number ?? quote.id.slice(0, 8)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${OPPORTUNITY_STAGE_BADGES[stage]}`}>
            {OPPORTUNITY_STAGE_LABELS[stage]}
          </span>
          {quote.project_id ? (
            <span className="inline-flex rounded-full bg-status-success/10 px-3 py-1.5 text-sm font-semibold text-status-success">
              Converted to project
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Current amount" value={formatCurrency(amount)} />
        <MetricCard label="Created" value={format(new Date(quote.created_at), "MMM d, yyyy")} />
        <MetricCard label="Last updated" value={format(new Date(quote.updated_at), "MMM d, yyyy")} />
        <MetricCard label="Project status" value={quote.project?.job_number ? `Project ${quote.project.job_number}` : "Not converted"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <section className="space-y-6 rounded-2xl border border-border-default bg-surface-raised p-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Opportunity Summary</h2>
            <p className="mt-1 text-sm text-text-secondary">
              The workspace is live on the current quote record, with schema-ready slots for the richer Opportunity Hub model once migration `045` is run.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ReadonlyField label="Customer" value={quote.company_name} />
            <ReadonlyField label="Contact" value={quote.contact_name} />
            <ReadonlyField label="Email" value={quote.contact_email} />
            <ReadonlyField label="Phone" value={quote.contact_phone ?? "-"} />
            <ReadonlyField label="Location" value={location ?? "-"} />
            <ReadonlyField label="Estimated value" value={formatCurrency(quote.estimated_value)} />
            <ReadonlyField label="Bid date" value={quote.bid_date ? format(new Date(quote.bid_date), "MMM d, yyyy") : "Not set yet"} />
            <ReadonlyField label="Proposal date" value={quote.proposal_date ? format(new Date(quote.proposal_date), "MMM d, yyyy") : "Not set yet"} />
          </div>

          <ReadonlyField label="Project Description" value={quote.project_description} multiline />

          <div className="grid gap-4 md:grid-cols-3">
            <StatusPanel
              title="Pursuit matching"
              value={quote.pursuit?.project_name ?? "Pending migration"}
              caption={quote.pursuit_id ? "Attached to a shared pursuit" : "Ready for pursuit attach/create flow"}
            />
            <StatusPanel
              title="Active project link"
              value={quote.project?.name ?? "Not linked"}
              caption={quote.project_id ? "Converted into a project" : "Legacy matching will use linked_project_id later"}
            />
            <StatusPanel
              title="Documents"
              value={quote.sharepoint_folder ? "Connected" : "Not connected"}
              caption={quote.sharepoint_folder ?? "SharePoint hooks are planned for the next slices"}
            />
          </div>
        </section>

        <section className="space-y-6 rounded-2xl border border-border-default bg-surface-raised p-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Workflow</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Update the live quote workflow now. Richer opportunity fields will slot into this same detail view once the schema is applied.
            </p>
          </div>

          {error ? (
            <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
              {error}
            </div>
          ) : null}

          <Field label="Status">
            <select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as QuoteRequestStatus)} className={inputClassName}>
              <option value="new">new</option>
              <option value="reviewing">reviewing</option>
              <option value="quoted">quoted</option>
              <option value="won">won</option>
              <option value="lost">lost</option>
            </select>
          </Field>

          <Field label="Internal notes">
            <textarea rows={8} value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} className={textareaClassName} />
          </Field>

          {quote.project?.name ? (
            <div className="rounded-xl border border-status-success/20 bg-status-success/5 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-status-success">Linked Project</p>
              <p className="mt-1 text-sm text-text-primary">{quote.project.name}</p>
              {quote.project.job_number ? (
                <p className="mt-1 text-xs text-text-secondary">Job number {quote.project.job_number}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <button onClick={() => void handleSave()} disabled={saving} className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-60">
              {saving ? "Saving..." : "Save Workflow Changes"}
            </button>

            {draftStatus === "won" && !quote.project_id ? (
              <button type="button" onClick={() => setShowConvertModal(true)} className="rounded-xl bg-status-success px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:opacity-90">
                Convert to Project
              </button>
            ) : null}
          </div>

          <div className="rounded-2xl border border-border-default bg-surface-base p-4">
            <p className="text-sm font-semibold text-text-primary">Next slices already planned</p>
            <ul className="mt-3 space-y-2 text-sm text-text-secondary">
              <li>Legacy opportunity import staging and review queue</li>
              <li>Project and pursuit matching for historical opportunities</li>
              <li>Deeper pricing, proposal, and estimate handoff fields</li>
            </ul>
          </div>
        </section>
      </div>

      {showConvertModal ? (
        <QuoteRequestConvertModal
          quote={quote}
          onClose={() => setShowConvertModal(false)}
          onConverted={(projectId, projectName, jobNumber) => {
            setShowConvertModal(false);
            setQuote((current) => ({
              ...current,
              project_id: projectId,
              project: { name: projectName, job_number: jobNumber },
            }));
          }}
        />
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-2 text-xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function StatusPanel({ title, value, caption }: { title: string; value: string; caption: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-base p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{title}</p>
      <p className="mt-2 text-sm font-medium text-text-primary">{value}</p>
      <p className="mt-2 text-xs text-text-secondary">{caption}</p>
    </div>
  );
}

function ReadonlyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-tertiary">{label}</p>
      <div className={`rounded-xl border border-border-default bg-surface-base px-4 py-3 text-sm text-text-primary ${multiline ? "whitespace-pre-wrap" : ""}`}>
        {value}
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

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

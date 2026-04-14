"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  deriveOpportunityStage,
  getOpportunityAmount,
  getOpportunityLabel,
  getOpportunityLocation,
  getOpportunityProjectName,
  isOpportunityLinked,
  OPPORTUNITY_STAGE_BADGES,
  OPPORTUNITY_STAGE_LABELS,
} from "@/lib/opportunities";
import type { OpportunityStage, QuoteRequest } from "@/types/database";

type QuotesPageClientProps =
  | { mode: "public" }
  | { mode: "admin"; initialQuotes: QuoteRequest[] };

type QuoteFormState = {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  project_description: string;
  site_address: string;
  estimated_value: string;
};

const EMPTY_FORM: QuoteFormState = {
  company_name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  project_description: "",
  site_address: "",
  estimated_value: "",
};

const inputClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const textareaClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const STAGE_FILTERS: Array<{ value: "all" | OpportunityStage; label: string }> = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "under_review", label: "Under review" },
  { value: "submitted", label: "Submitted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export function QuotesPageClient(props: QuotesPageClientProps) {
  if (props.mode === "admin") {
    return <AdminQuotesView initialQuotes={props.initialQuotes} />;
  }

  return <PublicQuoteForm />;
}

function PublicQuoteForm() {
  const [form, setForm] = useState<QuoteFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSubmittedId(null);

    try {
      const res = await fetch("/api/quotes/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          estimated_value: form.estimated_value.trim() ? Number(form.estimated_value) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Unable to submit quote request.");
      }

      setSubmittedId(json.id ?? null);
      setForm(EMPTY_FORM);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit quote request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Opportunity Hub</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Request a Quote</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Tell us about your upcoming project and our team will review it and follow up.
        </p>
      </div>

      {submittedId ? (
        <div className="rounded-2xl border border-status-success/30 bg-status-success/10 px-5 py-4 text-sm text-status-success">
          Quote request submitted successfully. Reference ID: {submittedId}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 px-5 py-4 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-border-default bg-surface-raised p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Company Name *">
            <input value={form.company_name} onChange={(e) => setForm((current) => ({ ...current, company_name: e.target.value }))} className={inputClassName} />
          </Field>
          <Field label="Contact Name *">
            <input value={form.contact_name} onChange={(e) => setForm((current) => ({ ...current, contact_name: e.target.value }))} className={inputClassName} />
          </Field>
          <Field label="Contact Email *">
            <input type="email" value={form.contact_email} onChange={(e) => setForm((current) => ({ ...current, contact_email: e.target.value }))} className={inputClassName} />
          </Field>
          <Field label="Contact Phone">
            <input value={form.contact_phone} onChange={(e) => setForm((current) => ({ ...current, contact_phone: e.target.value }))} className={inputClassName} />
          </Field>
          <Field label="Site Address">
            <input value={form.site_address} onChange={(e) => setForm((current) => ({ ...current, site_address: e.target.value }))} className={inputClassName} />
          </Field>
          <Field label="Estimated Value">
            <input type="number" min="0" step="0.01" value={form.estimated_value} onChange={(e) => setForm((current) => ({ ...current, estimated_value: e.target.value }))} className={inputClassName} />
          </Field>
        </div>

        <Field label="Project Description *">
          <textarea rows={5} value={form.project_description} onChange={(e) => setForm((current) => ({ ...current, project_description: e.target.value }))} className={textareaClassName} />
        </Field>

        <button type="submit" disabled={saving} className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-60">
          {saving ? "Submitting..." : "Submit Quote Request"}
        </button>
      </form>
    </div>
  );
}

function AdminQuotesView({ initialQuotes }: { initialQuotes: QuoteRequest[] }) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | OpportunityStage>("all");

  const metrics = useMemo(() => {
    const total = initialQuotes.length;
    const active = initialQuotes.filter((quote) => !["won", "lost"].includes(deriveOpportunityStage(quote))).length;
    const won = initialQuotes.filter((quote) => deriveOpportunityStage(quote) === "won").length;
    const linked = initialQuotes.filter((quote) => isOpportunityLinked(quote)).length;
    return { total, active, won, linked };
  }, [initialQuotes]);

  const filteredQuotes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return initialQuotes.filter((quote) => {
      const stage = deriveOpportunityStage(quote);
      const matchesStage = stageFilter === "all" || stage === stageFilter;
      const haystack = [
        quote.company_name,
        quote.contact_name,
        quote.contact_email,
        quote.project_description,
        quote.project_name,
        getOpportunityLocation(quote),
        getOpportunityProjectName(quote),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
      return matchesStage && matchesSearch;
    });
  }, [initialQuotes, search, stageFilter]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Opportunity Hub</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Pipeline Workspace</h1>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          This is the internal bid pipeline foundation. It keeps the current quote intake live while giving us a more deliberate opportunity view ahead of pursuit matching, legacy import, and estimate handoff work.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total opportunities" value={String(metrics.total)} accent="text-brand-primary" />
        <MetricCard label="Active pipeline" value={String(metrics.active)} accent="text-status-info" />
        <MetricCard label="Won" value={String(metrics.won)} accent="text-status-success" />
        <MetricCard label="Linked to project" value={String(metrics.linked)} accent="text-status-warning" />
      </div>

      <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Search opportunities</label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Company, contact, project, location..."
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-secondary">Stage</label>
            <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as "all" | OpportunityStage)} className={inputClassName}>
              {STAGE_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-overlay/70">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Opportunity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Stage</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Project Link</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Updated</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((quote) => {
                const stage = deriveOpportunityStage(quote);
                const linkedProjectName = getOpportunityProjectName(quote);

                return (
                  <tr key={quote.id} className="border-b border-border-default last:border-b-0 hover:bg-surface-overlay/40">
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1">
                        <p className="font-medium text-text-primary">{getOpportunityLabel(quote)}</p>
                        <p className="text-xs text-text-tertiary">Ref {quote.opportunity_number ?? quote.id.slice(0, 8)}</p>
                        {getOpportunityLocation(quote) ? (
                          <p className="text-xs text-text-secondary">{getOpportunityLocation(quote)}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1">
                        <p className="text-text-primary">{quote.company_name}</p>
                        <p className="text-xs text-text-secondary">{quote.contact_name}</p>
                        <p className="text-xs text-text-tertiary">{quote.contact_email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${OPPORTUNITY_STAGE_BADGES[stage]}`}>
                        {OPPORTUNITY_STAGE_LABELS[stage]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right align-top text-text-primary">
                      {formatCurrency(getOpportunityAmount(quote))}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {linkedProjectName ? (
                        <div className="space-y-1">
                          <p className="text-text-primary">{linkedProjectName}</p>
                          <p className="text-xs text-status-success">Linked</p>
                        </div>
                      ) : (
                        <span className="text-text-tertiary">Not linked yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-text-secondary">
                      {format(new Date(quote.updated_at), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <Link
                        href={`/quotes/${quote.id}`}
                        className="inline-flex rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-text-tertiary">
                    No opportunities match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent}`}>{value}</p>
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

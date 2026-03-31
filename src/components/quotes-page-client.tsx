"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import type { QuoteRequest, QuoteRequestStatus } from "@/types/database";

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

const STATUS_BADGES: Record<QuoteRequestStatus, string> = {
  new: "bg-status-warning/10 text-status-warning",
  reviewing: "bg-status-info/10 text-status-info",
  quoted: "bg-brand-primary/10 text-brand-primary",
  won: "bg-status-success/10 text-status-success",
  lost: "bg-surface-overlay text-text-secondary",
};

const inputClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const textareaClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Quote Requests</p>
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
  const [quotes, setQuotes] = useState(initialQuotes);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<QuoteRequestStatus>("new");
  const [draftNotes, setDraftNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedQuote = useMemo(() => quotes.find((quote) => quote.id === selectedQuoteId) ?? null, [quotes, selectedQuoteId]);

  function openQuote(quote: QuoteRequest) {
    setSelectedQuoteId(quote.id);
    setDraftStatus(quote.status);
    setDraftNotes(quote.notes ?? "");
    setError(null);
  }

  async function handleSave() {
    if (!selectedQuote) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/quotes/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedQuote.id,
          status: draftStatus,
          notes: draftNotes,
          project_id: selectedQuote.project_id,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "Unable to update quote request.");
      }

      setQuotes((current) => current.map((quote) => (quote.id === json.id ? json as QuoteRequest : quote)));
      setSelectedQuoteId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update quote request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Quote Requests</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Quote Management</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Review incoming quote requests, update workflow status, and track wins and losses.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border-default">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default bg-surface-raised/80">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Date</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Company</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Contact</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Email</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Estimated Value</th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-text-secondary">Status</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr key={quote.id} className="border-b border-border-default hover:bg-surface-raised">
                <td className="px-4 py-2.5 text-text-secondary">{format(new Date(quote.created_at), "MMM d, yyyy")}</td>
                <td className="px-4 py-2.5 font-medium text-text-primary">{quote.company_name}</td>
                <td className="px-4 py-2.5 text-text-secondary">{quote.contact_name}</td>
                <td className="px-4 py-2.5 text-text-secondary">{quote.contact_email}</td>
                <td className="px-4 py-2.5 text-right text-text-secondary">{formatCurrency(quote.estimated_value)}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGES[quote.status]}`}>
                    {quote.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => openQuote(quote)} className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-raised hover:text-text-primary">
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {quotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-tertiary">
                  No quote requests submitted yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selectedQuote ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
          <div className="flex h-full w-full max-w-2xl flex-col border-l border-border-default bg-surface-base shadow-2xl">
            <div className="flex items-start justify-between border-b border-border-default px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Quote Request</p>
                <h2 className="mt-1 text-xl font-bold text-text-primary">{selectedQuote.company_name}</h2>
                <p className="mt-1 text-sm text-text-secondary">{selectedQuote.contact_name} • {selectedQuote.contact_email}</p>
              </div>
              <button onClick={() => setSelectedQuoteId(null)} className="text-text-secondary hover:text-text-primary">x</button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              {error ? (
                <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
                  {error}
                </div>
              ) : null}

              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Submitted Details</h3>
                <ReadonlyField label="Company" value={selectedQuote.company_name} />
                <ReadonlyField label="Contact" value={selectedQuote.contact_name} />
                <ReadonlyField label="Email" value={selectedQuote.contact_email} />
                <ReadonlyField label="Phone" value={selectedQuote.contact_phone ?? "-"} />
                <ReadonlyField label="Site Address" value={selectedQuote.site_address ?? "-"} />
                <ReadonlyField label="Estimated Value" value={formatCurrency(selectedQuote.estimated_value)} />
                <ReadonlyField label="Project Description" value={selectedQuote.project_description} multiline />
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Workflow</h3>
                <Field label="Status">
                  <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value as QuoteRequestStatus)} className={inputClassName}>
                    <option value="new">new</option>
                    <option value="reviewing">reviewing</option>
                    <option value="quoted">quoted</option>
                    <option value="won">won</option>
                    <option value="lost">lost</option>
                  </select>
                </Field>
                <Field label="Notes">
                  <textarea rows={6} value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} className={textareaClassName} />
                </Field>
                {draftStatus === "won" ? (
                  <button type="button" disabled title="Coming soon" className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-medium text-text-tertiary opacity-70">
                    Convert to Project
                  </button>
                ) : null}
              </section>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border-default px-6 py-4">
              <button onClick={() => setSelectedQuoteId(null)} className="rounded-xl bg-surface-overlay px-4 py-2 text-sm text-text-secondary hover:bg-surface-overlay">
                Cancel
              </button>
              <button onClick={() => void handleSave()} disabled={saving} className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-brand-hover disabled:opacity-60">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReadonlyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-tertiary">{label}</p>
      <div className={`rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-primary ${multiline ? "whitespace-pre-wrap" : ""}`}>
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

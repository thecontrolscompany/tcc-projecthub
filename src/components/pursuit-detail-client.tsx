"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import { safeJson } from "@/lib/utils/safe-json";

const inputClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const textareaClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

type PursuitQuoteRequest = {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  project_description: string;
  site_address: string | null;
  estimated_value: number | null;
  bid_date: string | null;
  proposal_date: string | null;
  opportunity_number: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

type PursuitDetail = {
  id: string;
  project_name: string;
  owner_name: string | null;
  project_location: string | null;
  status: "active" | "lost" | "awarded" | "archived";
  created_at: string;
  onedrive_item_id: string | null;
  sharepoint_folder: string | null;
  sharepoint_item_id: string | null;
  linked_project_id: string | null;
  quote_requests: PursuitQuoteRequest[];
};

type DraftState = {
  project_name: string;
  owner_name: string;
  project_location: string;
  status: "active" | "lost" | "awarded" | "archived";
  estimated_value: string;
  bid_date: string;
  proposal_date: string;
  notes: string;
};

export function PursuitDetailClient({ pursuitId }: { pursuitId: string }) {
  const [pursuit, setPursuit] = useState<PursuitDetail | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const primaryQuoteRequest = useMemo(() => pursuit?.quote_requests?.[0] ?? null, [pursuit]);

  useEffect(() => {
    void loadPursuit();
  }, [pursuitId]);

  async function loadPursuit() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/opportunities/pursuits/${pursuitId}`, { cache: "no-store" });
      const json = await safeJson(response);
      if (!response.ok) throw new Error(json?.error ?? "Unable to load pursuit.");

      const nextPursuit = json?.pursuit as PursuitDetail;
      setPursuit(nextPursuit);
      setDraft(buildDraft(nextPursuit));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load pursuit.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!draft) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/opportunities/pursuits/${pursuitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: draft.project_name.trim(),
          owner_name: draft.owner_name.trim() || null,
          project_location: draft.project_location.trim() || null,
          status: draft.status,
          quote_request: {
            estimated_value: draft.estimated_value.trim() ? Number(draft.estimated_value) : null,
            bid_date: draft.bid_date || null,
            proposal_date: draft.proposal_date || null,
            notes: draft.notes.trim() || null,
          },
        }),
      });
      const json = await safeJson(response);
      if (!response.ok) throw new Error(json?.error ?? "Unable to save pursuit.");

      setMessage("Saved.");
      await loadPursuit();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save pursuit.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEnrich() {
    setEnriching(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/opportunities/import/mass/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pursuit_ids: [pursuitId] }),
      });
      const json = await safeJson(response);
      if (!response.ok) throw new Error(json?.error ?? "Enrichment failed.");

      setMessage(
        `${json?.enriched ?? 0} enriched, ${json?.no_folder ?? 0} unmatched, ${json?.no_file ?? 0} no docs, ${json?.errors ?? 0} errors`
      );
      await loadPursuit();
    } catch (enrichError) {
      setError(enrichError instanceof Error ? enrichError.message : "Enrichment failed.");
    } finally {
      setEnriching(false);
    }
  }

  if (loading || !draft || !pursuit) {
    return (
      <div className="space-y-6">
        <OpportunityHubSubnav />
        <div className="rounded-2xl border border-border-default bg-surface-raised px-6 py-10 text-center text-sm text-text-tertiary">
          Loading pursuit...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OpportunityHubSubnav />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/quotes/pursuits" className="text-sm text-text-secondary hover:text-text-primary">
            {"<-"} Back to Pursuits
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Opportunity Hub</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">{pursuit.project_name}</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Created {new Date(pursuit.created_at).toLocaleDateString()}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {pursuit.sharepoint_folder ? (
            <a
              href={sharePointUrl(pursuit.sharepoint_folder)}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-border-default bg-surface-base px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-overlay"
            >
              Open SharePoint folder
            </a>
          ) : null}
          {pursuit.onedrive_item_id && !pursuit.owner_name ? (
            <button
              type="button"
              onClick={() => void handleEnrich()}
              disabled={enriching}
              className="rounded-xl border border-border-default bg-surface-base px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-overlay disabled:opacity-60"
            >
              {enriching ? "Enriching..." : "Enrich from OneDrive"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 px-5 py-4 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-status-success/30 bg-status-success/10 px-5 py-4 text-sm text-status-success">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="space-y-6 rounded-2xl border border-border-default bg-surface-raised p-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Pursuit</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Update the core pursuit details and the primary quote request fields from one place.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Pursuit name">
              <input
                value={draft.project_name}
                onChange={(event) => setDraft((current) => current ? { ...current, project_name: event.target.value } : current)}
                className={inputClassName}
              />
            </Field>

            <Field label="Status">
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, status: event.target.value as DraftState["status"] } : current
                  )
                }
                className={inputClassName}
              >
                <option value="active">active</option>
                <option value="lost">lost</option>
                <option value="awarded">awarded</option>
                <option value="archived">archived</option>
              </select>
            </Field>

            <Field label="Customer / Owner">
              <input
                value={draft.owner_name}
                onChange={(event) => setDraft((current) => current ? { ...current, owner_name: event.target.value } : current)}
                className={inputClassName}
              />
            </Field>

            <Field label="Location">
              <input
                value={draft.project_location}
                onChange={(event) =>
                  setDraft((current) => current ? { ...current, project_location: event.target.value } : current)
                }
                className={inputClassName}
              />
            </Field>

            <Field label="Estimated value">
              <input
                type="number"
                step="0.01"
                value={draft.estimated_value}
                onChange={(event) =>
                  setDraft((current) => current ? { ...current, estimated_value: event.target.value } : current)
                }
                className={inputClassName}
              />
            </Field>

            <Field label="Bid date">
              <input
                type="date"
                value={draft.bid_date}
                onChange={(event) => setDraft((current) => current ? { ...current, bid_date: event.target.value } : current)}
                className={inputClassName}
              />
            </Field>

            <Field label="Proposal date">
              <input
                type="date"
                value={draft.proposal_date}
                onChange={(event) =>
                  setDraft((current) => current ? { ...current, proposal_date: event.target.value } : current)
                }
                className={inputClassName}
              />
            </Field>

            <ReadonlyField label="SharePoint folder" value={pursuit.sharepoint_folder ?? "-"} />
          </div>

          <Field label="Notes">
            <textarea
              rows={6}
              value={draft.notes}
              onChange={(event) => setDraft((current) => current ? { ...current, notes: event.target.value } : current)}
              className={textareaClassName}
            />
          </Field>
        </section>

        <section className="space-y-6 rounded-2xl border border-border-default bg-surface-raised p-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Quote Requests</h2>
            <p className="mt-1 text-sm text-text-secondary">
              The pursuit can carry multiple quote requests. The first quote request drives the editable bid fields above.
            </p>
          </div>

          {primaryQuoteRequest ? (
            <div className="grid gap-4 md:grid-cols-2">
              <ReadonlyField label="Primary company" value={primaryQuoteRequest.company_name || "-"} />
              <ReadonlyField label="Primary status" value={primaryQuoteRequest.status || "-"} />
              <ReadonlyField
                label="Primary estimate"
                value={formatCurrency(primaryQuoteRequest.estimated_value)}
              />
              <ReadonlyField
                label="Primary bid date"
                value={formatDate(primaryQuoteRequest.bid_date)}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border-default bg-surface-base px-4 py-3 text-sm text-text-tertiary">
              No quote requests attached yet.
            </div>
          )}

          <div className="space-y-3">
            {pursuit.quote_requests.map((quoteRequest) => (
              <div key={quoteRequest.id} className="rounded-2xl border border-border-default bg-surface-base p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{quoteRequest.company_name || "Unknown company"}</p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {quoteRequest.status} · {formatCurrency(quoteRequest.estimated_value)}
                    </p>
                  </div>
                  <p className="text-xs text-text-tertiary">{formatDate(quoteRequest.bid_date)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function buildDraft(pursuit: PursuitDetail): DraftState {
  const primaryQuoteRequest = pursuit.quote_requests?.[0] ?? null;

  return {
    project_name: pursuit.project_name ?? "",
    owner_name: pursuit.owner_name ?? "",
    project_location: pursuit.project_location ?? "",
    status: pursuit.status,
    estimated_value:
      primaryQuoteRequest?.estimated_value !== null && primaryQuoteRequest?.estimated_value !== undefined
        ? String(primaryQuoteRequest.estimated_value)
        : "",
    bid_date: primaryQuoteRequest?.bid_date ?? "",
    proposal_date: primaryQuoteRequest?.proposal_date ?? "",
    notes: primaryQuoteRequest?.notes ?? "",
  };
}

function sharePointUrl(folderPath: string) {
  return `https://controlsco.sharepoint.com/sites/TCCProjects/Shared%20Documents/${folderPath
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/")}`;
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-tertiary">{label}</p>
      <div className="rounded-xl border border-border-default bg-surface-base px-4 py-3 text-sm text-text-primary">
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

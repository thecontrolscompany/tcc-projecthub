"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { CrmContactRoleType, CrmConfidenceLevel } from "@/types/database";
import { CrmSubnav } from "@/components/crm/crm-subnav";
import { CRM_ROLE_TYPE_LABELS, CRM_CONFIDENCE_LABELS, CRM_CONFIDENCE_BADGES } from "@/lib/crm/utils";

type Candidate = {
  name: string;
  email: string;
  phone: string | null;
  mobile: string | null;
  title: string | null;
  domain_hint: string | null;
  suggested_account_id: string | null;
  last_email_date: string;
  sample_subject: string;
  already_imported: boolean;
};

type Account = { id: string; company_name: string };

type CandidateState = Candidate & {
  // user-editable before import
  display_name: string;
  role_type: CrmContactRoleType;
  confidence_level: CrmConfidenceLevel;
  account_id: string;
  // import status
  status: "pending" | "importing" | "imported" | "skipped" | "error";
  error_msg?: string;
};

const INPUT = "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";
const LABEL = "block text-xs font-medium text-text-secondary mb-1";

const ROLE_OPTIONS: Array<{ value: CrmContactRoleType; label: string }> = [
  { value: "salesperson", label: "Salesperson" },
  { value: "sales_manager", label: "Sales Manager" },
  { value: "estimator", label: "Estimator" },
  { value: "project_manager", label: "Project Manager" },
  { value: "senior_project_manager", label: "Senior PM" },
  { value: "operations_manager", label: "Ops Manager" },
  { value: "owner", label: "Owner" },
  { value: "cfo", label: "CFO" },
  { value: "cfo_estimator", label: "CFO / Estimator" },
  { value: "unknown", label: "Unknown" },
];

export default function ImportEmailPage() {
  const [candidates, setCandidates] = useState<CandidateState[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState("");
  const [stats, setStats] = useState<{ fetched: number; external: number; unique: number } | null>(null);
  const [showAlreadyImported, setShowAlreadyImported] = useState(false);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "300" });
      if (domainFilter.trim()) params.set("domain", domainFilter.trim());
      const res = await fetch(`/api/crm/email-import?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to fetch emails.");
        return;
      }
      const raw: Candidate[] = json.candidates ?? [];
      setAccounts(json.accounts ?? []);
      setStats({
        fetched: json.total_fetched ?? 0,
        external: json.total_external ?? 0,
        unique: json.total_unique ?? 0,
      });
      setCandidates(
        raw.map((c) => ({
          ...c,
          display_name: c.name,
          role_type: "unknown" as CrmContactRoleType,
          confidence_level: "needs_verification" as CrmConfidenceLevel,
          account_id: c.suggested_account_id ?? "",
          status: c.already_imported ? "imported" : "pending",
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }, [domainFilter]);

  function updateCandidate(email: string, patch: Partial<CandidateState>) {
    setCandidates((prev) =>
      prev.map((c) => (c.email === email ? { ...c, ...patch } : c))
    );
  }

  async function importOne(c: CandidateState) {
    if (!c.account_id) {
      updateCandidate(c.email, { status: "error", error_msg: "Select an account first." });
      return;
    }
    updateCandidate(c.email, { status: "importing" });
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: c.account_id,
          display_name: c.display_name || c.name,
          first_name: c.name.split(" ")[0] ?? null,
          last_name: c.name.split(" ").slice(1).join(" ") || null,
          role_type: c.role_type,
          title: c.title || null,
          email: c.email,
          phone: c.phone || null,
          mobile: c.mobile || null,
          confidence_level: c.confidence_level,
        }),
      });
      if (res.ok) {
        updateCandidate(c.email, { status: "imported" });
      } else {
        const json = await res.json();
        updateCandidate(c.email, { status: "error", error_msg: json.error ?? "Import failed." });
      }
    } catch (err) {
      updateCandidate(c.email, { status: "error", error_msg: "Network error." });
    }
  }

  async function importAll() {
    const pending = candidates.filter((c) => c.status === "pending" && c.account_id);
    for (const c of pending) {
      await importOne(c);
    }
  }

  const visible = showAlreadyImported
    ? candidates
    : candidates.filter((c) => c.status !== "imported" || c.already_imported === false);
  const pendingCount = candidates.filter((c) => c.status === "pending").length;
  const pendingWithAccount = candidates.filter((c) => c.status === "pending" && c.account_id).length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <CrmSubnav role="admin" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/crm/contacts" className="text-sm text-text-tertiary hover:text-text-primary">← Contacts</Link>
          </div>
          <h1 className="mt-1 text-xl font-semibold text-text-primary">Import from Email</h1>
          <p className="text-sm text-text-tertiary">
            Reads your recent Outlook inbox, deduplicates senders, and extracts phone numbers and titles from signatures.
          </p>
        </div>
      </div>

      {/* Fetch bar */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className={LABEL}>Filter by domain or name (optional)</label>
          <input
            type="text"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            placeholder="e.g. trane, johnsoncontrols, ecservices"
            className={`${INPUT} w-72`}
            onKeyDown={(e) => e.key === "Enter" && fetchCandidates()}
          />
        </div>
        <button
          onClick={fetchCandidates}
          disabled={loading}
          className="rounded-xl bg-brand-primary px-5 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:opacity-60"
        >
          {loading ? "Scanning emails…" : candidates.length ? "Refresh" : "Scan Inbox"}
        </button>
        {stats && (
          <p className="text-sm text-text-tertiary self-end">
            {stats.fetched} emails scanned · {stats.external} from external senders · {stats.unique} unique contacts found
          </p>
        )}
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-status-danger/30 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
          {error}
          {error.includes("Microsoft") && (
            <span className="ml-2 text-text-tertiary">(Sign out and back in with Microsoft SSO to refresh the token.)</span>
          )}
        </div>
      )}

      {candidates.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-sm text-text-secondary">
            <span>{pendingCount} new to review</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showAlreadyImported}
                onChange={(e) => setShowAlreadyImported(e.target.checked)}
                className="rounded"
              />
              Show already imported
            </label>
          </div>
          {pendingWithAccount > 0 && (
            <button
              onClick={importAll}
              className="rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-2 text-sm font-semibold text-status-success transition hover:bg-status-success/20"
            >
              Import all {pendingWithAccount} with account assigned
            </button>
          )}
        </div>
      )}

      {/* Candidate cards */}
      {visible.length === 0 && !loading && candidates.length > 0 && (
        <p className="py-8 text-center text-sm text-text-tertiary">
          All contacts have been imported or skipped.
        </p>
      )}

      <div className="space-y-4">
        {visible.map((c) => (
          <div
            key={c.email}
            className={[
              "rounded-2xl border p-5",
              c.status === "imported" ? "border-status-success/20 bg-status-success/5 opacity-70" :
              c.status === "error" ? "border-status-danger/30 bg-status-danger/5" :
              c.status === "skipped" ? "border-border-default bg-surface-base opacity-50" :
              "border-border-default bg-surface-raised",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-text-primary">{c.display_name || c.name}</p>
                  {c.status === "imported" && (
                    <span className="rounded-full bg-status-success/10 px-2 py-0.5 text-xs font-medium text-status-success">
                      ✓ Imported
                    </span>
                  )}
                  {c.status === "skipped" && (
                    <span className="rounded-full bg-surface-overlay px-2 py-0.5 text-xs text-text-tertiary">Skipped</span>
                  )}
                  {c.status === "importing" && (
                    <span className="text-xs text-text-tertiary">Saving…</span>
                  )}
                </div>
                <p className="text-sm text-text-secondary">{c.email}</p>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  Last email: {new Date(c.last_email_date).toLocaleDateString()} · &ldquo;{c.sample_subject.slice(0, 60)}&rdquo;
                </p>
              </div>
              {c.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateCandidate(c.email, { status: "skipped" })}
                    className="rounded-xl border border-border-default px-3 py-1.5 text-xs text-text-tertiary hover:bg-surface-overlay"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => importOne(c)}
                    disabled={!c.account_id}
                    className="rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-semibold text-text-inverse hover:bg-brand-hover disabled:opacity-50"
                  >
                    Import
                  </button>
                </div>
              )}
              {c.status === "error" && (
                <button
                  onClick={() => updateCandidate(c.email, { status: "pending" })}
                  className="text-xs text-brand-primary hover:underline"
                >
                  Retry
                </button>
              )}
            </div>

            {c.status === "error" && c.error_msg && (
              <p className="mt-2 text-xs text-status-danger">{c.error_msg}</p>
            )}

            {c.status === "pending" && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {/* Display name */}
                <div className="col-span-2 sm:col-span-1">
                  <label className={LABEL}>Display Name</label>
                  <input
                    type="text"
                    value={c.display_name}
                    onChange={(e) => updateCandidate(c.email, { display_name: e.target.value })}
                    className={INPUT}
                  />
                </div>

                {/* Account */}
                <div className="col-span-2 sm:col-span-1">
                  <label className={LABEL}>
                    Account *
                    {c.suggested_account_id && (
                      <span className="ml-1 text-status-success">· auto-matched</span>
                    )}
                  </label>
                  <select
                    value={c.account_id}
                    onChange={(e) => updateCandidate(c.email, { account_id: e.target.value })}
                    className={INPUT}
                  >
                    <option value="">— Select account —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.company_name}</option>
                    ))}
                  </select>
                </div>

                {/* Role */}
                <div>
                  <label className={LABEL}>Role Type</label>
                  <select
                    value={c.role_type}
                    onChange={(e) => updateCandidate(c.email, { role_type: e.target.value as CrmContactRoleType })}
                    className={INPUT}
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Confidence */}
                <div>
                  <label className={LABEL}>Confidence</label>
                  <select
                    value={c.confidence_level}
                    onChange={(e) => updateCandidate(c.email, { confidence_level: e.target.value as CrmConfidenceLevel })}
                    className={INPUT}
                  >
                    <option value="needs_verification">Needs verification</option>
                    <option value="partially_confirmed">Partially confirmed</option>
                    <option value="confirmed">Confirmed</option>
                  </select>
                </div>

                {/* Extracted fields (read-only preview) */}
                {(c.phone || c.title) && (
                  <div className="col-span-2 sm:col-span-3 lg:col-span-4 flex flex-wrap gap-4 border-t border-border-default pt-3 mt-1">
                    {c.phone && (
                      <div>
                        <span className={LABEL}>Phone (extracted)</span>
                        <p className="text-sm text-text-secondary">{c.phone}</p>
                      </div>
                    )}
                    {c.mobile && c.mobile !== c.phone && (
                      <div>
                        <span className={LABEL}>Mobile (extracted)</span>
                        <p className="text-sm text-text-secondary">{c.mobile}</p>
                      </div>
                    )}
                    {c.title && (
                      <div>
                        <span className={LABEL}>Title (extracted)</span>
                        <p className="text-sm text-text-secondary">{c.title}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!loading && candidates.length === 0 && !error && (
        <div className="py-16 text-center">
          <p className="text-text-tertiary text-sm">Click &ldquo;Scan Inbox&rdquo; to read your recent Outlook emails.</p>
          <p className="mt-2 text-xs text-text-tertiary">Requires Microsoft sign-in. Only external senders are shown — your own domain is excluded.</p>
        </div>
      )}
    </div>
  );
}

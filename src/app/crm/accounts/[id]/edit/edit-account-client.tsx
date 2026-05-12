"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CrmAccount, CrmAccountType } from "@/types/database";
import { CrmSubnav } from "@/components/crm/crm-subnav";
import { CRM_ACCOUNT_TYPE_OPTIONS } from "@/lib/crm/utils";

type ProfileOption = {
  id: string;
  full_name: string | null;
  email: string;
};

type Props = {
  account: CrmAccount;
  profiles: ProfileOption[];
  role: string;
};

const INPUT =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";
const LABEL = "mb-1 block text-xs font-medium uppercase tracking-wide text-text-tertiary";

export function EditAccountClient({ account, profiles, role }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTypes, setSelectedTypes] = useState<CrmAccountType[]>(
    account.types?.length ? account.types : account.type ? [account.type] : []
  );
  const [form, setForm] = useState({
    company_name: account.company_name ?? "",
    territory: account.territory ?? "",
    status: account.status ?? "active",
    relationship_health: account.relationship_health ?? "unknown",
    relationship_owner_profile_id: account.relationship_owner_profile_id ?? "",
    website: account.website ?? "",
    address: account.address ?? "",
    last_meaningful_contact_date: account.last_meaningful_contact_date?.slice(0, 10) ?? "",
    next_scheduled_followup_date: account.next_scheduled_followup_date?.slice(0, 10) ?? "",
    notes: account.notes ?? "",
    who_buys: account.who_buys ?? "",
    who_issues_po: account.who_issues_po ?? "",
    who_influences_spec: account.who_influences_spec ?? "",
    who_owns_estimating_relationship: account.who_owns_estimating_relationship ?? "",
    handoff_notes: account.handoff_notes ?? "",
  });

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) {
      setError("Company name is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/crm/accounts/${account.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: form.company_name.trim(),
          type: selectedTypes[0] ?? "other",
          types: selectedTypes,
          territory: form.territory.trim() || null,
          status: form.status,
          relationship_health: form.relationship_health,
          relationship_owner_profile_id: form.relationship_owner_profile_id || null,
          website: form.website.trim() || null,
          address: form.address.trim() || null,
          last_meaningful_contact_date: form.last_meaningful_contact_date || null,
          next_scheduled_followup_date: form.next_scheduled_followup_date || null,
          notes: form.notes.trim() || null,
          who_buys: form.who_buys.trim() || null,
          who_issues_po: form.who_issues_po.trim() || null,
          who_influences_spec: form.who_influences_spec.trim() || null,
          who_owns_estimating_relationship: form.who_owns_estimating_relationship.trim() || null,
          handoff_notes: form.handoff_notes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : "Unable to save changes.");
        return;
      }
      router.push(`/crm/accounts/${account.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <CrmSubnav role={role} />

      <div className="mb-6">
        <Link href={`/crm/accounts/${account.id}`} className="text-sm text-text-tertiary hover:text-text-primary">
          ← {account.company_name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary">Edit Account</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core info */}
        <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Core Info</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className={LABEL}>Company Name *</span>
              <input required value={form.company_name} onChange={(e) => set("company_name", e.target.value)} className={INPUT} />
            </label>

            <div>
              <span className={LABEL}>Type (select all that apply)</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {CRM_ACCOUNT_TYPE_OPTIONS.map((opt) => {
                  const checked = selectedTypes.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setSelectedTypes((prev) =>
                          checked ? prev.filter((t) => t !== opt.value) : [...prev, opt.value]
                        )
                      }
                      className={[
                        "rounded-full border px-3 py-1 text-xs font-medium transition",
                        checked
                          ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                          : "border-border-default text-text-secondary hover:border-brand-primary/50 hover:text-text-primary",
                      ].join(" ")}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label>
              <span className={LABEL}>Status</span>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className={INPUT}>
                <option value="active">Active</option>
                <option value="prospect">Prospect</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <label>
              <span className={LABEL}>Relationship Health</span>
              <select value={form.relationship_health} onChange={(e) => set("relationship_health", e.target.value)} className={INPUT}>
                <option value="strong">Strong</option>
                <option value="good">Good</option>
                <option value="at_risk">At Risk</option>
                <option value="dormant">Dormant</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>

            <label>
              <span className={LABEL}>Territory</span>
              <input value={form.territory} onChange={(e) => set("territory", e.target.value)} className={INPUT} placeholder="e.g. Pensacola, Gulf Coast" />
            </label>

            <label>
              <span className={LABEL}>Relationship Owner</span>
              <select value={form.relationship_owner_profile_id} onChange={(e) => set("relationship_owner_profile_id", e.target.value)} className={INPUT}>
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
                ))}
              </select>
            </label>

            <label>
              <span className={LABEL}>Website</span>
              <input value={form.website} onChange={(e) => set("website", e.target.value)} className={INPUT} placeholder="https://..." />
            </label>

            <label>
              <span className={LABEL}>Address</span>
              <input value={form.address} onChange={(e) => set("address", e.target.value)} className={INPUT} placeholder="City, State" />
            </label>

            <label>
              <span className={LABEL}>Last Meaningful Contact</span>
              <input type="date" value={form.last_meaningful_contact_date} onChange={(e) => set("last_meaningful_contact_date", e.target.value)} className={INPUT} />
            </label>

            <label>
              <span className={LABEL}>Next Follow-up</span>
              <input type="date" value={form.next_scheduled_followup_date} onChange={(e) => set("next_scheduled_followup_date", e.target.value)} className={INPUT} />
            </label>
          </div>

          <label className="mt-4 block">
            <span className={LABEL}>Notes</span>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={INPUT} placeholder="General notes about this account..." />
          </label>
        </div>

        {/* Relationship intel */}
        <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
          <h2 className="mb-4 text-sm font-semibold text-text-primary">Relationship Intel</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              <span className={LABEL}>Who Buys</span>
              <input value={form.who_buys} onChange={(e) => set("who_buys", e.target.value)} className={INPUT} placeholder="Name / role of decision maker" />
            </label>
            <label>
              <span className={LABEL}>Who Issues PO</span>
              <input value={form.who_issues_po} onChange={(e) => set("who_issues_po", e.target.value)} className={INPUT} placeholder="Name / role" />
            </label>
            <label>
              <span className={LABEL}>Who Influences Spec</span>
              <input value={form.who_influences_spec} onChange={(e) => set("who_influences_spec", e.target.value)} className={INPUT} placeholder="Name / role" />
            </label>
            <label>
              <span className={LABEL}>Who Owns Estimating Relationship</span>
              <input value={form.who_owns_estimating_relationship} onChange={(e) => set("who_owns_estimating_relationship", e.target.value)} className={INPUT} placeholder="Name / role" />
            </label>
          </div>
          <label className="mt-4 block">
            <span className={LABEL}>Handoff Notes</span>
            <textarea value={form.handoff_notes} onChange={(e) => set("handoff_notes", e.target.value)} rows={3} className={INPUT} placeholder="Context for handing this account off to another rep..." />
          </label>
        </div>

        {error && (
          <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/crm/accounts/${account.id}`}
            className="rounded-xl border border-border-default px-4 py-2 text-sm text-text-secondary transition hover:bg-surface-overlay"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

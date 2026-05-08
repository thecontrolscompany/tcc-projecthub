"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CrmSubnav } from "@/components/crm/crm-subnav";

type AccountOption = {
  id: string;
  company_name: string;
};

type ContactOption = {
  id: string;
  account_id: string;
  display_name: string;
  role_type: string;
};

type ProfileOption = {
  id: string;
  full_name: string | null;
  email: string;
};

type Props = {
  accounts: AccountOption[];
  contacts: ContactOption[];
  profiles: ProfileOption[];
  role: string;
};

const inputClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const labelClassName = "mb-1 block text-xs font-medium uppercase tracking-wide text-text-tertiary";

export function NewOpportunityClient({ accounts, contacts, profiles, role }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    account_id: "",
    project_name: "",
    primary_contact_id: "",
    estimator_profile_id: "",
    estimated_value: "",
    bid_due_date: "",
    market_type: "",
    next_step: "Build estimate in HVAC Estimator.",
    notes: "",
  });

  const accountContacts = useMemo(
    () => contacts.filter((contact) => contact.account_id === form.account_id),
    [contacts, form.account_id],
  );

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "account_id") next.primary_contact_id = "";
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.account_id || !form.project_name.trim()) {
      setError("Account and project name are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/crm/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: form.account_id,
          project_name: form.project_name.trim(),
          primary_contact_id: form.primary_contact_id || null,
          estimator_profile_id: form.estimator_profile_id || null,
          estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
          bid_due_date: form.bid_due_date || null,
          market_type: form.market_type.trim() || null,
          stage: "estimating",
          next_step: form.next_step.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : "Unable to create opportunity.");
        return;
      }

      router.push(`/crm/opportunities/${json.opportunity.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <CrmSubnav role={role} />

      <div className="mb-6">
        <Link href="/crm/opportunities" className="text-sm text-text-tertiary hover:text-text-primary">
          Back to Pipeline
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary">New Opportunity</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Create the sales record first, then estimate against this same opportunity.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border-default bg-surface-raised p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className={labelClassName}>Account</span>
            <select
              required
              value={form.account_id}
              onChange={(event) => updateField("account_id", event.target.value)}
              className={inputClassName}
            >
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.company_name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClassName}>Project name</span>
            <input
              required
              value={form.project_name}
              onChange={(event) => updateField("project_name", event.target.value)}
              className={inputClassName}
              placeholder="Example: Andalusia ES HVAC Controls"
            />
          </label>

          <label>
            <span className={labelClassName}>Primary contact</span>
            <select
              value={form.primary_contact_id}
              onChange={(event) => updateField("primary_contact_id", event.target.value)}
              className={inputClassName}
              disabled={!form.account_id}
            >
              <option value="">Optional</option>
              {accountContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.display_name} - {contact.role_type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClassName}>Estimator</span>
            <select
              value={form.estimator_profile_id}
              onChange={(event) => updateField("estimator_profile_id", event.target.value)}
              className={inputClassName}
            >
              <option value="">Optional</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name ?? profile.email}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClassName}>Expected value</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.estimated_value}
              onChange={(event) => updateField("estimated_value", event.target.value)}
              className={inputClassName}
              placeholder="0.00"
            />
          </label>

          <label>
            <span className={labelClassName}>Bid due date</span>
            <input
              type="date"
              value={form.bid_due_date}
              onChange={(event) => updateField("bid_due_date", event.target.value)}
              className={inputClassName}
            />
          </label>

          <label>
            <span className={labelClassName}>Market type</span>
            <input
              value={form.market_type}
              onChange={(event) => updateField("market_type", event.target.value)}
              className={inputClassName}
              placeholder="K-12, Federal, Commercial..."
            />
          </label>

          <label>
            <span className={labelClassName}>Next step</span>
            <input
              value={form.next_step}
              onChange={(event) => updateField("next_step", event.target.value)}
              className={inputClassName}
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className={labelClassName}>Notes</span>
          <textarea
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            className={`${inputClassName} min-h-28`}
            placeholder="Scope notes, customer request, bid instructions..."
          />
        </label>

        {error && (
          <div className="mt-4 rounded-xl border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-text-tertiary">
            New opportunities start in Estimating so the estimator action is ready on the detail page.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create Opportunity"}
          </button>
        </div>
      </form>
    </div>
  );
}

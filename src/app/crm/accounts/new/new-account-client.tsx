"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CrmSubnav } from "@/components/crm/crm-subnav";
import type { CrmAccountType } from "@/types/database";

type Props = {
  role: string;
  returnTo: string | null;
};

const INPUT =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";
const LABEL = "mb-1 block text-xs font-medium uppercase tracking-wide text-text-tertiary";

const ACCOUNT_TYPES: Array<{ value: CrmAccountType; label: string }> = [
  { value: "general_contractor", label: "General Contractor" },
  { value: "mechanical_contractor", label: "Mechanical Contractor" },
  { value: "controls_contractor", label: "Controls Contractor" },
  { value: "owner", label: "Owner" },
  { value: "hvac_oem", label: "HVAC OEM" },
  { value: "controls_oem", label: "Controls OEM" },
  { value: "other", label: "Other" },
];

export function NewAccountClient({ role, returnTo }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    company_name: "",
    type: "general_contractor" as CrmAccountType,
    status: "prospect",
    relationship_health: "unknown",
    website: "",
    address: "",
    territory: "",
    notes: "",
  });

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.company_name.trim()) {
      setError("Company name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/crm/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: form.company_name.trim(),
          type: form.type,
          status: form.status,
          relationship_health: form.relationship_health,
          website: form.website.trim() || null,
          address: form.address.trim() || null,
          territory: form.territory.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : "Unable to create account.");
        return;
      }

      router.push(returnTo || `/crm/accounts/${json.account.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <CrmSubnav role={role} />

      <div className="mb-6">
        <Link href={returnTo || "/crm/accounts"} className="text-sm text-text-tertiary hover:text-text-primary">
          Back
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary">New Account</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Add a customer, contractor, owner, OEM, or other company account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border-default bg-surface-raised p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className={LABEL}>Company name</span>
            <input
              required
              value={form.company_name}
              onChange={(event) => setField("company_name", event.target.value)}
              className={INPUT}
              autoFocus
            />
          </label>

          <label>
            <span className={LABEL}>Account type</span>
            <select
              value={form.type}
              onChange={(event) => setField("type", event.target.value)}
              className={INPUT}
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={LABEL}>Territory</span>
            <input value={form.territory} onChange={(event) => setField("territory", event.target.value)} className={INPUT} />
          </label>

          <label>
            <span className={LABEL}>Website</span>
            <input value={form.website} onChange={(event) => setField("website", event.target.value)} className={INPUT} />
          </label>
        </div>

        <label className="mt-4 block">
          <span className={LABEL}>Address</span>
          <input value={form.address} onChange={(event) => setField("address", event.target.value)} className={INPUT} />
        </label>

        <label className="mt-4 block">
          <span className={LABEL}>Notes</span>
          <textarea
            value={form.notes}
            onChange={(event) => setField("notes", event.target.value)}
            rows={4}
            className={INPUT}
          />
        </label>

        {error && (
          <div className="mt-4 rounded-xl border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create Account"}
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CrmSubnav } from "@/components/crm/crm-subnav";
import type { CrmAccountType } from "@/types/database";
import { CRM_ACCOUNT_TYPE_OPTIONS } from "@/lib/crm/utils";

type Props = {
  role: string;
  returnTo: string | null;
};

const INPUT =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";
const LABEL = "mb-1 block text-xs font-medium uppercase tracking-wide text-text-tertiary";


export function NewAccountClient({ role, returnTo }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<CrmAccountType[]>([]);
  const [form, setForm] = useState({
    company_name: "",
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
          type: selectedTypes[0] ?? "other",
          types: selectedTypes,
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

          <div>
            <span className={LABEL}>Account type (select all that apply)</span>
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

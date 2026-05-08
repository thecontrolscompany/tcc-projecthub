"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import { buildHvacEstimateBody, toPlatformEstimatePayload } from "@/modules/hvac-estimator/platform-adapter";

type InitialEstimate = {
  organizationId: string | null;
  linkedOpportunityId: string | null;
  opportunityNumber: string;
  projectName: string;
  customer: string;
  notes: string;
};

type Props = {
  initialEstimate: InitialEstimate;
};

const inputClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const labelClassName = "mb-1 block text-xs font-medium uppercase tracking-wide text-text-tertiary";

export function NewEstimateClient({ initialEstimate }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(initialEstimate);

  function setField(field: keyof InitialEstimate, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.projectName.trim()) {
      setError("Project name is required.");
      return;
    }

    setSubmitting(true);
    try {
      const body = buildHvacEstimateBody({
        organizationId: form.organizationId,
        linkedOpportunityId: form.linkedOpportunityId,
        opportunityNumber: form.opportunityNumber,
        projectName: form.projectName.trim(),
        customer: form.customer.trim() || null,
        notes: form.notes.trim() || null,
      });

      const payload = toPlatformEstimatePayload(body, "draft");
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : "Unable to create estimate.");
        return;
      }

      router.push("/estimating");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <OpportunityHubSubnav />

      <div className="mb-6">
        <Link href="/estimating" className="text-sm text-text-tertiary hover:text-text-primary">
          Back to Estimating
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary">New HVAC Estimate</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Create the first platform-native estimator record. Full equipment editing comes next.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-border-default bg-surface-raised p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className={labelClassName}>Project name</span>
            <input
              required
              value={form.projectName}
              onChange={(event) => setField("projectName", event.target.value)}
              className={inputClassName}
            />
          </label>

          <label>
            <span className={labelClassName}>Estimate / opportunity number</span>
            <input
              value={form.opportunityNumber}
              onChange={(event) => setField("opportunityNumber", event.target.value)}
              className={inputClassName}
            />
          </label>

          <label>
            <span className={labelClassName}>Customer</span>
            <input
              value={form.customer}
              onChange={(event) => setField("customer", event.target.value)}
              className={inputClassName}
            />
          </label>

          <label>
            <span className={labelClassName}>Linked opportunity</span>
            <input
              value={form.linkedOpportunityId ?? ""}
              readOnly
              className={`${inputClassName} text-text-tertiary`}
              placeholder="No opportunity linked"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className={labelClassName}>Notes</span>
          <textarea
            value={form.notes}
            onChange={(event) => setField("notes", event.target.value)}
            className={`${inputClassName} min-h-28`}
            placeholder="Scope notes, bid assumptions, or handoff context..."
          />
        </label>

        {error && (
          <div className="mt-4 rounded-xl border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-text-tertiary">
            This saves an empty estimate body with default HVAC Estimator settings and platform linkage.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create Estimate"}
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import { buildHvacEstimateBody, toPlatformEstimatePayload } from "@/modules/hvac-estimator/platform-adapter";
import { ESTIMATE_SCOPE_MODES, normalizeEstimateScopeMode } from "@/modules/hvac-estimator/components/estimate/projectSettings";

type InitialEstimate = {
  organizationId: string | null;
  linkedOpportunityId: string | null;
  estimateNumber: string;
  opportunityNumber: string;
  projectName: string;
  customerAccountId: string;
  customer: string;
  notes: string;
  estimateScopeMode: string;
};

type AccountOption = {
  id: string;
  company_name: string;
};

type Props = {
  initialEstimate: InitialEstimate;
  accounts: AccountOption[];
};

const inputClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const labelClassName = "mb-1 block text-xs font-medium uppercase tracking-wide text-text-tertiary";

export function NewEstimateClient({ initialEstimate, accounts }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(initialEstimate);
  const returnPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const newAccountHref = `/crm/accounts/new?returnTo=${encodeURIComponent(returnPath)}`;

  function setField(field: keyof InitialEstimate, value: string) {
    setForm((current) => {
      if (field === "customerAccountId") {
        const account = accounts.find((item) => item.id === value);
        return {
          ...current,
          customerAccountId: value,
          customer: account?.company_name ?? "",
        };
      }

      return { ...current, [field]: value };
    });
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
        estimateNumber: form.estimateNumber.trim(),
        opportunityNumber: form.opportunityNumber.trim(),
        projectName: form.projectName.trim(),
        customerAccountId: form.customerAccountId || null,
        customer: form.customer.trim() || null,
        notes: form.notes.trim() || null,
        estimateScopeMode: normalizeEstimateScopeMode(form.estimateScopeMode),
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
              value={form.estimateNumber}
              onChange={(event) => setField("estimateNumber", event.target.value)}
              className={inputClassName}
            />
            <span className="mt-1 block text-xs text-text-tertiary">
              Auto-numbered by default. You can overwrite it before creating the estimate.
            </span>
          </label>

          <div>
            <label>
              <span className={labelClassName}>Customer</span>
              <select
                value={form.customerAccountId}
                onChange={(event) => setField("customerAccountId", event.target.value)}
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
            <Link href={newAccountHref} className="mt-1 inline-flex text-xs font-medium text-brand-primary hover:underline">
              Add new customer
            </Link>
          </div>

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

        <fieldset className="mt-4 rounded-2xl border border-border-default bg-surface-overlay p-4">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-text-tertiary">Estimate scope</legend>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {ESTIMATE_SCOPE_MODES.map((mode) => {
              const checked = normalizeEstimateScopeMode(form.estimateScopeMode) === mode.id;
              return (
                <label
                  key={mode.id}
                  className={`flex h-full cursor-pointer flex-col rounded-xl border px-4 py-3 transition ${
                    checked
                      ? "border-brand-primary bg-brand-subtle"
                      : "border-border-default bg-surface-raised hover:border-brand-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="estimateScopeMode"
                      value={mode.id}
                      checked={checked}
                      onChange={() => setField("estimateScopeMode", mode.id)}
                      className="mt-0.5 h-4 w-4 accent-brand-primary"
                    />
                    <span className="text-sm font-semibold text-text-primary">{mode.label}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-text-secondary">{mode.description}</p>
                </label>
              );
            })}
          </div>
        </fieldset>

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

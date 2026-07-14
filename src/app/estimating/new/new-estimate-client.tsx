"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import { buildHvacEstimateBody, toPlatformEstimatePayload } from "@/modules/hvac-estimator/platform-adapter";

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
  installCatalog: Record<string, unknown>;
  controlsCatalog: Record<string, unknown>;
  controlsDefaultOverrides: Record<string, string>;
};

const inputClassName =
  "w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

const labelClassName = "mb-1 block text-xs font-medium uppercase tracking-wide text-text-tertiary";

export function NewEstimateClient({ initialEstimate, accounts: initialAccounts }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(initialEstimate);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState<string | null>(null);

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

  async function handleCreateCustomer() {
    const companyName = newCustomerName.trim();
    if (!companyName) {
      setNewCustomerError("Company name is required.");
      return;
    }

    setCreatingCustomer(true);
    setNewCustomerError(null);
    try {
      const res = await fetch("/api/crm/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyName }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setNewCustomerError(typeof json?.error === "string" ? json.error : "Unable to create customer.");
        return;
      }

      const account = json?.account as AccountOption | undefined;
      if (!account?.id) {
        setNewCustomerError("Unable to create customer.");
        return;
      }

      setAccounts((current) => [...current, account].sort((a, b) => a.company_name.localeCompare(b.company_name)));
      setField("customerAccountId", account.id);
      setAddingCustomer(false);
      setNewCustomerName("");
    } finally {
      setCreatingCustomer(false);
    }
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

      const estimateId = typeof json?.estimate?.id === "string" ? json.estimate.id : "";
      if (estimateId) {
        router.replace(`/estimating/${estimateId}`);
      } else {
        router.push("/estimating");
      }
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
            {addingCustomer ? (
              <div className="mt-2 flex flex-col gap-2 rounded-xl border border-border-default bg-surface-overlay p-3">
                <span className={labelClassName}>New customer name</span>
                <input
                  autoFocus
                  value={newCustomerName}
                  onChange={(event) => setNewCustomerName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreateCustomer();
                    }
                  }}
                  className={inputClassName}
                  placeholder="Company name"
                />
                {newCustomerError && <span className="text-xs text-status-danger">{newCustomerError}</span>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCreateCustomer()}
                    disabled={creatingCustomer}
                    className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingCustomer ? "Creating..." : "Create customer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCustomer(false);
                      setNewCustomerName("");
                      setNewCustomerError(null);
                    }}
                    className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-raised"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingCustomer(true)}
                className="mt-1 inline-flex text-xs font-medium text-brand-primary hover:underline"
              >
                Add new customer
              </button>
            )}
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
            This saves an empty estimate body with default HVAC Estimator settings and platform linkage. Proposal scope can be chosen later.
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

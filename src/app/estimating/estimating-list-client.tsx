"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import type { EstimateRecord } from "@/types/database";

type ApiResponse = {
  estimates?: EstimateRecord[];
  error?: string;
};

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function getEstimateBodyField(body: Record<string, unknown> | null | undefined, key: string) {
  const value = body?.[key];
  return typeof value === "string" ? value : "";
}

export function EstimatingListClient() {
  const [estimates, setEstimates] = useState<EstimateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function loadEstimates() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/estimates", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiResponse | null;
        if (!active) return;

        if (!res.ok) {
          setError(json?.error ?? "Unable to load estimates.");
          setEstimates([]);
          return;
        }

        setEstimates(json?.estimates ?? []);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadEstimates();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return estimates;

    return estimates.filter((estimate) => {
      const name = estimate.name ?? getEstimateBodyField(estimate.body, "name");
      const number = estimate.number ?? getEstimateBodyField(estimate.body, "number");
      const customer = getEstimateBodyField(estimate.body, "customer");
      return `${name} ${number} ${customer}`.toLowerCase().includes(query);
    });
  }, [estimates, search]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <OpportunityHubSubnav />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">HVAC Estimator</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Platform-native estimates saved through the shared estimates API.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/estimating/new"
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
          >
            New Estimate
          </Link>
          <a
            href="https://estimates.thecontrolscompany.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-border-default px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
          >
            Standalone Tool
          </a>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-default bg-surface-raised p-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search estimates..."
          className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none md:w-80"
        />
        <div className="text-sm text-text-tertiary">
          {filtered.length} of {estimates.length} estimates
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border-default bg-surface-raised p-8 text-sm text-text-secondary">
          Loading estimates...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border-default bg-surface-raised p-8 text-center">
          <p className="text-sm font-medium text-text-primary">No estimates yet.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Create an estimate directly or launch from an OpportunityHub opportunity.
          </p>
          <Link
            href="/estimating/new"
            className="mt-4 inline-flex rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
          >
            Create First Estimate
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-default bg-surface-overlay text-xs uppercase tracking-wide text-text-tertiary">
              <tr>
                <th className="px-4 py-3 font-semibold">Estimate</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {filtered.map((estimate) => {
                const name = (estimate.name ?? getEstimateBodyField(estimate.body, "name")) || "Untitled Estimate";
                const number = estimate.number ?? getEstimateBodyField(estimate.body, "number");
                const customer = getEstimateBodyField(estimate.body, "customer");

                return (
                  <tr key={estimate.id} className="hover:bg-surface-overlay/60">
                    <td className="px-4 py-4">
                      <Link href={`/estimating/${estimate.id}`} className="font-medium text-text-primary hover:text-brand-primary">
                        {name}
                      </Link>
                      <div className="mt-0.5 text-xs text-text-tertiary">{number || estimate.id}</div>
                    </td>
                    <td className="px-4 py-4 text-text-secondary">{customer || "-"}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-surface-overlay px-2 py-1 text-xs font-medium text-text-secondary">
                        {estimate.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-text-primary">
                      {formatCurrency(estimate.total_amount)}
                    </td>
                    <td className="px-4 py-4 text-text-tertiary">{formatDate(estimate.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

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
  const [message, setMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "archived">("active");

  useEffect(() => {
    let active = true;

    async function loadEstimates() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/estimates?include_archived=true", { cache: "no-store" });
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

  async function deleteEstimate(estimate: EstimateRecord) {
    const name = (estimate.name ?? getEstimateBodyField(estimate.body, "name")) || "this estimate";
    const confirmed = window.confirm(
      `Delete ${name}?\n\nThis archives the estimate and removes it from the active estimating list.`,
    );
    if (!confirmed) return;

    setDeletingId(estimate.id);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/estimates/${estimate.id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setError(json?.error ?? "Unable to delete estimate.");
        return;
      }

      setEstimates((current) => current.filter((item) => item.id !== estimate.id));
      setMessage("Estimate deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  async function restoreEstimate(estimate: EstimateRecord) {
    setRestoringId(estimate.id);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`/api/estimates/${estimate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archived: false,
          status: "draft",
        }),
      });
      const json = (await res.json().catch(() => null)) as { estimate?: EstimateRecord; error?: string } | null;

      if (!res.ok || !json?.estimate) {
        setError(json?.error ?? "Unable to restore estimate.");
        return;
      }

      setEstimates((current) => current.map((item) => (item.id === estimate.id ? json.estimate as EstimateRecord : item)));
      setMessage("Estimate restored.");
      setTab("active");
    } finally {
      setRestoringId(null);
    }
  }

  async function copyEstimate(estimate: EstimateRecord) {
    const baseBody = (estimate.body ?? {}) as Record<string, unknown>;
    const baseName = (estimate.name ?? getEstimateBodyField(estimate.body, "name")) || "Untitled Estimate";
    const nextName = window.prompt("Name for copied estimate", `${baseName} - Copy`);
    if (!nextName?.trim()) return;

    setCopyingId(estimate.id);
    setError(null);
    setMessage(null);

    const nextBody = {
      ...baseBody,
      id: crypto.randomUUID(),
      name: nextName.trim(),
      number: "",
      version: "1.0",
      archived: false,
      copiedFromEstimateId: estimate.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: estimate.organization_id,
          linked_opportunity_id: estimate.linked_opportunity_id,
          linked_project_id: estimate.linked_project_id,
          body: nextBody,
          status: "draft",
          archived: false,
          total_amount: estimate.total_amount,
          gross_margin_amount: estimate.gross_margin_amount,
          gross_margin_pct: estimate.gross_margin_pct,
        }),
      });
      const json = (await res.json().catch(() => null)) as { estimate?: EstimateRecord; error?: string } | null;

      if (!res.ok || !json?.estimate) {
        setError(json?.error ?? "Unable to copy estimate.");
        return;
      }

      setEstimates((current) => [json.estimate as EstimateRecord, ...current]);
      setMessage("Estimate copied.");
      setTab("active");
    } finally {
      setCopyingId(null);
    }
  }

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

  const visibleEstimates = useMemo(() => {
    const archived = tab === "archived";
    return filtered.filter((estimate) => Boolean(estimate.archived) === archived);
  }, [filtered, tab]);

  const activeCount = estimates.filter((estimate) => !estimate.archived).length;
  const archivedCount = estimates.filter((estimate) => estimate.archived).length;

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
          <Link
            href="/estimating/pricebook"
            className="rounded-xl border border-border-default px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
          >
            Price Book
          </Link>
          <Link
            href="/estimating/help"
            className="rounded-xl border border-border-default px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
          >
            Help
          </Link>
          <Link
            href="/estimating/settings"
            className="rounded-xl border border-border-default px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
          >
            AI Settings
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-border-default bg-surface-overlay p-1">
            {[
              ["active", `Active (${activeCount})`],
              ["archived", `Archived (${archivedCount})`],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id as "active" | "archived")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  tab === id ? "bg-brand-primary text-text-inverse" : "text-text-secondary hover:bg-surface-raised"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search estimates..."
            className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none md:w-80"
          />
        </div>
        <div className="text-sm text-text-tertiary">
          {visibleEstimates.length} of {filtered.length} matching estimates
        </div>
      </div>

      {message && (
        <div className="mb-5 rounded-2xl border border-status-success/30 bg-status-success/10 p-4 text-sm text-status-success">
          {message}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border-default bg-surface-raised p-8 text-sm text-text-secondary">
          Loading estimates...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger">
          {error}
        </div>
      ) : visibleEstimates.length === 0 ? (
        <div className="rounded-2xl border border-border-default bg-surface-raised p-8 text-center">
          <p className="text-sm font-medium text-text-primary">
            {tab === "archived" ? "No archived estimates." : "No active estimates yet."}
          </p>
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
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {visibleEstimates.map((estimate) => {
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
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => copyEstimate(estimate)}
                          disabled={copyingId === estimate.id}
                          className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {copyingId === estimate.id ? "Copying..." : "Copy"}
                        </button>
                        {estimate.archived ? (
                          <button
                            type="button"
                            onClick={() => restoreEstimate(estimate)}
                            disabled={restoringId === estimate.id}
                            className="rounded-lg border border-brand-primary/40 px-3 py-1.5 text-xs font-semibold text-brand-primary transition hover:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {restoringId === estimate.id ? "Restoring..." : "Restore"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => deleteEstimate(estimate)}
                            disabled={deletingId === estimate.id}
                            className="rounded-lg border border-status-danger/40 px-3 py-1.5 text-xs font-semibold text-status-danger transition hover:bg-status-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === estimate.id ? "Deleting..." : "Delete"}
                          </button>
                        )}
                      </div>
                    </td>
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

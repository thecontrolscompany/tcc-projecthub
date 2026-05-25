"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
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
  const [addingBidderId, setAddingBidderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    async function loadEstimates() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/estimates?include_archived=true", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiResponse | null;
        if (!active) return;
        if (!res.ok || !json?.estimates) {
          setError(json?.error ?? "Unable to load estimates.");
          return;
        }
        setEstimates(json.estimates);
      } catch {
        if (active) setError("Unable to load estimates.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadEstimates();
    return () => {
      active = false;
    };
  }, []);

  // Build parentId → children map across all estimates (not filtered)
  const childrenByParentId = useMemo(() => {
    const map = new Map<string, EstimateRecord[]>();
    for (const est of estimates) {
      const parentId = getEstimateBodyField(est.body, "parentEstimateId");
      if (!parentId) continue;
      const list = map.get(parentId) ?? [];
      list.push(est);
      map.set(parentId, list);
    }
    return map;
  }, [estimates]);

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
      parentEstimateId: undefined,
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

  async function addBidder(parent: EstimateRecord) {
    const bidderName = window.prompt("New bidder name (e.g. ECS, Siemens):");
    if (!bidderName?.trim()) return;

    setAddingBidderId(parent.id);
    setError(null);
    setMessage(null);

    const baseBody = (parent.body ?? {}) as Record<string, unknown>;
    const nextBody = {
      ...baseBody,
      id: crypto.randomUUID(),
      bidder: bidderName.trim(),
      parentEstimateId: parent.id,
      sharepointFolder: null,
      sharepointItemId: null,
      number: "",
      version: "1.0",
      archived: false,
      copiedFromEstimateId: parent.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: parent.organization_id,
          linked_opportunity_id: parent.linked_opportunity_id,
          linked_project_id: parent.linked_project_id,
          body: nextBody,
          status: "draft",
          archived: false,
        }),
      });
      const json = (await res.json().catch(() => null)) as { estimate?: EstimateRecord; error?: string } | null;

      if (!res.ok || !json?.estimate) {
        setError(json?.error ?? "Unable to add bidder estimate.");
        return;
      }

      setEstimates((current) => [...current, json.estimate as EstimateRecord]);
      setExpandedParents((prev) => new Set([...prev, parent.id]));
      setMessage(`Added bidder "${bidderName.trim()}" as a linked estimate.`);
    } finally {
      setAddingBidderId(null);
    }
  }

  function toggleExpanded(parentId: string) {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }

  // Only top-level (non-child) estimates appear as rows; children appear under their parent
  const visibleParents = useMemo(() => {
    const archived = tab === "archived";
    const query = search.trim().toLowerCase();

    return estimates.filter((est) => {
      if (getEstimateBodyField(est.body, "parentEstimateId")) return false; // children handled separately
      if (Boolean(est.archived) !== archived) return false;
      if (!query) return true;
      const name = est.name ?? getEstimateBodyField(est.body, "name");
      const number = est.number ?? getEstimateBodyField(est.body, "number");
      const customer = getEstimateBodyField(est.body, "customer");
      const bidder = getEstimateBodyField(est.body, "bidder");
      return `${name} ${number} ${customer} ${bidder}`.toLowerCase().includes(query);
    });
  }, [estimates, tab, search]);

  const activeCount = estimates.filter((est) => !est.archived && !getEstimateBodyField(est.body, "parentEstimateId")).length;
  const archivedCount = estimates.filter((est) => est.archived && !getEstimateBodyField(est.body, "parentEstimateId")).length;

  function renderEstimateRow(estimate: EstimateRecord, isChild = false): React.ReactNode {
    const name = (estimate.name ?? getEstimateBodyField(estimate.body, "name")) || "Untitled Estimate";
    const number = estimate.number ?? getEstimateBodyField(estimate.body, "number");
    const customer = getEstimateBodyField(estimate.body, "customer");
    const bidder = getEstimateBodyField(estimate.body, "bidder");
    const children = childrenByParentId.get(estimate.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedParents.has(estimate.id);

    return (
      <>
        <tr key={estimate.id} className={`hover:bg-surface-overlay/60 ${isChild ? "bg-surface-overlay/30" : ""}`}>
          <td className="px-4 py-3">
            <div className={`flex items-center gap-2 ${isChild ? "pl-6" : ""}`}>
              {!isChild && hasChildren && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(estimate.id)}
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-text-tertiary transition hover:bg-surface-overlay hover:text-text-primary"
                  aria-label={isExpanded ? "Collapse bidders" : "Expand bidders"}
                >
                  {isExpanded ? "▼" : "▶"}
                </button>
              )}
              {!isChild && !hasChildren && <span className="w-5 flex-shrink-0" />}
              <div>
                <div className="flex items-center gap-1.5">
                  <Link href={`/estimating/${estimate.id}`} className="font-medium text-text-primary hover:text-brand-primary">
                    {name}
                  </Link>
                  {bidder && (
                    <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs font-semibold text-brand-primary">
                      {bidder}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-text-tertiary">
                  {number || estimate.id.slice(0, 8)}
                  {hasChildren && !isExpanded && (
                    <span className="ml-2 text-text-tertiary">· {children.length} bidder{children.length !== 1 ? "s" : ""}</span>
                  )}
                </div>
              </div>
            </div>
          </td>
          <td className="px-4 py-3 text-text-secondary">{customer || "-"}</td>
          <td className="px-4 py-3">
            <span className="rounded-full bg-surface-overlay px-2 py-1 text-xs font-medium text-text-secondary">
              {estimate.status.replace(/_/g, " ")}
            </span>
          </td>
          <td className="px-4 py-3 text-right font-medium text-text-primary">
            {formatCurrency(estimate.total_amount)}
          </td>
          <td className="px-4 py-3 text-text-tertiary">{formatDate(estimate.updated_at)}</td>
          <td className="px-4 py-3 text-right">
            <div className="flex justify-end gap-1.5">
              {!isChild && !estimate.archived && (
                <button
                  type="button"
                  onClick={() => addBidder(estimate)}
                  disabled={addingBidderId === estimate.id}
                  className="rounded-lg border border-border-default px-2.5 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {addingBidderId === estimate.id ? "Adding..." : "+ Bidder"}
                </button>
              )}
              <button
                type="button"
                onClick={() => copyEstimate(estimate)}
                disabled={copyingId === estimate.id}
                className="rounded-lg border border-border-default px-2.5 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {copyingId === estimate.id ? "Copying..." : "Copy"}
              </button>
              {estimate.archived ? (
                <button
                  type="button"
                  onClick={() => restoreEstimate(estimate)}
                  disabled={restoringId === estimate.id}
                  className="rounded-lg border border-brand-primary/40 px-2.5 py-1.5 text-xs font-semibold text-brand-primary transition hover:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {restoringId === estimate.id ? "Restoring..." : "Restore"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => deleteEstimate(estimate)}
                  disabled={deletingId === estimate.id}
                  className="rounded-lg border border-status-danger/40 px-2.5 py-1.5 text-xs font-semibold text-status-danger transition hover:bg-status-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === estimate.id ? "Deleting..." : "Delete"}
                </button>
              )}
            </div>
          </td>
        </tr>
        {!isChild && isExpanded && children.map((child) => renderEstimateRow(child, true))}
      </>
    );
  }

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
          {visibleParents.length} estimate{visibleParents.length !== 1 ? "s" : ""}
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
      ) : visibleParents.length === 0 ? (
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
              {visibleParents.map((estimate) => renderEstimateRow(estimate, false))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

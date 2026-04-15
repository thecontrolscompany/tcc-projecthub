"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import { safeJson } from "@/lib/utils/safe-json";

type QuoteRequestSummary = {
  id: string;
  estimated_value: number | null;
  status: string;
  bid_date: string | null;
};

type PursuitRow = {
  id: string;
  project_name: string;
  owner_name: string | null;
  project_location: string | null;
  status: "active" | "awarded" | "lost" | "archived";
  created_at: string;
  sharepoint_folder: string | null;
  linked_project_id: string | null;
  quote_requests: QuoteRequestSummary[];
};

type SortKey = "project_name" | "owner_name" | "created_at" | "value" | "quote_count";
type SortDir = "asc" | "desc";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  awarded: "Won",
  lost: "Lost",
  archived: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-brand-primary/10 text-brand-primary",
  awarded: "bg-status-success/10 text-status-success",
  lost: "bg-status-danger/10 text-status-danger",
  archived: "bg-surface-overlay text-text-tertiary",
};

export function PursuitListWorkspace() {
  const [pursuits, setPursuits] = useState<PursuitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichMessage, setEnrichMessage] = useState<string | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [organizeMessage, setOrganizeMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/opportunities/pursuits", { cache: "no-store" });
      const json = await safeJson(response);
      if (!response.ok) throw new Error(json?.error ?? "Unable to load pursuits.");
      setPursuits((json.pursuits ?? []) as PursuitRow[]);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load pursuits.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function pursuitValue(pursuit: PursuitRow) {
    return pursuit.quote_requests.reduce((max, quote) => Math.max(max, quote.estimated_value ?? 0), 0);
  }

  function pursuitBidDate(pursuit: PursuitRow) {
    const dates = pursuit.quote_requests
      .map((quote) => quote.bid_date)
      .filter((value): value is string => Boolean(value))
      .sort();

    return dates[0] ?? null;
  }

  const filtered = useMemo(() => {
    let rows = pursuits;

    if (statusFilter !== "all") {
      rows = rows.filter((pursuit) => pursuit.status === statusFilter);
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      rows = rows.filter(
        (pursuit) =>
          pursuit.project_name.toLowerCase().includes(query) ||
          (pursuit.owner_name ?? "").toLowerCase().includes(query) ||
          (pursuit.project_location ?? "").toLowerCase().includes(query)
      );
    }

    return [...rows].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "project_name") comparison = a.project_name.localeCompare(b.project_name);
      else if (sortKey === "owner_name") comparison = (a.owner_name ?? "").localeCompare(b.owner_name ?? "");
      else if (sortKey === "created_at") comparison = a.created_at.localeCompare(b.created_at);
      else if (sortKey === "value") comparison = pursuitValue(a) - pursuitValue(b);
      else if (sortKey === "quote_count") comparison = a.quote_requests.length - b.quote_requests.length;
      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [pursuits, search, sortDir, sortKey, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: pursuits.length };
    for (const pursuit of pursuits) counts[pursuit.status] = (counts[pursuit.status] ?? 0) + 1;
    return counts;
  }, [pursuits]);

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((pursuit) => pursuit.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} pursuit${selected.size !== 1 ? "s" : ""} and all their quote requests? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const response = await fetch("/api/opportunities/pursuits", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const json = await safeJson(response);
      if (!response.ok) throw new Error(json?.error ?? "Unable to delete pursuits.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete pursuits.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleEnrichStubs() {
    setEnriching(true);
    setEnrichMessage(null);

    try {
      const stubs = pursuits
        .filter((pursuit) => !pursuit.owner_name)
        .map((pursuit) => pursuit.id);

      if (stubs.length === 0) {
        setEnrichMessage("No stub pursuits to enrich.");
        return;
      }

      const batchSize = 10;
      let enriched = 0;
      let noFolder = 0;
      let noFile = 0;
      let errors = 0;

      for (let index = 0; index < stubs.length; index += batchSize) {
        const batch = stubs.slice(index, index + batchSize);
        const response = await fetch("/api/opportunities/import/mass/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pursuit_ids: batch }),
        });
        const json = await safeJson(response);
        if (!response.ok) throw new Error(json?.error ?? "Enrichment failed.");

        enriched += json.enriched ?? 0;
        noFolder += json.no_folder ?? 0;
        noFile += json.no_file ?? 0;
        errors += json.errors ?? 0;

        setEnrichMessage(`${enriched} enriched · ${noFolder} unmatched · ${noFile} no docs · ${errors} errors`);
      }

      await load();
    } catch (err) {
      setEnrichMessage(err instanceof Error ? err.message : "Enrichment failed.");
    } finally {
      setEnriching(false);
    }
  }

  async function handleOrganize() {
    setOrganizing(true);
    setOrganizeMessage(null);
    let organized = 0;
    let nothing = 0;
    let errors = 0;

    try {
      const allIds = pursuits.map((pursuit) => pursuit.id);
      const batchSize = 10;
      for (let index = 0; index < allIds.length; index += batchSize) {
        const response = await fetch("/api/opportunities/import/mass/organize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pursuit_ids: allIds.slice(index, index + batchSize) }),
        });
        const json = await response.json().catch(() => null);
        if (!response.ok) throw new Error(json?.error ?? "Organize failed.");
        organized += json?.organized ?? 0;
        nothing += json?.nothing_to_move ?? 0;
        errors += json?.errors ?? 0;
        setOrganizeMessage(`${organized} organized · ${nothing} already tidy · ${errors} errors`);
      }
    } catch (organizeError) {
      setOrganizeMessage(organizeError instanceof Error ? organizeError.message : "Organize failed.");
    } finally {
      setOrganizing(false);
    }
  }

  function SortTh({ label, field }: { label: string; field: SortKey }) {
    const active = sortKey === field;
    return (
      <th
        className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary hover:text-text-primary"
        onClick={() => toggleSort(field)}
      >
        {label}
        {active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
      </th>
    );
  }

  return (
    <div className="space-y-6">
      <OpportunityHubSubnav />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Opportunity Hub</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">Pursuits</h1>
          <p className="mt-2 text-sm text-text-secondary">
            All bid opportunities. Each pursuit can have multiple quote requests, one per customer or GC.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 px-5 py-4 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, customer, location..."
          className="w-64 rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void handleEnrichStubs()}
          disabled={enriching}
          className="rounded-xl border border-border-default bg-surface-base px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-overlay disabled:opacity-60"
        >
          {enriching ? "Enriching..." : "Enrich stubs"}
        </button>
        {enrichMessage ? <p className="text-xs text-text-secondary">{enrichMessage}</p> : null}
        <button
          type="button"
          onClick={() => void handleOrganize()}
          disabled={organizing}
          className="rounded-xl border border-border-default bg-surface-base px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-overlay disabled:opacity-60"
        >
          {organizing ? "Organizing..." : "Organize files"}
        </button>
        {organizeMessage ? <p className="text-xs text-text-secondary">{organizeMessage}</p> : null}
        <div className="flex flex-wrap gap-2">
          {(["all", "active", "awarded", "lost", "archived"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === status
                  ? "bg-brand-primary text-text-inverse"
                  : "bg-surface-overlay text-text-secondary hover:text-text-primary"
              }`}
            >
              {status === "all" ? "All" : STATUS_LABELS[status]} ({statusCounts[status] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">{selected.size} selected</span>
          <button
            type="button"
            onClick={() => void handleDeleteSelected()}
            disabled={deleting}
            className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-sm font-medium text-status-danger transition hover:bg-status-danger/20 disabled:opacity-60"
          >
            {deleting ? "Deleting..." : `Delete ${selected.size} pursuit${selected.size !== 1 ? "s" : ""}`}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm text-text-tertiary hover:text-text-secondary"
          >
            Clear selection
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border-default bg-surface-raised">
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-text-tertiary">Loading pursuits...</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-text-tertiary">
            {pursuits.length === 0 ? "No pursuits yet." : "No pursuits match the current filters."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-surface-base">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    ref={(el) => {
                      if (el) el.indeterminate = selected.size > 0 && selected.size < filtered.length;
                    }}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-border-default"
                  />
                </th>
                <SortTh label="Pursuit" field="project_name" />
                <SortTh label="Customer" field="owner_name" />
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Location</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Est. value</th>
                <SortTh label="Quotes" field="quote_count" />
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">Bid date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">SharePoint</th>
                <SortTh label="Created" field="created_at" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {filtered.map((pursuit) => (
                <tr key={pursuit.id} className="hover:bg-surface-overlay">
                  <td className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(pursuit.id)}
                      onChange={() => toggleOne(pursuit.id)}
                      className="h-4 w-4 rounded border-border-default"
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-text-primary">
                    <Link href={`/quotes/pursuits/${pursuit.id}`} className="hover:text-brand-primary hover:underline">
                      {pursuit.project_name}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {pursuit.owner_name ?? <span className="italic text-text-tertiary">-</span>}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {pursuit.project_location ?? <span className="italic text-text-tertiary">-</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[pursuit.status] ?? ""}`}>
                      {STATUS_LABELS[pursuit.status] ?? pursuit.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-text-secondary">{formatCurrency(pursuitValue(pursuit))}</td>
                  <td className="px-3 py-3 text-text-secondary">{pursuit.quote_requests.length}</td>
                  <td className="px-3 py-3 text-text-secondary">{formatDate(pursuitBidDate(pursuit))}</td>
                  <td className="px-3 py-3 text-text-secondary">
                    {pursuit.sharepoint_folder ? (
                      <a
                        href={sharePointUrl(pursuit.sharepoint_folder)}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-brand-primary hover:underline"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="italic text-text-tertiary">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-text-tertiary">{new Date(pursuit.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-text-tertiary">
        {filtered.length} of {pursuits.length} pursuit{pursuits.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

function formatCurrency(value: number) {
  if (!value) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function sharePointUrl(folderPath: string) {
  return `https://controlsco.sharepoint.com/sites/TCCProjects/Shared%20Documents/${folderPath
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/")}`;
}

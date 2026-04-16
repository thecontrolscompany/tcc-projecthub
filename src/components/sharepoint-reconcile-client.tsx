"use client";

import { useEffect, useMemo, useState } from "react";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import { safeJson } from "@/lib/utils/safe-json";

type SharePointFolder = {
  id: string;
  name: string;
  path: string;
};

type ImportOrphan = {
  id: string;
  project_name: string | null;
  bid_year: number | null;
  status: string | null;
};

type ReconcileResponse = {
  sp_folders: SharePointFolder[];
  sp_orphans: SharePointFolder[];
  import_orphans: ImportOrphan[];
  linked_count: number;
};

type SuggestedMatch = SharePointFolder & {
  score: number;
};

const tabButtonClassName =
  "rounded-xl border px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-primary/30";

export function SharePointReconcileClient() {
  const [data, setData] = useState<ReconcileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"import" | "sharepoint">("import");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [skippedIds, setSkippedIds] = useState<Record<string, true>>({});
  const [browseAllIds, setBrowseAllIds] = useState<Record<string, true>>({});

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);

    setError(null);

    try {
      const response = await fetch("/api/opportunities/pursuits/reconcile", { cache: "no-store" });
      const json = (await safeJson(response)) as ReconcileResponse & { error?: string };
      if (!response.ok) throw new Error(json?.error ?? "Unable to load reconciliation data.");
      setData(json);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load reconciliation data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const visibleImportOrphans = useMemo(
    () => (data?.import_orphans ?? []).filter((orphan) => !skippedIds[orphan.id]),
    [data?.import_orphans, skippedIds]
  );

  async function handleLink(pursuitId: string, folder: SharePointFolder) {
    setSavingRowId(pursuitId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/opportunities/pursuits/reconcile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pursuit_id: pursuitId,
          folder_path: folder.path,
          folder_item_id: folder.id,
        }),
      });
      const json = (await safeJson(response)) as { error?: string };
      if (!response.ok) throw new Error(json?.error ?? "Unable to link pursuit.");

      setExpandedRowId(null);
      setMessage("Linked pursuit to SharePoint folder.");
      await loadData(true);
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Unable to link pursuit.");
    } finally {
      setSavingRowId(null);
    }
  }

  function handleSkip(pursuitId: string) {
    setSkippedIds((current) => ({ ...current, [pursuitId]: true }));
    if (expandedRowId === pursuitId) setExpandedRowId(null);
  }

  function handleToggleLink(orphanId: string, expanded: boolean) {
    setExpandedRowId(expanded ? null : orphanId);
    if (expanded) return;
    setBrowseAllIds((current) => {
      const next = { ...current };
      delete next[orphanId];
      return next;
    });
  }

  function handleBrowseAll(orphanId: string) {
    setBrowseAllIds((current) => ({ ...current, [orphanId]: true }));
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <OpportunityHubSubnav />
        <div className="rounded-2xl border border-border-default bg-surface-raised px-6 py-10 text-center text-sm text-text-tertiary">
          Loading reconciliation data...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OpportunityHubSubnav />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Opportunity Hub</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">SharePoint Reconciliation</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Link orphan pursuits to the right SharePoint folders and spot folders that still need a pursuit.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={refreshing}
          className="rounded-xl border border-border-default bg-surface-base px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-overlay disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 px-5 py-4 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-status-success/30 bg-status-success/10 px-5 py-4 text-sm text-status-success">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Linked pursuits" value={String(data?.linked_count ?? 0)} />
        <SummaryCard label="Import orphans" value={String(data?.import_orphans.length ?? 0)} />
        <SummaryCard label="SharePoint orphans" value={String(data?.sp_orphans.length ?? 0)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("import")}
          className={`${tabButtonClassName} ${
            tab === "import"
              ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
              : "border-border-default bg-surface-base text-text-secondary hover:bg-surface-overlay"
          }`}
        >
          Import orphans
        </button>
        <button
          type="button"
          onClick={() => setTab("sharepoint")}
          className={`${tabButtonClassName} ${
            tab === "sharepoint"
              ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
              : "border-border-default bg-surface-base text-text-secondary hover:bg-surface-overlay"
          }`}
        >
          SharePoint orphans
        </button>
      </div>

      {tab === "import" ? (
        <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
          <table className="min-w-full divide-y divide-border-subtle">
            <thead className="bg-surface-base">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                <th className="px-4 py-3">Pursuit name</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Top suggestion</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {visibleImportOrphans.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-tertiary">
                    No import orphans left to review.
                  </td>
                </tr>
              ) : (
                visibleImportOrphans.map((orphan) => {
                  const suggestions = suggestMatches(orphan.project_name ?? "", orphan.bid_year, data?.sp_folders ?? []);
                  const topSuggestion = suggestions[0] ?? null;
                  const isExpanded = expandedRowId === orphan.id;
                  const isSaving = savingRowId === orphan.id;
                  const isBrowsingAll = Boolean(browseAllIds[orphan.id]);
                  const browseAllFolders = (data?.sp_folders ?? []).filter(
                    (folder) => !suggestions.some((suggestion) => suggestion.id === folder.id)
                  );

                  return (
                    <tr key={orphan.id} className="align-top">
                      <td className="px-4 py-4">
                        <div className="font-medium text-text-primary">{orphan.project_name ?? "Untitled pursuit"}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-secondary">{orphan.bid_year ?? "-"}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={orphan.status ?? "unknown"} />
                      </td>
                      <td className="px-4 py-4">
                        {topSuggestion ? (
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-text-primary">{topSuggestion.name}</div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                              <span>{topSuggestion.path}</span>
                              <ScoreBadge score={topSuggestion.score} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-text-tertiary">No strong match</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleLink(orphan.id, isExpanded)}
                            className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-overlay"
                          >
                            Link
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSkip(orphan.id)}
                            className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-overlay"
                          >
                            Skip
                          </button>
                        </div>

                        {isExpanded ? (
                          <div className="mt-3 space-y-2 rounded-xl border border-border-default bg-surface-base p-3">
                            {suggestions.map((folder) => (
                              <button
                                key={folder.id}
                                type="button"
                                onClick={() => void handleLink(orphan.id, folder)}
                                disabled={isSaving}
                                className="flex w-full items-center justify-between rounded-lg border border-border-default px-3 py-2 text-left text-sm transition hover:bg-surface-overlay disabled:opacity-60"
                              >
                                <span className="min-w-0">
                                  <span className="block font-medium text-text-primary">{folder.name}</span>
                                  <span className="block truncate text-xs text-text-tertiary">{folder.path}</span>
                                </span>
                                <ScoreBadge score={folder.score} />
                              </button>
                            ))}

                            {!isBrowsingAll ? (
                              <button
                                type="button"
                                onClick={() => handleBrowseAll(orphan.id)}
                                className="flex w-full items-center justify-between rounded-lg border border-dashed border-border-subtle px-3 py-2 text-left text-sm text-text-secondary transition hover:bg-surface-overlay"
                              >
                                <span>Browse all</span>
                                <span className="text-xs text-text-tertiary">{browseAllFolders.length} more folders</span>
                              </button>
                            ) : null}

                            {isBrowsingAll
                              ? browseAllFolders.map((folder) => (
                                  <button
                                    key={folder.id}
                                    type="button"
                                    onClick={() => void handleLink(orphan.id, folder)}
                                    disabled={isSaving}
                                    className="flex w-full items-center justify-between rounded-lg border border-dashed border-border-subtle px-3 py-2 text-left text-sm transition hover:bg-surface-overlay disabled:opacity-60"
                                  >
                                    <span className="min-w-0">
                                      <span className="block font-medium text-text-primary">{folder.name}</span>
                                      <span className="block truncate text-xs text-text-tertiary">{folder.path}</span>
                                    </span>
                                    <span className="text-xs text-text-tertiary">Browse all</span>
                                  </button>
                                ))
                              : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
          <table className="min-w-full divide-y divide-border-subtle">
            <thead className="bg-surface-base">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                <th className="px-4 py-3">Folder name</th>
                <th className="px-4 py-3">Path</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {(data?.sp_orphans ?? []).length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-10 text-center text-sm text-text-tertiary">
                    No SharePoint orphans found.
                  </td>
                </tr>
              ) : (
                (data?.sp_orphans ?? []).map((folder) => (
                  <tr key={folder.id}>
                    <td className="px-4 py-4 text-sm font-medium text-text-primary">{folder.name}</td>
                    <td className="px-4 py-4 text-sm text-text-secondary">{folder.path}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function normalizeName(value: string) {
  return value
    .replace(/^QR-\d{4}-\d+\s*-\s*/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreFolderMatch(pursuitName: string, folderName: string) {
  const normalizedPursuit = normalizeName(pursuitName);
  const normalizedFolder = normalizeName(folderName);

  if (!normalizedPursuit || !normalizedFolder) return 0;
  if (normalizedPursuit === normalizedFolder) return 100;
  if (normalizedFolder.includes(normalizedPursuit) || normalizedPursuit.includes(normalizedFolder)) return 80;

  const pursuitTokens = normalizedPursuit.split(" ").filter((token) => token.length > 2);
  const folderTokens = new Set(normalizedFolder.split(" ").filter((token) => token.length > 2));
  if (pursuitTokens.length === 0 || folderTokens.size === 0) return 0;

  const overlapCount = pursuitTokens.filter((token) => folderTokens.has(token)).length;
  return Math.round((overlapCount / pursuitTokens.length) * 70);
}

function suggestMatches(pursuitName: string, bidYear: number | null, spFolders: SharePointFolder[]): SuggestedMatch[] {
  return spFolders
    .map((folder) => {
      let score = scoreFolderMatch(pursuitName, folder.name);
      if (bidYear && folder.name.includes(String(bidYear))) {
        score += 15;
      }
      return { ...folder, score };
    })
    .filter((folder) => folder.score >= 30)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-2 text-3xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className="rounded-full border border-brand-primary/30 bg-brand-primary/10 px-2 py-1 text-[11px] font-semibold text-brand-primary">
      {score}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    normalized === "awarded"
      ? "border-status-success/30 bg-status-success/10 text-status-success"
      : normalized === "lost"
        ? "border-status-danger/30 bg-status-danger/10 text-status-danger"
        : normalized === "passed"
          ? "border-status-warning/30 bg-status-warning/10 text-status-warning"
        : normalized === "archived"
          ? "border-border-default bg-surface-base text-text-secondary"
          : "border-status-warning/30 bg-status-warning/10 text-status-warning";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${tone}`}>
      {normalized === "passed" ? "No Bid" : status}
    </span>
  );
}

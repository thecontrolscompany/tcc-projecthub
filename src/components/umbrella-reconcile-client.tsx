"use client";

import { useEffect, useMemo, useState } from "react";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import { safeJson } from "@/lib/utils/safe-json";

type SuggestedFolder = {
  id: string;
  name: string;
  path: string;
  depth: number;
  child_count: number;
  score: number;
};

type UmbrellaPursuit = {
  id: string;
  project_name: string | null;
  owner_name: string | null;
  current_folder: string | null;
  current_item_id: string | null;
  suggestions: SuggestedFolder[];
};

type UmbrellaGroup = {
  sharepoint_folder: string;
  sharepoint_item_id: string;
  pursuit_count: number;
  candidate_folder_count: number;
  child_folders: SuggestedFolder[];
  pursuits: UmbrellaPursuit[];
};

type UmbrellaResponse = {
  umbrella_group_count: number;
  umbrella_pursuit_total: number;
  groups: UmbrellaGroup[];
};

export function UmbrellaReconcileClient() {
  const [data, setData] = useState<UmbrellaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedPursuitId, setExpandedPursuitId] = useState<string | null>(null);
  const [savingPursuitId, setSavingPursuitId] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);

    setError(null);

    try {
      const response = await fetch("/api/opportunities/pursuits/reconcile/umbrella", { cache: "no-store" });
      const json = (await safeJson(response)) as UmbrellaResponse & { error?: string };
      if (!response.ok) throw new Error(json?.error ?? "Unable to load umbrella-folder reconciliation data.");
      setData(json);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load umbrella-folder reconciliation data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleLink(pursuitId: string, folder: SuggestedFolder) {
    setSavingPursuitId(pursuitId);
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
      if (!response.ok) throw new Error(json?.error ?? "Unable to relink pursuit.");

      setExpandedPursuitId(null);
      setMessage("Updated pursuit to use the selected child folder.");
      await loadData(true);
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Unable to relink pursuit.");
    } finally {
      setSavingPursuitId(null);
    }
  }

  const groupStats = useMemo(
    () => ({
      groups: data?.umbrella_group_count ?? 0,
      pursuits: data?.umbrella_pursuit_total ?? 0,
      folders:
        data?.groups.reduce((sum, group) => sum + group.candidate_folder_count, 0) ?? 0,
    }),
    [data]
  );

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <OpportunityHubSubnav />
        <div className="rounded-2xl border border-border-default bg-surface-raised px-6 py-10 text-center text-sm text-text-tertiary">
          Loading umbrella-folder groups...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OpportunityHubSubnav />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">OpportunityHub</p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">Umbrella Folder Reconciliation</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Review shared parent folders, inspect likely child project folders, and relink each pursuit to the right
            SharePoint path.
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
        <SummaryCard label="Umbrella groups" value={String(groupStats.groups)} />
        <SummaryCard label="Shared pursuits" value={String(groupStats.pursuits)} />
        <SummaryCard label="Child folders scanned" value={String(groupStats.folders)} />
      </div>

      {(data?.groups ?? []).length === 0 ? (
        <div className="rounded-2xl border border-border-default bg-surface-raised px-6 py-10 text-center text-sm text-text-tertiary">
          No shared parent-folder groups are currently linked in SharePoint.
        </div>
      ) : (
        <div className="space-y-5">
          {(data?.groups ?? []).map((group) => (
            <section
              key={`${group.sharepoint_item_id}:${group.sharepoint_folder}`}
              className="rounded-2xl border border-border-default bg-surface-raised"
            >
              <div className="border-b border-border-subtle px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Parent folder</p>
                    <h2 className="mt-1 text-lg font-semibold text-text-primary">{group.sharepoint_folder}</h2>
                    <p className="mt-2 text-sm text-text-secondary">
                      {group.pursuit_count} pursuits share this parent link. {group.candidate_folder_count} descendant
                      folders were scanned for likely project matches.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border-default bg-surface-base px-3 py-2 text-xs text-text-tertiary">
                    Item ID: {group.sharepoint_item_id}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border-subtle">
                  <thead className="bg-surface-base">
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                      <th className="px-4 py-3">Pursuit</th>
                      <th className="px-4 py-3">Current link</th>
                      <th className="px-4 py-3">Top child-folder suggestions</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {group.pursuits.map((pursuit) => {
                      const topSuggestions = pursuit.suggestions.slice(0, 3);
                      const browseFolders =
                        pursuit.suggestions.length > 0
                          ? pursuit.suggestions
                          : group.child_folders;
                      const isExpanded = expandedPursuitId === pursuit.id;
                      const isSaving = savingPursuitId === pursuit.id;

                      return (
                        <tr key={pursuit.id} className="align-top">
                          <td className="px-4 py-4">
                            <div className="font-medium text-text-primary">
                              {pursuit.project_name ?? "Untitled pursuit"}
                            </div>
                            <div className="mt-1 text-xs text-text-tertiary">
                              Customer: {pursuit.owner_name ?? "Unknown"}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-text-secondary">
                            <div className="break-all">{pursuit.current_folder ?? "-"}</div>
                          </td>
                          <td className="px-4 py-4">
                            {topSuggestions.length === 0 ? (
                              <span className="text-sm text-text-tertiary">No strong child-folder match yet</span>
                            ) : (
                              <div className="space-y-2">
                                {topSuggestions.map((folder) => (
                                  <button
                                    key={folder.id}
                                    type="button"
                                    onClick={() => void handleLink(pursuit.id, folder)}
                                    disabled={isSaving}
                                    className="flex w-full items-center justify-between rounded-lg border border-border-default bg-surface-base px-3 py-2 text-left text-sm transition hover:bg-surface-overlay disabled:opacity-60"
                                  >
                                    <span className="min-w-0">
                                      <span className="block font-medium text-text-primary">{folder.name}</span>
                                      <span className="block truncate text-xs text-text-tertiary">{folder.path}</span>
                                    </span>
                                    <ScoreBadge score={folder.score} />
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() => setExpandedPursuitId(isExpanded ? null : pursuit.id)}
                              className="rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-overlay"
                            >
                              {isExpanded ? "Hide all folders" : "Browse all"}
                            </button>

                            {isExpanded ? (
                              <div className="mt-3 max-h-72 space-y-2 overflow-auto rounded-xl border border-border-default bg-surface-base p-3">
                                {browseFolders.map((folder) => (
                                  <button
                                    key={folder.id}
                                    type="button"
                                    onClick={() => void handleLink(pursuit.id, folder)}
                                    disabled={isSaving}
                                    className="flex w-full items-center justify-between rounded-lg border border-dashed border-border-subtle px-3 py-2 text-left text-sm transition hover:bg-surface-overlay disabled:opacity-60"
                                  >
                                    <span className="min-w-0">
                                      <span className="block font-medium text-text-primary">{folder.name}</span>
                                      <span className="block truncate text-xs text-text-tertiary">{folder.path}</span>
                                    </span>
                                    <ScoreBadge score={folder.score} />
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
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

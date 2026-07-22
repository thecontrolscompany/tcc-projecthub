"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProjectWalkthrough } from "@/types/database";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function WalkthroughsSection({ projectId }: { projectId: string }) {
  const [walkthroughs, setWalkthroughs] = useState<ProjectWalkthrough[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [recordedDate, setRecordedDate] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/project-walkthroughs?projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Failed to load walkthroughs.");
      setWalkthroughs((json?.walkthroughs ?? []) as ProjectWalkthrough[]);
    } catch (loadError) {
      setWalkthroughs([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load walkthroughs.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function addWalkthrough() {
    if (!shareUrl.trim()) {
      setError("Paste an Insta360 share URL.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/project-walkthroughs`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, shareUrl: shareUrl.trim(), recordedDate: recordedDate || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Failed to add walkthrough.");
      setShareUrl("");
      setRecordedDate("");
      await loadData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to add walkthrough.");
    } finally {
      setSaving(false);
    }
  }

  async function removeWalkthrough(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/project-walkthroughs`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Failed to delete walkthrough.");
      setWalkthroughs((current) => current.filter((row) => row.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete walkthrough.");
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h4 className="font-heading text-lg font-semibold text-text-primary">Walkthrough Videos</h4>
        <p className="mt-1 text-sm text-text-secondary">
          Paste an Insta360 cloud share link for each weekly walkthrough. Customers see a TCC-branded card that opens the
          360° player in a new tab. Title, duration, and cover image are pulled from the share link automatically.
        </p>
      </div>

      <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Insta360 share URL</label>
            <input
              type="url"
              value={shareUrl}
              onChange={(event) => setShareUrl(event.target.value)}
              placeholder="https://cloud-va.insta360.com/share/..."
              className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Recorded date</label>
            <input
              type="date"
              value={recordedDate}
              onChange={(event) => setRecordedDate(event.target.value)}
              className="rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={addWalkthrough}
            disabled={saving}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Adding…" : "Add walkthrough"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border-default bg-surface-raised">
        <div className="border-b border-border-default px-4 py-3">
          <p className="text-sm font-semibold text-text-primary">Walkthroughs on file</p>
          <p className="text-xs text-text-tertiary">
            {loading
              ? "Loading walkthroughs…"
              : `${walkthroughs.length} walkthrough${walkthroughs.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            <div className="h-16 animate-pulse rounded-xl bg-surface-overlay" />
            <div className="h-16 animate-pulse rounded-xl bg-surface-overlay" />
          </div>
        ) : walkthroughs.length === 0 ? (
          <div className="px-4 py-8 text-sm text-text-tertiary">No walkthroughs added yet.</div>
        ) : (
          <ul className="divide-y divide-border-default">
            {walkthroughs.map((walkthrough) => (
              <li key={walkthrough.id} className="flex items-center gap-4 px-4 py-3">
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-overlay">
                  {walkthrough.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={walkthrough.cover_image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-text-tertiary">360°</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{walkthrough.title || walkthrough.share_url}</p>
                  <p className="text-xs text-text-tertiary">
                    {formatDate(walkthrough.recorded_date)}
                    {walkthrough.duration ? ` · ${walkthrough.duration}` : ""}
                  </p>
                </div>
                <a
                  href={walkthrough.share_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
                >
                  Open
                </a>
                <button
                  type="button"
                  onClick={() => removeWalkthrough(walkthrough.id)}
                  className="rounded-lg border border-border-default bg-surface-base px-3 py-1.5 text-xs font-medium text-status-danger transition hover:bg-status-danger/10"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

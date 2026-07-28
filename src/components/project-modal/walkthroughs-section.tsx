"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProjectWalkthrough, WalkthroughWaypoint } from "@/types/database";

type WalkthroughMode = "insta360" | "psv";

function isWalkthroughWaypoint(point: unknown): point is WalkthroughWaypoint {
  if (typeof point !== "object" || point === null) return false;
  const candidate = point as Partial<WalkthroughWaypoint>;
  return (
    typeof candidate.t === "number" &&
    Number.isFinite(candidate.t) &&
    typeof candidate.x === "number" &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === "number" &&
    Number.isFinite(candidate.y)
  );
}

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
  const [mode, setMode] = useState<WalkthroughMode>("insta360");
  const [shareUrl, setShareUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [planUrl, setPlanUrl] = useState("");
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [waypointImageName, setWaypointImageName] = useState("");
  const [waypoints, setWaypoints] = useState<WalkthroughWaypoint[]>([]);
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

  async function loadWaypoints(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const parsed = JSON.parse(await file.text()) as {
        area?: unknown;
        image_name?: unknown;
        points?: unknown;
      };
      if (!Array.isArray(parsed.points)) {
        throw new Error("The selected JSON file does not contain a points array.");
      }
      const loadedPoints = parsed.points
        .filter(isWalkthroughWaypoint)
        .map((point) => ({ t: point.t, x: point.x, y: point.y }));
      if (loadedPoints.length === 0) {
        throw new Error("The selected JSON file does not contain any valid waypoints.");
      }
      const loadedArea = typeof parsed.area === "string" ? parsed.area.trim() : "";
      setWaypoints(loadedPoints);
      setArea(loadedArea);
      setWaypointImageName(typeof parsed.image_name === "string" ? parsed.image_name : "");
      if (!title.trim() && loadedArea) setTitle(loadedArea);
    } catch (loadError) {
      setWaypoints([]);
      setArea("");
      setWaypointImageName("");
      setError(loadError instanceof Error ? loadError.message : "Failed to read the waypoints file.");
    }
  }

  async function addWalkthrough() {
    if (mode === "insta360" && !shareUrl.trim()) {
      setError("Paste an Insta360 share URL.");
      return;
    }
    if (mode === "psv" && (!videoUrl.trim() || waypoints.length === 0)) {
      setError("Add the R2 video URL and load a click-along waypoints JSON file.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/project-walkthroughs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "psv"
            ? {
                projectId,
                playerType: "psv",
                videoUrl: videoUrl.trim(),
                planUrl: planUrl.trim() || undefined,
                waypoints,
                title: title.trim() || undefined,
                area: area || undefined,
                recordedDate: recordedDate || undefined,
              }
            : {
                projectId,
                playerType: "insta360",
                shareUrl: shareUrl.trim(),
                recordedDate: recordedDate || undefined,
              }
        ),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "Failed to add walkthrough.");
      setShareUrl("");
      setVideoUrl("");
      setPlanUrl("");
      setTitle("");
      setArea("");
      setWaypointImageName("");
      setWaypoints([]);
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
      const res = await fetch("/api/admin/project-walkthroughs", {
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

  const dateInput = (id: string) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Recorded date
      </label>
      <input
        id={id}
        type="date"
        value={recordedDate}
        onChange={(event) => setRecordedDate(event.target.value)}
        className="rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
      />
    </div>
  );

  const addButton = (
    <button
      type="button"
      onClick={addWalkthrough}
      disabled={saving}
      className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {saving ? "Adding…" : "Add walkthrough"}
    </button>
  );

  return (
    <section className="space-y-5">
      <div>
        <h4 className="font-heading text-lg font-semibold text-text-primary">Walkthrough Videos</h4>
        <p className="mt-1 text-sm text-text-secondary">
          Add an Insta360 cloud link or a self-hosted 360° video with a floor-plan position track. Customers open either
          player from the same TCC-branded walkthrough list.
        </p>
      </div>

      <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
        <div
          className="mb-4 inline-flex rounded-xl border border-border-default bg-surface-base p-1"
          role="group"
          aria-label="Walkthrough player type"
        >
          {(
            [
              ["insta360", "Insta360 link"],
              ["psv", "Self-hosted 360 + position"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setError(null);
              }}
              aria-pressed={mode === value}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                mode === value
                  ? "bg-brand-primary text-text-inverse"
                  : "text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "insta360" ? (
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div className="space-y-1.5">
              <label
                htmlFor="walkthrough-share-url"
                className="text-xs font-semibold uppercase tracking-wide text-text-secondary"
              >
                Insta360 share URL
              </label>
              <input
                id="walkthrough-share-url"
                type="url"
                value={shareUrl}
                onChange={(event) => setShareUrl(event.target.value)}
                placeholder="https://cloud-va.insta360.com/share/..."
                className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
              />
            </div>
            {dateInput("walkthrough-insta-date")}
            {addButton}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="walkthrough-video-url"
                  className="text-xs font-semibold uppercase tracking-wide text-text-secondary"
                >
                  Video URL
                </label>
                <input
                  id="walkthrough-video-url"
                  type="url"
                  value={videoUrl}
                  onChange={(event) => setVideoUrl(event.target.value)}
                  placeholder="https://media.example.com/walkthrough.mp4"
                  className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="walkthrough-plan-url"
                  className="text-xs font-semibold uppercase tracking-wide text-text-secondary"
                >
                  Plan image URL <span className="normal-case text-text-tertiary">(recommended)</span>
                </label>
                <input
                  id="walkthrough-plan-url"
                  type="url"
                  value={planUrl}
                  onChange={(event) => setPlanUrl(event.target.value)}
                  placeholder="https://media.example.com/floor-plan.png"
                  className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="walkthrough-waypoints"
                  className="text-xs font-semibold uppercase tracking-wide text-text-secondary"
                >
                  Waypoints JSON
                </label>
                <input
                  id="walkthrough-waypoints"
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => void loadWaypoints(event.target.files?.[0])}
                  className="block w-full text-xs text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-surface-overlay file:px-3 file:py-2 file:text-xs file:font-semibold file:text-text-primary hover:file:bg-surface-base"
                />
                {waypoints.length > 0 && (
                  <p className="text-xs text-status-success">
                    {waypoints.length} points loaded
                    {area ? ` · ${area}` : ""}
                    {waypointImageName ? ` · ${waypointImageName}` : ""}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="walkthrough-title"
                  className="text-xs font-semibold uppercase tracking-wide text-text-secondary"
                >
                  Title <span className="normal-case text-text-tertiary">(optional)</span>
                </label>
                <input
                  id="walkthrough-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Exterior walkthrough"
                  className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                />
              </div>
              {dateInput("walkthrough-psv-date")}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-text-tertiary">
                Use public or signed R2 URLs with GET/HEAD, Range, and cross-origin access enabled.
              </p>
              {addButton}
            </div>
          </div>
        )}
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
                    <img src={walkthrough.cover_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-text-tertiary">360°</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {walkthrough.title || walkthrough.share_url || "360 Walkthrough"}
                    </p>
                    {walkthrough.player_type === "psv" && (
                      <span className="shrink-0 rounded-full bg-brand-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-primary">
                        360 + position
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-tertiary">
                    {formatDate(walkthrough.recorded_date)}
                    {walkthrough.duration ? ` · ${walkthrough.duration}` : ""}
                  </p>
                </div>
                <a
                  href={
                    walkthrough.player_type === "psv"
                      ? `/psv-walkthrough-viewer.html?data=${encodeURIComponent(`/api/walkthroughs/${walkthrough.id}/data`)}&embed=1`
                      : walkthrough.share_url ?? "#"
                  }
                  target="_blank"
                  rel="noopener"
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

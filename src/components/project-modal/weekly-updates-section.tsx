"use client";

import { useEffect, useState } from "react";
import { ViewReportLink } from "@/components/view-report-link";
import { formatWeekEndingSaturday } from "@/lib/utils/week-ending";

type UpdateRow = {
  id: string;
  week_of: string;
  pct_complete: number | null;
  notes: string | null;
  blockers: string | null;
};

export function WeeklyUpdatesSection({ projectId }: { projectId: string }) {
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadUpdates() {
      setLoading(true);

      try {
        const res = await fetch(`/api/admin/data?section=project-weekly-updates&projectId=${encodeURIComponent(projectId)}`, {
          credentials: "include",
        });
        const json = await res.json();

        if (!active) return;

        if (!res.ok) {
          setUpdates([]);
        } else {
          setUpdates((json?.updates as UpdateRow[]) ?? []);
        }
      } catch {
        if (active) {
          setUpdates([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadUpdates();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <section className="space-y-3">
      <h4 className="font-heading text-lg font-semibold text-text-primary">Weekly Updates</h4>
      {loading ? (
        <p className="text-sm text-text-tertiary">Loading...</p>
      ) : updates.length === 0 ? (
        <p className="text-sm text-text-tertiary">No updates submitted yet.</p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {updates.map((u) => (
            <div key={u.id} className="rounded-xl border border-border-default bg-surface-raised p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-text-secondary">
                    Week ending {formatWeekEndingSaturday(u.week_of, "MMM d, yyyy")}
                  </span>
                  <ViewReportLink updateId={u.id} />
                </div>
                {u.pct_complete !== null && (
                  <span className="shrink-0 text-sm font-semibold text-brand-primary">
                    {(u.pct_complete * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              {u.notes && <p className="mt-1.5 text-sm text-text-secondary">{u.notes}</p>}
              {u.blockers && (
                <p className="mt-1 text-sm text-status-danger">Blocker: {u.blockers}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { OpsProjectList } from "@/components/ops-project-list";
import { FeedbackTab, WeeklyUpdatesTab } from "@/components/admin-weekly-feedback";
import type { OpsProjectListItem } from "@/app/ops/page";

type OpsTab = "projects" | "weekly-updates" | "feedback";

export function AdminOpsView() {
  const [opsTab, setOpsTab] = useState<OpsTab>("projects");
  const [projects, setProjects] = useState<OpsProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjects() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/admin/data?section=ops-projects", {
          credentials: "include",
        });
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json?.error ?? "Failed to load ops view.");
        }

        setProjects((json?.projects as OpsProjectListItem[]) ?? []);
      } catch (err) {
        setProjects([]);
        setError(err instanceof Error ? err.message : "Failed to load ops view.");
      } finally {
        setLoading(false);
      }
    }

    void loadProjects();
  }, []);

  return (
    <div className="space-y-4">
      <div className="border-b border-border-default">
        <div className="flex flex-wrap gap-2 pb-4">
          {(
            [
              { id: "projects", label: "Projects" },
              { id: "weekly-updates", label: "Weekly Updates" },
              { id: "feedback", label: "Feedback" },
            ] as { id: OpsTab; label: string }[]
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setOpsTab(id)}
              className={[
                "rounded-lg px-4 py-2.5 text-sm font-medium transition",
                opsTab === id
                  ? "bg-surface-overlay text-text-primary shadow-sm"
                  : "text-text-secondary hover:bg-surface-overlay/70 hover:text-text-primary",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {opsTab === "projects" &&
        (loading ? (
          <div className="py-10 text-center text-text-tertiary">Loading ops view...</div>
        ) : error ? (
          <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 px-6 py-5 text-sm text-status-danger">
            {error}
          </div>
        ) : (
          <OpsProjectList projects={projects} />
        ))}
      {opsTab === "weekly-updates" && <WeeklyUpdatesTab />}
      {opsTab === "feedback" && <FeedbackTab />}
    </div>
  );
}

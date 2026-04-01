"use client";

import { useEffect, useState } from "react";
import { OpsProjectList } from "@/components/ops-project-list";
import type { OpsProjectListItem } from "@/app/ops/page";

export function AdminOpsView() {
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

  if (loading) {
    return <div className="py-10 text-center text-text-tertiary">Loading ops view...</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 px-6 py-5 text-sm text-status-danger">
        {error}
      </div>
    );
  }

  return <OpsProjectList projects={projects} />;
}

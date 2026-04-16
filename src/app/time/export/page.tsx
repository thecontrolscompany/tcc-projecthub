"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TimeSubnav } from "@/components/time/time-subnav";
import { format, startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { safeJson } from "@/lib/utils/safe-json";

type ProjectOption = {
  id: string;
  name: string;
  job_number: string | null;
};

export default function TimeExportPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [start, setStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [end, setEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (!["admin", "ops_manager"].includes(profile?.role ?? "")) {
        router.replace("/login");
        return;
      }

      const { data: projectRows } = await supabase
        .from("projects")
        .select("id, name, job_number")
        .order("name");

      if (!active) return;

      setProjects((projectRows ?? []) as ProjectOption[]);
      setReady(true);
    }

    void load();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleExport() {
    if (!projectId || !start || !end) return;

    setLoading(true);
    setWarning(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/time/export?projectId=${encodeURIComponent(projectId)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        { credentials: "include" }
      );

      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("application/json")) {
        const json = await safeJson(response);
        if (!response.ok) {
          throw new Error(json?.error ?? "Export failed.");
        }
        if (json?.warning) {
          setWarning(json.warning);
          return;
        }
      }

      if (!response.ok) {
        throw new Error("Export failed.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename=\"([^\"]+)\"/);
      const filename = filenameMatch?.[1] ?? `time-export-${projectId}-${start}-to-${end}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Export failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
          <p className="text-sm text-text-secondary">Loading time export...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TimeSubnav />
      <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Project Time Export</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-text-primary">Export QuickBooks Time entries</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
          Export QuickBooks Time entries for a selected project and date range to Excel.
        </p>

        <div className="mt-6 grid gap-4 md:max-w-2xl">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-text-primary">Project</span>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary"
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}{project.job_number ? ` - ${project.job_number}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-text-primary">Start Date</span>
            <input
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-text-primary">End Date</span>
            <input
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary"
            />
          </label>

          <div>
            <button
              type="button"
              onClick={handleExport}
              disabled={!projectId || !start || !end || loading}
              className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Exporting..." : "Export to Excel"}
            </button>
          </div>
        </div>
      </section>

      {warning && (
        <div className="rounded-2xl border border-status-warning/30 bg-status-warning/10 px-5 py-4 text-sm text-status-warning">
          {warning}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-status-danger/30 bg-status-danger/10 px-5 py-4 text-sm text-status-danger">
          {error}
        </div>
      )}
    </div>
  );
}

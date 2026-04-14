"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import type { ProjectReconcileSnapshot } from "@/lib/time/data";

type PendingState = Record<number, "map" | "ignore" | undefined>;

export function TimeReconcileProjectsPage({ snapshot }: { snapshot: ProjectReconcileSnapshot }) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Project Reconcile</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-text-primary">Map imported jobcodes to portal projects</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
          This admin queue shows QuickBooks Time jobcodes that have no matching ProjectHub project yet.
          Map them to an existing project or ignore them to remove them from the queue.
        </p>
      </section>

      <TimeReconcileProjectsPanel snapshot={snapshot} />
    </div>
  );
}

export function TimeReconcileProjectsPanel({ snapshot }: { snapshot: ProjectReconcileSnapshot }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingState>({});
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});

  async function runAction(
    qbJobcodeId: number,
    payload:
      | { action: "map_existing_project"; projectId: string }
      | { action: "ignore_jobcode" },
    pendingState: "map" | "ignore"
  ) {
    setPending((current) => ({ ...current, [qbJobcodeId]: pendingState }));
    setErrors((current) => ({ ...current, [qbJobcodeId]: "" }));
    setMessages((current) => ({ ...current, [qbJobcodeId]: "" }));

    try {
      const response = await fetch("/api/time/reconcile/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qbJobcodeId, ...payload })
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Action failed.");
      }

      const message =
        payload.action === "ignore_jobcode" ? "Ignored for now." : "Mapping saved.";

      setMessages((current) => ({ ...current, [qbJobcodeId]: message }));
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [qbJobcodeId]: error instanceof Error ? error.message : "Action failed."
      }));
    } finally {
      setPending((current) => ({ ...current, [qbJobcodeId]: undefined }));
    }
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Unmatched jobcodes" value={String(snapshot.jobcodes.length)} />
        <MetricCard label="Mapped already" value={String(snapshot.mappedCount)} />
        <MetricCard label="Ignored for now" value={String(snapshot.ignoredCount)} />
      </div>

      <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
        <div className="space-y-4">
          {snapshot.jobcodes.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-900">
              No unmatched QuickBooks jobcodes are waiting in the reconciliation queue.
            </div>
          ) : (
            snapshot.jobcodes.map((jobcode) => {
              const pendingState = pending[jobcode.qbJobcodeId];

              return (
                <article key={jobcode.qbJobcodeId} className="rounded-2xl border border-border-default bg-surface-overlay p-4">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2 xl:max-w-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-text-primary">{jobcode.name}</h2>
                        <StateChip label={jobcode.active ? "active" : "inactive"} tone={jobcode.active ? "success" : "warn"} />
                        {jobcode.billable && <StateChip label="billable" tone="info" />}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
                        <span>QB jobcode ID: {jobcode.qbJobcodeId}</span>
                        {jobcode.type && <span>Type: {jobcode.type}</span>}
                      </div>
                    </div>

                    <div className="grid flex-1 gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                      <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">Possible portal projects</p>
                        <div className="mt-3 space-y-3">
                          {jobcode.suggestions.length === 0 ? (
                            <p className="text-sm text-text-secondary">No strong project suggestions found.</p>
                          ) : (
                            jobcode.suggestions.map((candidate) => (
                              <div key={candidate.id} className="rounded-2xl border border-border-default bg-surface-overlay px-4 py-3">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                  <div>
                                    <p className="font-medium text-text-primary">{candidate.name}</p>
                                    <p className="text-sm text-text-secondary">
                                      {candidate.projectNumber ? `${candidate.projectNumber} · ` : ""}
                                      {candidate.customerName ?? "No customer"}
                                    </p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-text-tertiary">
                                      {candidate.isActive ? "active" : "inactive"} · score {candidate.score}
                                    </p>
                                    <p className="mt-2 text-sm text-text-secondary">{candidate.reasons.join(" · ")}</p>
                                  </div>
                                  <button
                                    onClick={() =>
                                      runAction(
                                        jobcode.qbJobcodeId,
                                        { action: "map_existing_project", projectId: candidate.id },
                                        "map"
                                      )
                                    }
                                    disabled={Boolean(pendingState)}
                                    className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {pendingState === "map" ? "Saving..." : "Map to this project"}
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">Ignore</p>
                        <p className="mt-2 text-sm text-text-secondary">
                          Removes this jobcode from the active queue without creating a mapping.
                        </p>
                        <button
                          onClick={() => runAction(jobcode.qbJobcodeId, { action: "ignore_jobcode" }, "ignore")}
                          disabled={Boolean(pendingState)}
                          className="mt-4 w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {pendingState === "ignore" ? "Ignoring..." : "Ignore for now"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {messages[jobcode.qbJobcodeId] && (
                    <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                      {messages[jobcode.qbJobcodeId]}
                    </p>
                  )}

                  {errors[jobcode.qbJobcodeId] && (
                    <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                      {errors[jobcode.qbJobcodeId]}
                    </p>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function StateChip({
  label,
  tone
}: {
  label: string;
  tone: "success" | "warn" | "info";
}) {
  const classes =
    tone === "success"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "warn"
        ? "bg-amber-100 text-amber-800"
        : "bg-sky-100 text-sky-800";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${classes}`}>
      {label}
    </span>
  );
}

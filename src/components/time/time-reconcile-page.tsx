"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import type { UserRole } from "@/types/database";
import type { TimeReconcileSnapshot } from "@/lib/time/data";

type PendingState = Record<number, "map" | "create" | "ignore" | undefined>;
type RoleState = Record<number, UserRole | undefined>;

const DEFAULT_ROLE: UserRole = "installer";
const ROLE_OPTIONS: UserRole[] = ["installer", "lead", "pm", "ops_manager", "admin", "customer"];

export function TimeReconcilePage({ snapshot }: { snapshot: TimeReconcileSnapshot }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingState>({});
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [selectedRoles, setSelectedRoles] = useState<RoleState>({});

  async function runAction(
    qbUserId: number,
    payload:
      | { action: "map_existing_profile"; profileId: string }
      | { action: "create_portal_user"; role: UserRole }
      | { action: "ignore_user" },
    pendingState: "map" | "create" | "ignore"
  ) {
    setPending((current) => ({ ...current, [qbUserId]: pendingState }));
    setErrors((current) => ({ ...current, [qbUserId]: "" }));
    setMessages((current) => ({ ...current, [qbUserId]: "" }));

    try {
      const response = await fetch("/api/time/reconcile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          qbUserId,
          ...payload
        })
      });

      const result = (await response.json()) as {
        error?: string;
        tempPassword?: string;
        createdUser?: { email: string; role: string };
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Action failed.");
      }

      const message =
        payload.action === "create_portal_user" && result.createdUser
          ? `Created ${result.createdUser.email} with temporary password: ${result.tempPassword}`
          : payload.action === "ignore_user"
            ? "Ignored for now."
            : "Mapping saved.";

      setMessages((current) => ({ ...current, [qbUserId]: message }));
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [qbUserId]: error instanceof Error ? error.message : "Action failed."
      }));
    } finally {
      setPending((current) => ({ ...current, [qbUserId]: undefined }));
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Time Reconcile</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-text-primary">Map imported employees to portal users</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
          This admin queue shows QuickBooks Time users that are still unmatched in ProjectHub. You can
          map them to an existing portal profile, create a new portal user, or ignore them for now.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Unmatched users" value={String(snapshot.users.length)} />
        <MetricCard label="Mapped already" value={String(snapshot.mappedCount)} />
        <MetricCard label="Ignored for now" value={String(snapshot.ignoredCount)} />
      </div>

      <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
        <div className="space-y-4">
          {snapshot.users.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-900">
              No unmatched QuickBooks users are waiting in the reconciliation queue.
            </div>
          ) : (
            snapshot.users.map((user) => {
              const pendingState = pending[user.qbUserId];
              const role = selectedRoles[user.qbUserId] ?? DEFAULT_ROLE;

              return (
                <article key={user.qbUserId} className="rounded-2xl border border-border-default bg-surface-overlay p-4">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2 xl:max-w-md">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-text-primary">{user.displayName}</h2>
                        <StateChip label={user.active ? "active" : "inactive"} tone={user.active ? "success" : "warn"} />
                      </div>
                      <p className="text-sm text-text-secondary">{user.email || "No email on QuickBooks record"}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
                        <span>QB user ID: {user.qbUserId}</span>
                        <span>Username: {user.username || "Not set"}</span>
                        <span>Payroll ID: {user.payrollId || "Not set"}</span>
                      </div>
                    </div>

                    <div className="grid flex-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                      <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">Possible portal profiles</p>
                        <div className="mt-3 space-y-3">
                          {user.suggestions.length === 0 ? (
                            <p className="text-sm text-text-secondary">No strong profile suggestions yet.</p>
                          ) : (
                            user.suggestions.map((candidate) => (
                              <div key={candidate.id} className="rounded-2xl border border-border-default bg-surface-overlay px-4 py-3">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                  <div>
                                    <p className="font-medium text-text-primary">{candidate.fullName}</p>
                                    <p className="text-sm text-text-secondary">{candidate.email}</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-text-tertiary">
                                      {candidate.role} • score {candidate.score}
                                    </p>
                                    <p className="mt-2 text-sm text-text-secondary">{candidate.reasons.join(" • ")}</p>
                                  </div>
                                  <button
                                    onClick={() =>
                                      runAction(
                                        user.qbUserId,
                                        { action: "map_existing_profile", profileId: candidate.id },
                                        "map"
                                      )
                                    }
                                    disabled={Boolean(pendingState)}
                                    className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {pendingState === "map" ? "Saving..." : "Map existing profile"}
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">Create portal user</p>
                          <p className="mt-2 text-sm text-text-secondary">
                            Creates a new ProjectHub login using the QuickBooks email and maps it immediately.
                          </p>

                          <label className="mt-4 block text-sm font-medium text-text-primary">
                            Role
                            <select
                              value={role}
                              onChange={(event) =>
                                setSelectedRoles((current) => ({
                                  ...current,
                                  [user.qbUserId]: event.target.value as UserRole
                                }))
                              }
                              className="mt-2 w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary"
                            >
                              {ROLE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>

                          <button
                            onClick={() =>
                              runAction(user.qbUserId, { action: "create_portal_user", role }, "create")
                            }
                            disabled={Boolean(pendingState) || !user.email}
                            className="mt-4 w-full rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm font-medium text-text-primary hover:border-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {pendingState === "create" ? "Creating..." : "Create portal user"}
                          </button>
                          {!user.email && (
                            <p className="mt-2 text-xs text-amber-700">An email address is required before a portal user can be created automatically.</p>
                          )}
                        </div>

                        <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">Ignore</p>
                          <p className="mt-2 text-sm text-text-secondary">
                            Removes this person from the active queue without creating a mapping.
                          </p>
                          <button
                            onClick={() => runAction(user.qbUserId, { action: "ignore_user" }, "ignore")}
                            disabled={Boolean(pendingState)}
                            className="mt-4 w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {pendingState === "ignore" ? "Ignoring..." : "Ignore for now"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {messages[user.qbUserId] && (
                    <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                      {messages[user.qbUserId]}
                    </p>
                  )}

                  {errors[user.qbUserId] && (
                    <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                      {errors[user.qbUserId]}
                    </p>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
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
  tone: "success" | "warn";
}) {
  const classes = tone === "success" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${classes}`}>
      {label}
    </span>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import type { TimeReconcileSnapshot } from "@/lib/time/data";
import type { UserRole } from "@/types/database";

type PendingState = Record<number, "map" | "create" | "ignore" | undefined>;
type ManualPickState = Record<number, string | undefined>;
type RolePickState = Record<number, UserRole | undefined>;

export function TimeReconcilePage({ snapshot }: { snapshot: TimeReconcileSnapshot }) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Time Reconcile</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-text-primary">Map imported employees to portal users</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
          This admin queue shows QuickBooks Time users that are still unmatched in ProjectHub. Use the
          suggested people records when possible, or pick any contact manually from the directory.
        </p>
      </section>

      <TimeReconcileUsersPanel snapshot={snapshot} />
    </div>
  );
}

export function TimeReconcileUsersPanel({ snapshot }: { snapshot: TimeReconcileSnapshot }) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingState>({});
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [manualPicks, setManualPicks] = useState<ManualPickState>({});
  const [rolePicks, setRolePicks] = useState<RolePickState>({});
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleUsers = normalizedQuery
    ? snapshot.users.filter((user) =>
        [user.displayName, user.email, user.username, String(user.qbUserId)]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      )
    : snapshot.users;

  async function runAction(
    qbUserId: number,
    payload:
      | { action: "map_existing_profile"; pmDirectoryId: string }
      | { action: "create_projecthub_user"; role: UserRole }
      | { action: "ignore_user" },
    pendingState: "map" | "create" | "ignore"
  ) {
    setPending((current) => ({ ...current, [qbUserId]: pendingState }));
    setErrors((current) => ({ ...current, [qbUserId]: "" }));
    setMessages((current) => ({ ...current, [qbUserId]: "" }));

    try {
      const response = await fetch("/api/time/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qbUserId, ...payload })
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Action failed.");
      }

      setMessages((current) => ({
        ...current,
        [qbUserId]:
          payload.action === "ignore_user"
            ? "Ignored for now."
            : payload.action === "create_projecthub_user"
              ? "ProjectHub user created and mapped."
              : "Mapping saved."
      }));
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
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Unmatched users" value={String(snapshot.users.length)} />
        <MetricCard label="Mapped already" value={String(snapshot.mappedCount)} />
        <MetricCard label="Ignored for now" value={String(snapshot.ignoredCount)} />
      </div>

      <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-text-tertiary">Unmatched QB Users</p>
            <h2 className="mt-2 text-xl font-semibold text-text-primary">Create or map ProjectHub users</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
              Search for the QuickBooks employee, then use Create ProjectHub user when they do not already exist in ProjectHub.
            </p>
          </div>
          <label className="min-w-0 lg:w-80">
            <span className="mb-1 block text-xs font-medium text-text-secondary">Search QB users</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="William Caldwell"
              className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </label>
        </div>

        <div className="space-y-4">
          {snapshot.users.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-900">
              No unmatched QuickBooks users are waiting in the reconciliation queue.
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="rounded-2xl border border-border-default bg-surface-overlay px-4 py-5 text-sm text-text-secondary">
              No unmatched QuickBooks users match this search.
            </div>
          ) : (
            visibleUsers.map((user) => {
              const pendingState = pending[user.qbUserId];
              const manualPickId = manualPicks[user.qbUserId] ?? "";
              const rolePick = rolePicks[user.qbUserId] ?? "installer";

              return (
                <article key={user.qbUserId} className="rounded-2xl border border-border-default bg-surface-overlay p-4">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2 xl:max-w-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-text-primary">{user.displayName}</h2>
                        <StateChip label={user.active ? "active" : "inactive"} tone={user.active ? "success" : "warn"} />
                      </div>
                      <p className="text-sm text-text-secondary">{user.email || "No email on QuickBooks record"}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
                        <span>QB ID: {user.qbUserId}</span>
                        {user.username && <span>Username: {user.username}</span>}
                        {user.payrollId && <span>Payroll: {user.payrollId}</span>}
                      </div>
                    </div>

                    <div className="grid flex-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                      <div className="space-y-3">
                        <div className="rounded-2xl border-2 border-brand-primary/40 bg-brand-primary/5 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
                            New ProjectHub user
                          </p>
                          <p className="mt-1 text-sm text-text-secondary">
                            Use this when the QuickBooks employee is not in ProjectHub yet.
                          </p>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <select
                              value={rolePick}
                              onChange={(e) =>
                                setRolePicks((current) => ({
                                  ...current,
                                  [user.qbUserId]: e.target.value as UserRole,
                                }))
                              }
                              className="flex-1 rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary"
                              aria-label={`ProjectHub role for ${user.displayName}`}
                            >
                              <option value="installer">installer</option>
                              <option value="lead">lead</option>
                              <option value="pm">pm</option>
                              <option value="ops_manager">ops_manager</option>
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                runAction(
                                  user.qbUserId,
                                  { action: "create_projecthub_user", role: rolePick },
                                  "create"
                                )
                              }
                              disabled={!user.email || Boolean(pendingState)}
                              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {pendingState === "create" ? "Creating..." : "Create ProjectHub user"}
                            </button>
                          </div>
                          {!user.email && (
                            <p className="mt-2 text-xs text-amber-700">
                              Add an email to the QuickBooks user before creating a ProjectHub account.
                            </p>
                          )}
                        </div>

                        <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">
                            Suggested matches
                          </p>
                          <div className="mt-3 space-y-3">
                            {user.suggestions.length === 0 ? (
                              <p className="text-sm text-text-secondary">No automatic suggestions. Use the manual picker below.</p>
                            ) : (
                              user.suggestions.map((candidate) => (
                                <div key={candidate.id} className="rounded-2xl border border-border-default bg-surface-overlay px-4 py-3">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium text-text-primary">{candidate.fullName}</p>
                                        <StateChip
                                          label={candidate.hasPortalAccount ? "portal active" : "no portal account"}
                                          tone={candidate.hasPortalAccount ? "success" : "warn"}
                                        />
                                      </div>
                                      <p className="text-sm text-text-secondary">{candidate.email}</p>
                                      <div className="mt-1 flex flex-wrap gap-4 text-xs uppercase tracking-[0.16em] text-text-tertiary">
                                        <span>{candidate.profileRole ?? "no role"}</span>
                                        <span>score {candidate.score}</span>
                                        {candidate.phone && <span>Phone: {candidate.phone}</span>}
                                      </div>
                                      <p className="mt-1 text-sm text-text-secondary">{candidate.reasons.join(" · ")}</p>
                                    </div>
                                    <div className="shrink-0">
                                      <button
                                        onClick={() =>
                                          runAction(
                                            user.qbUserId,
                                            { action: "map_existing_profile", pmDirectoryId: candidate.id },
                                            "map"
                                          )
                                        }
                                        disabled={Boolean(pendingState)}
                                        className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {pendingState === "map" ? "Saving..." : "Map"}
                                      </button>
                                      {!candidate.hasPortalAccount && (
                                        <p className="mt-1 text-xs text-text-secondary">A portal account will be created automatically.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">Pick manually</p>
                          <p className="mt-1 text-sm text-text-secondary">
                            Choose any people record if the suggestions missed the right person.
                          </p>
                          <div className="mt-3 flex gap-2">
                            <select
                              value={manualPickId}
                              onChange={(e) =>
                                setManualPicks((current) => ({ ...current, [user.qbUserId]: e.target.value }))
                              }
                              className="flex-1 rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary"
                            >
                              <option value="">Select a contact…</option>
                              {snapshot.eligibleProfiles.map((profile) => (
                                <option key={profile.id} value={profile.id}>
                                  {profile.fullName} ({profile.email})
                                  {profile.phone ? ` · ${profile.phone}` : ""}
                                  {" · "}
                                  {profile.role ?? (profile.profileId ? "portal user" : "no portal account")}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                if (manualPickId) {
                                  runAction(
                                    user.qbUserId,
                                    { action: "map_existing_profile", pmDirectoryId: manualPickId },
                                    "map"
                                  );
                                }
                              }}
                              disabled={!manualPickId || Boolean(pendingState)}
                              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {pendingState === "map" ? "Saving..." : "Map"}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">Ignore</p>
                          <p className="mt-2 text-sm text-text-secondary">
                            Remove from queue without mapping.
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

function StateChip({ label, tone }: { label: string; tone: "success" | "warn" }) {
  const classes = tone === "success" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800";
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${classes}`}>
      {label}
    </span>
  );
}

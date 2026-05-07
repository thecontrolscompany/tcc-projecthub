"use client";

import { useEffect, useState } from "react";
import { safeJson } from "@/lib/utils/safe-json";

type UserActivityRow = {
  profile_id: string | null;
  email: string | null;
  full_name: string | null;
  role: string | null;
  event_type: string;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: unknown;
};

export function AdminUserActivityPage() {
  const [activity, setActivity] = useState<UserActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityUnavailable, setActivityUnavailable] = useState(false);

  useEffect(() => {
    async function loadActivity() {
      setError(null);
      const response = await fetch("/api/admin/data?section=users", {
        credentials: "include",
      });
      const json = await safeJson(response);
      if (!response.ok) {
        setError(json?.error ?? "Failed to load user activity.");
      } else {
        setActivity((json?.recentActivity as UserActivityRow[]) ?? []);
        setActivityUnavailable(Boolean(json?.activityUnavailable));
      }
      setLoading(false);
    }

    void loadActivity();
  }, []);

  const loginCount = activity.filter((event) => event.event_type === "login_success").length;
  const logoutCount = activity.filter((event) => event.event_type === "logout").length;
  const failedCount = activity.filter((event) => event.event_type === "login_failed").length;
  const passwordCount = activity.filter((event) => event.event_type === "password_changed").length;

  return (
    <main className="mx-auto max-w-screen-xl space-y-6 px-6 py-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-primary">AdminHub</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-text-primary">User Activity</h1>
        <p className="mt-3 max-w-3xl text-sm text-text-secondary">
          Audit trail for login, logout, password, and portal access events across internal and customer users.
        </p>
      </section>

      {activityUnavailable && (
        <div className="rounded-xl bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
          User activity tracking is not available until the latest database migration has been applied.
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-status-danger/10 px-4 py-3 text-sm text-status-danger">{error}</div>
      )}

      {loading ? (
        <div className="py-10 text-center text-text-tertiary">Loading...</div>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <StatCard label="Logins" value={String(loginCount)} />
            <StatCard label="Logouts" value={String(logoutCount)} />
            <StatCard label="Failed Logins" value={String(failedCount)} />
            <StatCard label="Password Changes" value={String(passwordCount)} />
          </section>

          <section className="rounded-2xl border border-border-default bg-surface-raised">
            <div className="border-b border-border-default px-4 py-3">
              <h2 className="font-heading text-lg font-semibold text-text-primary">Recent Activity</h2>
              <p className="mt-1 text-xs text-text-secondary">Showing the latest {activity.length} recorded events.</p>
            </div>
            <div>
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-surface-raised">
                    <th className="w-[16%] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Time</th>
                    <th className="w-[16%] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Event</th>
                    <th className="w-[28%] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">User</th>
                    <th className="w-[10%] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Role</th>
                    <th className="w-[14%] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">IP</th>
                    <th className="w-[16%] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.length > 0 ? (
                    activity.map((event, index) => (
                      <tr key={`${event.created_at}-${event.event_type}-${event.email ?? index}`} className="border-b border-border-default">
                        <td className="px-4 py-2.5 text-text-secondary">{formatActivityDate(event.created_at)}</td>
                        <td className="px-4 py-2.5">
                          <span className="rounded-full bg-surface-overlay px-2.5 py-0.5 text-xs font-medium text-text-primary">
                            {formatEventType(event.event_type)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="break-words text-text-primary">{event.full_name ?? event.email ?? "Unknown user"}</div>
                          {event.email && <div className="break-all text-xs text-text-tertiary">{event.email}</div>}
                        </td>
                        <td className="break-words px-4 py-2.5 text-text-secondary">{event.role ?? "-"}</td>
                        <td className="break-all px-4 py-2.5 text-text-secondary">{event.ip_address ?? "-"}</td>
                        <td className="break-words px-4 py-2.5 text-xs text-text-tertiary">{formatMetadata(event.metadata)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-text-tertiary">No activity recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-2 text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

function formatActivityDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatEventType(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMetadata(value: unknown) {
  if (!value || typeof value !== "object") return "-";
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== null && entryValue !== undefined && entryValue !== "")
    .map(([key, entryValue]) => `${key}: ${String(entryValue)}`);
  return entries.length > 0 ? entries.join(", ") : "-";
}

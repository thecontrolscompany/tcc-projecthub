"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

export default function UserManagementPage() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfiles() {
    const { data } = await supabase.from("profiles").select("*").order("role").order("email");
    if (data) setProfiles(data as Profile[]);
    setLoading(false);
  }

  async function handleUpdateRole(userId: string, newRole: string) {
    await supabase.from("profiles").update({ role: newRole }).eq("id", userId);
    loadProfiles();
  }

  const roleBadge = (role: string) => {
    const styles: Record<string, string> = {
      admin: "bg-brand-primary/10 text-brand-primary",
      pm: "bg-status-info/10 text-status-info",
      customer: "bg-status-success/10 text-status-success",
    };
    return styles[role] ?? "bg-surface-overlay text-text-tertiary";
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-6">
      <h1 className="font-heading text-2xl font-bold text-text-primary">User Management</h1>

      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Manage roles for all users. Admin and PM users sign in with Microsoft SSO.
          Customer accounts are created here with email + password.
        </p>
        <button
          onClick={() => setShowCreateForm(true)}
          className="shrink-0 rounded-xl bg-brand-primary px-4 py-1.5 text-sm font-semibold text-text-inverse hover:bg-brand-hover"
        >
          + Create Customer Account
        </button>
      </div>

      {showCreateForm && (
        <CreateCustomerForm
          onClose={() => setShowCreateForm(false)}
          onCreated={() => {
            setShowCreateForm(false);
            loadProfiles();
          }}
        />
      )}

      {loading ? (
        <div className="py-10 text-center text-text-tertiary">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-raised">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Email</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Role</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Change Role</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-border-default hover:bg-surface-raised">
                  <td className="px-4 py-2.5 text-text-secondary">{p.email}</td>
                  <td className="px-4 py-2.5 text-text-primary">{p.full_name ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadge(p.role)}`}>
                      {p.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      defaultValue={p.role}
                      onChange={(e) => handleUpdateRole(p.id, e.target.value)}
                      className="rounded-lg border border-border-default bg-surface-overlay px-2 py-1 text-xs text-text-primary focus:border-brand-primary focus:outline-none"
                    >
                      <option value="admin">admin</option>
                      <option value="pm">pm</option>
                      <option value="customer">customer</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreateCustomerForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fullName, password, role: "customer" }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to create user.");
      setSaving(false);
    } else {
      onCreated();
    }
  }

  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
      <h3 className="mb-4 font-semibold text-text-primary">Create Customer Account</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">
            Temporary password <span className="text-text-tertiary">(customer will be prompted to change)</span>
          </label>
          <input
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
            placeholder="min 8 characters"
          />
        </div>

        {error && <p className="rounded-xl bg-status-danger/10 px-3 py-2 text-sm text-status-danger">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-brand-hover disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Account"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-surface-overlay px-4 py-2 text-sm text-text-secondary hover:bg-surface-overlay"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

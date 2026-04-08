"use client";

import { useEffect, useState } from "react";
import type { Profile, ProjectCustomerContact } from "@/types/database";

export function CustomerContactsSection({ projectId }: { projectId: string }) {
  const [contacts, setContacts] = useState<(ProjectCustomerContact & { profile: Profile })[]>([]);
  const [availableContacts, setAvailableContacts] = useState<Array<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    profile_id: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [portalAccountMessage, setPortalAccountMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/admin/data?section=project-customer-contacts&projectId=${encodeURIComponent(projectId)}`, {
          credentials: "include",
        });
        const json = await response.json();
        setContacts((((response.ok ? json?.contacts : []) ?? []) as (ProjectCustomerContact & { profile: Profile })[]));
        setAvailableContacts((((response.ok ? json?.availableContacts : []) ?? []) as Array<{
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          profile_id: string | null;
        }>));
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const existingIds = new Set(contacts.map((c) => c.profile_id));
  const availableToAdd = availableContacts.filter((contact) => !contact.profile_id || !existingIds.has(contact.profile_id));

  async function handleAdd() {
    if (!selectedContactId) return;
    setAdding(true);
    setAddError(null);
    setPortalAccountMessage(null);
    const res = await fetch("/api/admin/project-portal-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId, pmDirectoryId: selectedContactId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setAddError(json.error ?? "Failed to add contact.");
    } else if (json?.contact) {
      setContacts((prev) => {
        const next = prev.filter((item) => item.profile_id !== json.contact.profile_id);
        return [...next, json.contact as ProjectCustomerContact & { profile: Profile }];
      });
      if (typeof json?.createdAccountEmail === "string" && json.createdAccountEmail) {
        setPortalAccountMessage(`A portal account was created for ${json.createdAccountEmail}. They can use Forgot Password to set their password.`);
      }
      setSelectedContactId("");
    }
    setAdding(false);
  }

  async function handleToggle(profileId: string, field: "portal_access" | "email_digest", value: boolean) {
    setContacts((prev) => prev.map((c) => {
      if (c.profile_id !== profileId) return c;
      if (field === "portal_access" && !value) {
        return { ...c, portal_access: false, email_digest: false };
      }
      return { ...c, [field]: value };
    }));
    const res = await fetch("/api/admin/project-portal-contact", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId, profileId, field, value }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setAddError(json?.error ?? "Failed to update contact.");
    }
  }

  async function handleRemove(profileId: string) {
    const res = await fetch("/api/admin/project-portal-contact", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId, profileId }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setAddError(json?.error ?? "Failed to remove contact.");
      return;
    }
    setContacts((prev) => prev.filter((c) => c.profile_id !== profileId));
  }

  return (
    <section className="space-y-3">
      <h4 className="font-heading text-lg font-semibold text-text-primary">Customer Portal Access</h4>
      <p className="text-xs text-text-secondary">
        Add customer accounts and set whether they can view this project in the portal and/or receive email digests.
      </p>

      {loading ? (
        <p className="text-sm text-text-tertiary">Loading...</p>
      ) : (
        <div className="space-y-2">
          {contacts.length === 0 && (
            <p className="text-sm text-text-tertiary">No customer contacts added yet.</p>
          )}
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-raised px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{c.profile?.full_name || c.profile?.email}</p>
                <p className="truncate text-xs text-text-tertiary">{c.profile?.email}</p>
              </div>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={c.portal_access}
                  onChange={(e) => c.profile_id && void handleToggle(c.profile_id, "portal_access", e.target.checked)}
                  className="h-4 w-4 rounded accent-brand-primary"
                />
                <span className="text-xs text-text-secondary">Portal</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={c.email_digest}
                  onChange={(e) => c.profile_id && void handleToggle(c.profile_id, "email_digest", e.target.checked)}
                  className="h-4 w-4 rounded accent-brand-primary"
                />
                <span className="text-xs text-text-secondary">Email</span>
              </label>
              <button onClick={() => c.profile_id && void handleRemove(c.profile_id)} className="shrink-0 text-xs text-status-danger hover:underline">
                Remove
              </button>
            </div>
          ))}

          {availableToAdd.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <select
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                className="flex-1 rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary/50 focus:outline-none"
              >
                <option value="">Select a contact...</option>
                {availableToAdd.map((contact) => {
                  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
                  return (
                    <option key={contact.id} value={contact.id}>
                      {fullName ? `${fullName} <${contact.email}>` : contact.email}
                    </option>
                  );
                })}
              </select>
              <button
                onClick={() => void handleAdd()}
                disabled={adding || !selectedContactId}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-brand-hover disabled:opacity-50"
              >
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
          )}

          {addError && (
            <p className="text-xs text-status-danger">{addError}</p>
          )}

          {portalAccountMessage && (
            <p className="text-xs text-brand-primary">{portalAccountMessage}</p>
          )}

          {availableToAdd.length === 0 && availableContacts.length === 0 && (
            <p className="text-xs text-text-tertiary">No customer accounts exist yet. Create one at Admin → User Management.</p>
          )}
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { InternalContactRole, UserRole } from "@/types/database";

const INTERNAL_CONTACT_ROLES: InternalContactRole[] = ["pm", "lead", "installer", "ops_manager"];

type PmDirectoryRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  profile_id: string | null;
  intended_role: InternalContactRole | null;
  profile?: { full_name: string | null } | null;
  matchedProfileRole?: UserRole | null;
};

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function AdminContactsPage() {
  const supabase = createClient();
  const [pms, setPms] = useState<PmDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string; consentUrl?: string } | null>(null);
  const [editingPm, setEditingPm] = useState<PmDirectoryRow | null>(null);
  const [isAddingPm, setIsAddingPm] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState<InternalContactRole>("pm");
  const [savingPm, setSavingPm] = useState(false);
  const [deletingPmId, setDeletingPmId] = useState<string | null>(null);

  async function loadPms() {
    setLoading(true);

    try {
      const res = await fetch("/api/admin/data?section=contacts", {
        credentials: "include",
      });
      const json = await res.json();
      const contactData = res.ok ? json?.contacts : null;
      const profileData = res.ok ? json?.profiles : null;

      const profileRoleByEmail = new Map(
        ((profileData as Array<{ email: string; role: UserRole }> | null) ?? []).map((profile) => [
          profile.email.toLowerCase(),
          profile.role,
        ])
      );

      const normalized = (
        (contactData as Array<PmDirectoryRow & { profile?: { full_name: string | null } | Array<{ full_name: string | null }> }> | null) ?? []
      ).map((item) => ({
        ...item,
        profile: Array.isArray(item.profile) ? item.profile[0] ?? null : item.profile ?? null,
        matchedProfileRole: profileRoleByEmail.get(item.email.toLowerCase()) ?? null,
      }));

      setPms(normalized);
    } catch {
      setPms([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPms();
  }, []);

  function resetPmForm() {
    setEditingPm(null);
    setIsAddingPm(false);
    setFormEmail("");
    setFormFirstName("");
    setFormLastName("");
    setFormPhone("");
    setFormRole("pm");
  }

  function openAddPmModal() {
    resetPmForm();
    setIsAddingPm(true);
    setStatus(null);
  }

  function openEditPmModal(pm: PmDirectoryRow) {
    setEditingPm(pm);
    setIsAddingPm(false);
    setFormEmail(pm.email);
    setFormFirstName(pm.first_name ?? "");
    setFormLastName(pm.last_name ?? "");
    setFormPhone(formatPhone(pm.phone ?? ""));
    setFormRole(
      pm.matchedProfileRole && INTERNAL_CONTACT_ROLES.includes(pm.matchedProfileRole as InternalContactRole)
        ? (pm.matchedProfileRole as InternalContactRole)
        : pm.intended_role ?? "pm"
    );
    setStatus(null);
  }

  async function handleSavePm() {
    const normalizedEmail = formEmail.trim().toLowerCase();
    const isInternalContact = normalizedEmail.endsWith("@controlsco.net");

    if (!normalizedEmail) {
      setStatus({ type: "error", message: "Email is required." });
      return;
    }

    setSavingPm(true);
    setStatus(null);

    try {
      let intendedRole: InternalContactRole | null = null;

      if (isInternalContact) {
        const { data: matchingProfile } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (matchingProfile?.id) {
          const { error: profileError } = await supabase
            .from("profiles")
            .update({ role: formRole })
            .eq("id", matchingProfile.id);

          if (profileError) throw profileError;
        } else {
          intendedRole = formRole;
        }
      }

      if (editingPm) {
        const { error } = await supabase
          .from("pm_directory")
          .update({
            email: normalizedEmail,
            first_name: formFirstName.trim() || null,
            last_name: formLastName.trim() || null,
            phone: formPhone.trim() || null,
            intended_role: isInternalContact ? intendedRole : null,
          })
          .eq("id", editingPm.id);

        if (error) throw error;

        setStatus({ type: "success", message: "Contact entry updated." });
      } else {
        const { error } = await supabase
          .from("pm_directory")
          .insert({
            email: normalizedEmail,
            first_name: formFirstName.trim() || null,
            last_name: formLastName.trim() || null,
            phone: formPhone.trim() || null,
            intended_role: isInternalContact ? intendedRole : null,
          });

        if (error) throw error;

        setStatus({ type: "success", message: "Contact entry added." });
      }

      resetPmForm();
      await loadPms();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to save contact entry.",
      });
    } finally {
      setSavingPm(false);
    }
  }

  async function handleDeletePm(pm: PmDirectoryRow) {
    if (!confirm(`Delete contact entry for ${pm.email}?`)) return;

    setDeletingPmId(pm.id);
    setStatus(null);

    try {
      const { error } = await supabase.from("pm_directory").delete().eq("id", pm.id);

      if (error) throw error;

      if (editingPm?.id === pm.id) {
        resetPmForm();
      }

      setStatus({ type: "success", message: "Contact entry deleted." });
      await loadPms();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to delete contact entry.",
      });
    } finally {
      setDeletingPmId(null);
    }
  }

  async function handleImport() {
    setImporting(true);
    setStatus(null);

    try {
      const res = await fetch("/api/admin/import-pm-directory", {
        method: "POST",
      });
      const json = await res.json();

      if (!res.ok) {
        const rawCount = typeof json?.rawCount === "number" ? json.rawCount : null;
        setStatus({
          type: "error",
          message:
            `${typeof json?.error === "string" ? json.error : "PM import failed."}${
              rawCount !== null ? ` Graph returned ${rawCount} ${rawCount === 1 ? "user" : "users"} before filtering.` : ""
            }`,
          consentUrl: typeof json?.consentUrl === "string" ? json.consentUrl : undefined,
        });
        return;
      }

      const rawCount = typeof json?.rawCount === "number" ? json.rawCount : 0;
      const inserted = typeof json?.inserted === "number" ? json.inserted : 0;
      const updated = typeof json?.updated === "number" ? json.updated : 0;
      const skipped = typeof json?.skipped === "number" ? json.skipped : 0;

      setStatus({
        type: "success",
        message: `Graph returned ${rawCount} ${rawCount === 1 ? "user" : "users"}, imported ${inserted + updated}, skipped ${skipped}.`,
      });
      await loadPms();
    } catch {
      setStatus({
        type: "error",
        message: "PM import failed. Please try again.",
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-text-primary">Contacts</h1>
          <p className="text-sm text-text-secondary">
            Stores both internal TCC staff and external customer-side contacts. Linked portal accounts are shown when `profile_id` is present.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openAddPmModal}
            className="rounded-xl border border-border-default bg-surface-raised px-4 py-1.5 text-sm font-medium text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
          >
            Add Contact
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            className="rounded-xl border border-brand-primary/40 bg-brand-primary/10 px-4 py-1.5 text-sm font-medium text-brand-primary transition hover:bg-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? "Importing from Microsoft..." : "Import from Microsoft"}
          </button>
        </div>
      </div>

      {status && (
        <div
          className={[
            "rounded-xl border px-4 py-2.5 text-sm",
            status.type === "success"
              ? "border-status-success/30 bg-status-success/10 text-status-success"
              : "border-status-warning/30 bg-status-warning/10 text-status-warning",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span>{status.message}</span>
            {status.consentUrl && (
              <a
                href={status.consentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-status-warning/50 bg-status-warning/10 px-3 py-1 text-xs font-medium text-status-warning transition hover:bg-status-warning/20"
              >
                Grant Admin Consent in Azure &rarr;
              </a>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-text-tertiary">Loading...</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-raised/80">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Email</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">First Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Last Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Phone</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">Portal Link</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pms.map((pm) => (
                <tr key={pm.id} className="border-b border-border-default hover:bg-surface-raised">
                  <td className="px-4 py-2.5 text-text-primary">{pm.email}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{pm.first_name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{pm.last_name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{pm.phone ? formatPhone(pm.phone) : "-"}</td>
                  <td className="px-4 py-2.5">
                    {pm.profile_id ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex w-fit rounded-full bg-status-success/10 px-2.5 py-0.5 text-xs font-medium text-status-success">
                          Linked Portal Account
                        </span>
                        <span className="text-xs text-text-secondary">{pm.profile?.full_name ?? pm.profile_id}</span>
                      </div>
                    ) : pm.email.toLowerCase().endsWith("@controlsco.net") ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex w-fit rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-medium text-brand-primary">
                          Internal - Not Yet Signed In
                        </span>
                        {(pm.intended_role ?? pm.matchedProfileRole) && (
                          <span className="text-xs text-text-secondary">
                            Intended role: {pm.intended_role ?? pm.matchedProfileRole}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex rounded-full bg-surface-overlay px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                        External
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditPmModal(pm)}
                        className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-raised hover:text-text-primary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePm(pm)}
                        disabled={deletingPmId === pm.id}
                        className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-1.5 text-xs font-medium text-status-danger transition hover:bg-status-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingPmId === pm.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(isAddingPm || editingPm) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-default bg-surface-raised p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {editingPm ? "Edit Contact Entry" : "Add Contact Entry"}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {editingPm?.profile_id
                    ? "This entry is linked to a portal account. Editing email may affect future auto-linking."
                    : "Use this for external contacts or internal staff not yet linked to a portal account."}
                </p>
              </div>
              <button
                onClick={() => {
                  resetPmForm();
                  setStatus(null);
                }}
                className="rounded-lg px-2 py-1 text-text-tertiary transition hover:bg-surface-overlay hover:text-text-primary"
              >
                x
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">First Name</label>
                  <input
                    type="text"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Last Name</label>
                  <input
                    type="text"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Phone</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(formatPhone(e.target.value))}
                    className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                  />
                </div>
              </div>

              {formEmail.trim().toLowerCase().endsWith("@controlsco.net") && !editingPm?.profile_id && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as InternalContactRole)}
                    className="w-full rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
                  >
                    {INTERNAL_CONTACT_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-text-tertiary">
                    If this user has not signed in yet, the selected role will be applied automatically after their first login.
                  </p>
                </div>
              )}

              {editingPm?.profile_id && (
                <div className="rounded-xl border border-status-success/20 bg-status-success/10 px-3 py-2 text-sm text-status-success">
                  Linked portal account: {editingPm.profile?.full_name ?? editingPm.profile_id}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  resetPmForm();
                  setStatus(null);
                }}
                className="rounded-xl border border-border-default bg-surface-overlay px-4 py-2 text-sm text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePm}
                disabled={savingPm}
                className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPm ? "Saving..." : editingPm ? "Save Changes" : "Add Contact"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

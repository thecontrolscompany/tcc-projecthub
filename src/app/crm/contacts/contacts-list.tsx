"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { CrmContact, CrmContactRoleType, CrmConfidenceLevel } from "@/types/database";
import { CrmSubnav } from "@/components/crm/crm-subnav";
import { ContactBadge } from "@/components/crm/contact-badge";
import { ContactEditModal } from "@/components/crm/contact-edit-modal";
import { CRM_ROLE_TYPE_LABELS, CRM_CONFIDENCE_LABELS, CRM_CONFIDENCE_BADGES } from "@/lib/crm/utils";

type ContactListItem = Pick<
  CrmContact,
  "id" | "display_name" | "role_type" | "title" | "email" | "phone" |
  "is_active" | "confidence_level" | "influence_level" |
  "issues_purchase_orders" | "involved_in_estimating" | "involved_in_project_execution" |
  "account_id"
> & {
  account?: { id: string; company_name: string; type: string } | null;
};

type ContactsListProps = {
  contacts: ContactListItem[];
  role: string;
  showSubnav?: boolean;
  title?: string;
  importHref?: string;
};

const ROLE_OPTIONS: Array<{ value: CrmContactRoleType | ""; label: string }> = [
  { value: "", label: "All Roles" },
  { value: "salesperson", label: "Salesperson" },
  { value: "sales_manager", label: "Sales Manager" },
  { value: "estimator", label: "Estimator" },
  { value: "project_manager", label: "Project Manager" },
  { value: "senior_project_manager", label: "Senior PM" },
  { value: "operations_manager", label: "Ops Manager" },
  { value: "owner", label: "Owner" },
  { value: "cfo", label: "CFO" },
  { value: "cfo_estimator", label: "CFO / Estimator" },
  { value: "unknown", label: "Unknown" },
];

const CONFIDENCE_OPTIONS: Array<{ value: CrmConfidenceLevel | ""; label: string }> = [
  { value: "", label: "All Confidence" },
  { value: "confirmed", label: "Confirmed" },
  { value: "partially_confirmed", label: "Partial" },
  { value: "needs_verification", label: "Unverified" },
];

const INPUT = "rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

export function ContactsList({
  contacts: initialContacts,
  role,
  showSubnav = true,
  title = "Relationship People",
  importHref = "/crm/contacts/import-email",
}: ContactsListProps) {
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<CrmContactRoleType | "">("");
  const [confidenceFilter, setConfidenceFilter] = useState<CrmConfidenceLevel | "">("");
  const [issuesPoOnly, setIssuesPoOnly] = useState(false);
  const [estimatingOnly, setEstimatingOnly] = useState(false);

  const [editingContact, setEditingContact] = useState<CrmContact | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isWriteRole = role === "admin" || role === "ops_manager";

  async function handleExport() {
    setExporting(true);
    setShareUrl(null);
    try {
      const res = await fetch("/api/crm/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Contact Directory" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Export failed");
      setShareUrl(json.url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function copyUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        const matches =
          c.display_name.toLowerCase().includes(q) ||
          c.account?.company_name.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (roleFilter && c.role_type !== roleFilter) return false;
      if (confidenceFilter && c.confidence_level !== confidenceFilter) return false;
      if (issuesPoOnly && !c.issues_purchase_orders) return false;
      if (estimatingOnly && !c.involved_in_estimating) return false;
      return true;
    });
  }, [contacts, search, roleFilter, confidenceFilter, issuesPoOnly, estimatingOnly]);

  async function openEdit(id: string) {
    if (!isWriteRole) return;
    setLoadingId(id);
    try {
      const res = await fetch(`/api/crm/contacts/${id}`);
      const json = await res.json();
      if (res.ok) setEditingContact(json.contact as CrmContact);
    } finally {
      setLoadingId(null);
    }
  }

  function handleSaved(updated: CrmContact) {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === updated.id
          ? {
              ...c,
              display_name:                 updated.display_name,
              role_type:                    updated.role_type,
              title:                        updated.title,
              email:                        updated.email,
              phone:                        updated.phone,
              is_active:                    updated.is_active,
              confidence_level:             updated.confidence_level,
              influence_level:              updated.influence_level,
              issues_purchase_orders:       updated.issues_purchase_orders,
              involved_in_estimating:       updated.involved_in_estimating,
              involved_in_project_execution: updated.involved_in_project_execution,
            }
          : c
      )
    );
    setEditingContact(null);
  }

  const editingAccountName = editingContact
    ? contacts.find((c) => c.id === editingContact.id)?.account?.company_name
    : undefined;

  return (
    <div className={showSubnav ? "mx-auto max-w-7xl px-6 py-6" : "space-y-5"}>
      {showSubnav && <CrmSubnav role={role} />}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
          <p className="text-sm text-text-tertiary">{filtered.length} of {contacts.length} people</p>
        </div>
        {isWriteRole && (
          <div className="flex flex-wrap items-center gap-2">
            {shareUrl && (
              <div className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-overlay px-3 py-1.5">
                <span className="max-w-xs truncate text-xs text-text-tertiary">{shareUrl}</span>
                <button
                  onClick={copyUrl}
                  className="text-xs font-medium text-brand-primary hover:underline"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-xl border border-border-default px-4 py-2 text-sm text-text-secondary transition hover:bg-surface-overlay disabled:opacity-50"
            >
              {exporting ? "Generating…" : shareUrl ? "Regenerate Link" : "Share Directory"}
            </button>
            <Link
              href={importHref}
              className="rounded-xl border border-border-default px-4 py-2 text-sm text-text-secondary transition hover:bg-surface-overlay"
            >
              Import from Email
            </Link>
          </div>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name, company, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${INPUT} w-72`}
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as CrmContactRoleType | "")} className={INPUT}>
          {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={confidenceFilter} onChange={(e) => setConfidenceFilter(e.target.value as CrmConfidenceLevel | "")} className={INPUT}>
          {CONFIDENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-text-secondary cursor-pointer">
          <input type="checkbox" checked={issuesPoOnly} onChange={(e) => setIssuesPoOnly(e.target.checked)} className="rounded" />
          Issues PO
        </label>
        <label className="flex items-center gap-1.5 text-sm text-text-secondary cursor-pointer">
          <input type="checkbox" checked={estimatingOnly} onChange={(e) => setEstimatingOnly(e.target.checked)} className="rounded" />
          Estimating
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-tertiary">No people match your filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-raised text-left text-xs font-medium text-text-tertiary uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Flags</th>
                {isWriteRole && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default bg-surface-base">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-surface-raised transition-colors">
                  <td className="px-4 py-3">
                    <ContactBadge contact={c} showRole={false} size="sm" />
                    {c.title && <p className="mt-0.5 text-xs text-text-tertiary">{c.title}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {c.account ? (
                      <Link
                        href={`/crm/accounts/${c.account.id}`}
                        className="text-brand-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.account.company_name}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {CRM_ROLE_TYPE_LABELS[c.role_type]}
                  </td>
                  <td className="px-4 py-3">
                    {c.email ? (
                      <a
                        href={`mailto:${c.email}`}
                        className="text-brand-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.email}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CRM_CONFIDENCE_BADGES[c.confidence_level]}`}>
                      {CRM_CONFIDENCE_LABELS[c.confidence_level]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.issues_purchase_orders && (
                        <span className="rounded-full bg-status-success/10 text-status-success px-1.5 py-0.5 text-xs">PO</span>
                      )}
                      {c.involved_in_estimating && (
                        <span className="rounded-full bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 text-xs">Est.</span>
                      )}
                      {!c.is_active && (
                        <span className="rounded-full bg-surface-overlay text-text-tertiary px-1.5 py-0.5 text-xs">Inactive</span>
                      )}
                    </div>
                  </td>
                  {isWriteRole && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(c.id)}
                        disabled={loadingId === c.id}
                        className="rounded-lg border border-border-default px-2.5 py-1 text-xs text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary disabled:opacity-40"
                      >
                        {loadingId === c.id ? "…" : "Edit"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingContact && (
        <ContactEditModal
          contact={editingContact}
          accountName={editingAccountName}
          onSaved={(updated) => handleSaved(updated as CrmContact)}
          onDeleted={(id) => {
            setContacts((prev) => prev.filter((c) => c.id !== id));
            setEditingContact(null);
          }}
          onClose={() => setEditingContact(null)}
        />
      )}
    </div>
  );
}

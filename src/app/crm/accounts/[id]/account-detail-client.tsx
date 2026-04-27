"use client";

import { useState } from "react";
import Link from "next/link";
import type { CrmAccount, CrmContact, CrmOpportunity, CrmActivity, CrmTask, CrmTaskStatus } from "@/types/database";
import { CrmSubnav } from "@/components/crm/crm-subnav";
import { HandoffSummary } from "@/components/crm/handoff-summary";
import { ActivityLog } from "@/components/crm/activity-log";
import { ActivityQuickLog } from "@/components/crm/activity-quick-log";
import { TaskWidget } from "@/components/crm/task-widget";
import { OpportunityStageBadge } from "@/components/crm/opportunity-stage-badge";
import { ContactBadge } from "@/components/crm/contact-badge";
import { ContactEditModal } from "@/components/crm/contact-edit-modal";
import { CRM_HEALTH_BADGES, CRM_HEALTH_LABELS, CRM_ACCOUNT_TYPE_LABELS, fmtCrmDate, fmtCrmCurrency, daysSince } from "@/lib/crm/utils";

type Props = {
  account: CrmAccount & {
    relationship_owner?: { id: string; full_name: string | null; email: string } | null;
    contacts?: CrmContact[];
    opportunities?: CrmOpportunity[];
  };
  activities: CrmActivity[];
  tasks: CrmTask[];
  role: string;
  currentUserId: string;
};

type Tab = "overview" | "contacts" | "opportunities" | "activity" | "handoff";

export function AccountDetailClient({ account, activities: initialActivities, tasks: initialTasks, role }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [activities, setActivities] = useState(initialActivities);
  const [tasks, setTasks] = useState(initialTasks);
  const [contacts, setContacts] = useState<CrmContact[]>(account.contacts ?? []);
  const [editingContact, setEditingContact] = useState<CrmContact | null>(null);
  const [loadingContactId, setLoadingContactId] = useState<string | null>(null);
  const isWriteRole = role === "admin" || role === "ops_manager";
  const opportunities = account.opportunities ?? [];

  async function openContactEdit(id: string) {
    setLoadingContactId(id);
    try {
      const res = await fetch(`/api/crm/contacts/${id}`);
      const json = await res.json();
      if (res.ok) setEditingContact(json.contact as CrmContact);
    } finally {
      setLoadingContactId(null);
    }
  }

  function handleContactSaved(updated: CrmContact) {
    setContacts((prev) =>
      prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c)
    );
    setEditingContact(null);
  }

  const daysSinceContact = daysSince(account.last_meaningful_contact_date);

  async function handleTaskToggle(taskId: string, newStatus: CrmTaskStatus) {
    await fetch(`/api/crm/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setTasks((prev) =>
      newStatus === "completed"
        ? prev.filter((t) => t.id !== taskId)
        : prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t)
    );
  }

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "overview", label: "Overview" },
    { id: "contacts", label: "Contacts", count: contacts.length },
    { id: "opportunities", label: "Pipeline", count: opportunities.length },
    { id: "activity", label: "Activity", count: activities.length },
    { id: "handoff", label: "Handoff Card" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <CrmSubnav role={role} />

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/crm/accounts" className="text-sm text-text-tertiary hover:text-text-primary">← Accounts</Link>
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">{account.company_name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <span className="text-sm text-text-tertiary">{CRM_ACCOUNT_TYPE_LABELS[account.type]}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${CRM_HEALTH_BADGES[account.relationship_health]}`}>
              {CRM_HEALTH_LABELS[account.relationship_health]}
            </span>
            {daysSinceContact !== null && daysSinceContact > 60 && (
              <span className="rounded-full bg-status-warning/10 px-2.5 py-1 text-xs font-medium text-status-warning">
                {daysSinceContact}d since last contact
              </span>
            )}
          </div>
        </div>
        {isWriteRole && (
          <Link
            href={`/crm/accounts/${account.id}/edit`}
            className="rounded-xl border border-border-default px-4 py-2 text-sm text-text-secondary transition hover:bg-surface-overlay"
          >
            Edit Account
          </Link>
        )}
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-border-default">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              "rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-brand-primary text-brand-primary"
                : "text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 rounded-full bg-surface-overlay px-1.5 py-0.5 text-xs text-text-tertiary">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Key intel */}
            <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
              <h2 className="mb-4 text-sm font-semibold text-text-primary">Account Summary</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Status</dt>
                  <dd className="mt-0.5 capitalize text-text-primary">{account.status}</dd>
                </div>
                {account.territory && (
                  <div>
                    <dt className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Territory</dt>
                    <dd className="mt-0.5 text-text-primary">{account.territory}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Last Contact</dt>
                  <dd className="mt-0.5 text-text-primary">{fmtCrmDate(account.last_meaningful_contact_date)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Next Follow-up</dt>
                  <dd className={`mt-0.5 ${account.next_scheduled_followup_date && new Date(account.next_scheduled_followup_date) < new Date() ? "text-status-danger font-medium" : "text-text-primary"}`}>
                    {fmtCrmDate(account.next_scheduled_followup_date)}
                  </dd>
                </div>
                {account.relationship_owner && (
                  <div>
                    <dt className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Relationship Owner</dt>
                    <dd className="mt-0.5 text-text-primary">
                      {account.relationship_owner.full_name ?? account.relationship_owner.email}
                    </dd>
                  </div>
                )}
                {account.website && (
                  <div>
                    <dt className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Website</dt>
                    <dd className="mt-0.5">
                      <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline text-sm">
                        {account.website}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
              {account.notes && (
                <div className="mt-4 border-t border-border-default pt-4">
                  <dt className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-1">Notes</dt>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{account.notes}</p>
                </div>
              )}
            </div>

            {/* Quick-log */}
            {isWriteRole && (
              <ActivityQuickLog
                accountId={account.id}
                onLogged={(activity) => setActivities((prev) => [activity, ...prev])}
              />
            )}

            {/* Recent activity preview */}
            <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-primary">Recent Activity</h2>
                <button onClick={() => setActiveTab("activity")} className="text-xs text-brand-primary hover:underline">
                  View all
                </button>
              </div>
              <ActivityLog activities={activities.slice(0, 5)} showOpportunity />
            </div>
          </div>

          <div className="space-y-6">
            {/* Open tasks */}
            <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
              <h2 className="mb-4 text-sm font-semibold text-text-primary">Open Tasks</h2>
              <TaskWidget tasks={tasks} onStatusToggle={isWriteRole ? handleTaskToggle : undefined} compact />
            </div>

            {/* Contacts preview */}
            <div className="rounded-2xl border border-border-default bg-surface-raised p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-primary">Contacts</h2>
                <button onClick={() => setActiveTab("contacts")} className="text-xs text-brand-primary hover:underline">
                  View all
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {contacts.slice(0, 6).map((c) => (
                  <ContactBadge key={c.id} contact={c} size="sm" />
                ))}
                {contacts.length > 6 && (
                  <span className="text-xs text-text-tertiary self-center">+{contacts.length - 6} more</span>
                )}
                {contacts.length === 0 && (
                  <p className="text-sm text-text-tertiary">No contacts yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contacts tab */}
      {activeTab === "contacts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">{contacts.length} Contacts</h2>
        {/* + Add Contact page coming soon */}
          </div>
          {contacts.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-tertiary">No contacts yet for this account.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {contacts.map((c) => (
                <div key={c.id} className="rounded-xl border border-border-default bg-surface-raised p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-text-primary text-sm">{c.display_name}</p>
                      {c.title && <p className="text-xs text-text-tertiary">{c.title}</p>}
                    </div>
                    <ContactBadge contact={c} showRole size="sm" />
                  </div>
                  <div className="mt-2 space-y-0.5 text-xs text-text-secondary">
                    {c.email && <p>✉ {c.email}</p>}
                    {c.phone && <p>📞 {c.phone}</p>}
                    {c.mobile && <p>📱 {c.mobile}</p>}
                    <div className="flex flex-wrap gap-2 mt-1">
                      {c.issues_purchase_orders && <span className="rounded-full bg-status-success/10 text-status-success px-1.5 py-0.5 text-xs">Issues PO</span>}
                      {c.involved_in_estimating && <span className="rounded-full bg-brand-primary/10 text-brand-primary px-1.5 py-0.5 text-xs">Estimating</span>}
                      {!c.is_active && <span className="rounded-full bg-surface-overlay text-text-tertiary px-1.5 py-0.5 text-xs">Inactive</span>}
                    </div>
                  </div>
                  {isWriteRole && (
                    <button
                      onClick={() => openContactEdit(c.id)}
                      disabled={loadingContactId === c.id}
                      className="mt-3 rounded-lg border border-border-default px-2.5 py-1 text-xs text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary disabled:opacity-40"
                    >
                      {loadingContactId === c.id ? "Loading…" : "Edit"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Opportunities tab */}
      {activeTab === "opportunities" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">{opportunities.length} Opportunities</h2>
            {isWriteRole && (
              <Link
                href={`/crm/opportunities/new?account_id=${account.id}`}
                className="rounded-xl border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-overlay"
              >
                + New Opportunity
              </Link>
            )}
          </div>
          {opportunities.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-tertiary">No opportunities for this account yet.</p>
          ) : (
            <div className="space-y-3">
              {opportunities.map((opp) => (
                <Link
                  key={opp.id}
                  href={`/crm/opportunities/${opp.id}`}
                  className="flex items-center justify-between rounded-xl border border-border-default bg-surface-raised p-4 transition hover:border-brand-primary/40"
                >
                  <div>
                    <p className="font-medium text-text-primary text-sm">{opp.project_name}</p>
                    <p className="text-xs text-text-tertiary">{opp.opportunity_number}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {opp.estimated_value != null && (
                      <span className="text-sm font-medium text-text-primary">{fmtCrmCurrency(opp.estimated_value)}</span>
                    )}
                    <OpportunityStageBadge stage={opp.stage} size="sm" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity tab */}
      {activeTab === "activity" && (
        <div className="space-y-6">
          {isWriteRole && (
            <ActivityQuickLog
              accountId={account.id}
              onLogged={(activity) => setActivities((prev) => [activity, ...prev])}
            />
          )}
          <ActivityLog activities={activities} showOpportunity emptyMessage="No activities logged for this account yet." />
        </div>
      )}

      {/* Handoff tab */}
      {activeTab === "handoff" && (
        <div className="max-w-2xl space-y-6">
          <HandoffSummary account={account} />
        </div>
      )}

      {editingContact && (
        <ContactEditModal
          contact={editingContact}
          accountName={account.company_name}
          onSaved={(updated) => handleContactSaved(updated as CrmContact)}
          onClose={() => setEditingContact(null)}
        />
      )}
    </div>
  );
}

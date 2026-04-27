import Link from "next/link";
import type { CrmAccount } from "@/types/database";
import { CRM_HEALTH_BADGES, CRM_HEALTH_LABELS, CRM_ACCOUNT_TYPE_LABELS, daysSince, fmtCrmDate } from "@/lib/crm/utils";

type AccountCardProps = {
  account: Pick<
    CrmAccount,
    "id" | "company_name" | "type" | "status" | "relationship_health" |
    "last_meaningful_contact_date" | "next_scheduled_followup_date" |
    "relationship_owner_profile_id"
  > & {
    relationship_owner?: { id: string; full_name: string | null; email: string } | null;
  };
  contactCount?: number;
};

function ownerInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function AccountCard({ account, contactCount }: AccountCardProps) {
  const daysSinceContact = daysSince(account.last_meaningful_contact_date);
  const isOverdue = account.next_scheduled_followup_date
    ? new Date(account.next_scheduled_followup_date) < new Date()
    : false;

  return (
    <Link
      href={`/crm/accounts/${account.id}`}
      className="block rounded-2xl border border-border-default bg-surface-raised p-5 transition hover:border-brand-primary/40 hover:bg-surface-overlay"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-text-primary">{account.company_name}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">{CRM_ACCOUNT_TYPE_LABELS[account.type]}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${CRM_HEALTH_BADGES[account.relationship_health]}`}>
          {CRM_HEALTH_LABELS[account.relationship_health]}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
        {daysSinceContact !== null ? (
          <span>
            Last contact: <span className={daysSinceContact > 60 ? "text-status-warning font-medium" : ""}>{fmtCrmDate(account.last_meaningful_contact_date)}</span>
          </span>
        ) : (
          <span className="text-text-tertiary">No contact logged</span>
        )}
        {account.next_scheduled_followup_date && (
          <span>
            Follow-up:{" "}
            <span className={isOverdue ? "text-status-danger font-medium" : ""}>
              {fmtCrmDate(account.next_scheduled_followup_date)}
              {isOverdue ? " (overdue)" : ""}
            </span>
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        {account.relationship_owner && (
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary/15 text-xs font-semibold text-brand-primary">
              {ownerInitials(account.relationship_owner.full_name, account.relationship_owner.email)}
            </div>
            <span className="text-xs text-text-tertiary">
              {account.relationship_owner.full_name ?? account.relationship_owner.email}
            </span>
          </div>
        )}
        {contactCount !== undefined && (
          <span className="ml-auto text-xs text-text-tertiary">
            {contactCount} {contactCount === 1 ? "contact" : "contacts"}
          </span>
        )}
      </div>
    </Link>
  );
}

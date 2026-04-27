"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { CrmAccount, CrmRelationshipHealth, CrmAccountStatus } from "@/types/database";
import { AccountCard } from "@/components/crm/account-card";
import { CrmSubnav } from "@/components/crm/crm-subnav";

type AccountListItem = Pick<
  CrmAccount,
  "id" | "company_name" | "type" | "status" | "relationship_health" |
  "last_meaningful_contact_date" | "next_scheduled_followup_date" |
  "relationship_owner_profile_id"
> & {
  relationship_owner?: { id: string; full_name: string | null; email: string } | null;
};

type AccountsListProps = {
  accounts: AccountListItem[];
  contactCounts: Map<string, number>;
  role: string;
};

const HEALTH_OPTIONS: Array<{ value: CrmRelationshipHealth | ""; label: string }> = [
  { value: "", label: "All Health" },
  { value: "strong", label: "Strong" },
  { value: "good", label: "Good" },
  { value: "at_risk", label: "At Risk" },
  { value: "dormant", label: "Dormant" },
  { value: "unknown", label: "Unknown" },
];

const STATUS_OPTIONS: Array<{ value: CrmAccountStatus | ""; label: string }> = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "prospect", label: "Prospect" },
  { value: "inactive", label: "Inactive" },
];

const INPUT = "rounded-xl border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none";

export function AccountsList({ accounts, contactCounts, role }: AccountsListProps) {
  const [search, setSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<CrmRelationshipHealth | "">("");
  const [statusFilter, setStatusFilter] = useState<CrmAccountStatus | "">("");
  const isWriteRole = role === "admin" || role === "ops_manager";

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (search && !a.company_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (healthFilter && a.relationship_health !== healthFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });
  }, [accounts, search, healthFilter, statusFilter]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <CrmSubnav role={role} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Accounts</h1>
          <p className="text-sm text-text-tertiary">{filtered.length} of {accounts.length} companies</p>
        </div>
        {isWriteRole && (
          <Link
            href="/crm/accounts/new"
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-text-inverse transition hover:bg-brand-hover"
          >
            + New Account
          </Link>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${INPUT} w-64`}
        />
        <select value={healthFilter} onChange={(e) => setHealthFilter(e.target.value as CrmRelationshipHealth | "")} className={INPUT}>
          {HEALTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CrmAccountStatus | "")} className={INPUT}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-tertiary">No accounts match your filters.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              contactCount={contactCounts.get(account.id) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

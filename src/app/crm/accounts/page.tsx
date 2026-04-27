import { createClient } from "@/lib/supabase/server";
import { AccountsList } from "./accounts-list";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .maybeSingle();

  const role = profile?.role ?? "pm";

  const { data: accounts } = await supabase
    .from("crm_accounts")
    .select(`
      id, company_name, type, territory, status, relationship_health,
      last_meaningful_contact_date, next_scheduled_followup_date,
      relationship_owner_profile_id, tags, notes, created_at, updated_at,
      relationship_owner:profiles!crm_accounts_relationship_owner_profile_id_fkey(id, full_name, email)
    `)
    .order("company_name", { ascending: true });

  const { data: contactCounts } = await supabase
    .from("crm_contacts")
    .select("account_id");

  const countMap = new Map<string, number>();
  for (const c of contactCounts ?? []) {
    countMap.set(c.account_id, (countMap.get(c.account_id) ?? 0) + 1);
  }

  return (
    <AccountsList
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      accounts={(accounts ?? []) as any}
      contactCounts={countMap}
      role={role}
    />
  );
}

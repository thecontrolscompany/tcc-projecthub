import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import type { CrmOpportunityStage, CrmContactRoleType, CrmDashboardMetrics } from "@/types/database";
import { OPEN_STAGES } from "@/lib/crm/stages";

const CRM_WRITE_ROLES = ["admin", "ops_manager"] as const;

export async function GET(_request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!(CRM_WRITE_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const [oppsResult, contactsResult, accountsResult, tasksResult] = await Promise.all([
    supabase
      .from("crm_opportunities")
      .select(`
        id, opportunity_number, project_name, stage, estimated_value,
        expected_close_date, last_activity_date, account_id,
        account:crm_accounts!crm_opportunities_account_id_fkey(id, company_name)
      `),
    supabase
      .from("crm_contacts")
      .select(`
        id, role_type, account_id, display_name, email,
        issues_purchase_orders, involved_in_estimating,
        account:crm_accounts!crm_contacts_account_id_fkey(id, company_name)
      `)
      .eq("is_active", true),
    supabase
      .from("crm_accounts")
      .select("id, company_name"),
    supabase
      .from("crm_tasks")
      .select(`
        *,
        assigned_to:profiles!crm_tasks_assigned_to_profile_id_fkey(id, full_name, email),
        account:crm_accounts!crm_tasks_account_id_fkey(id, company_name),
        opportunity:crm_opportunities!crm_tasks_opportunity_id_fkey(id, project_name, opportunity_number)
      `)
      .eq("status", "open")
      .lte("due_date", sunday.toISOString().slice(0, 10)),
  ]);

  const opps = oppsResult.data ?? [];
  const contacts = contactsResult.data ?? [];
  const accounts = accountsResult.data ?? [];
  const tasks = tasksResult.data ?? [];

  // 1. Pipeline by stage (open stages only)
  const stageMap = new Map<string, { count: number; total_value: number }>();
  for (const opp of opps) {
    if (!OPEN_STAGES.includes(opp.stage as CrmOpportunityStage)) continue;
    const existing = stageMap.get(opp.stage) ?? { count: 0, total_value: 0 };
    existing.count++;
    existing.total_value += opp.estimated_value ?? 0;
    stageMap.set(opp.stage, existing);
  }
  const pipeline_by_stage = OPEN_STAGES
    .filter((s) => stageMap.has(s))
    .map((s) => ({ stage: s, ...stageMap.get(s)! }));

  // 2. Open opps by account
  const accountOppMap = new Map<string, { company_name: string; count: number; total_value: number }>();
  for (const opp of opps) {
    if (opp.stage === "closed_lost") continue;
    const accId = opp.account_id as string;
    const accName = ((opp.account as unknown) as { company_name: string } | null)?.company_name ?? "Unknown";
    const existing = accountOppMap.get(accId) ?? { company_name: accName, count: 0, total_value: 0 };
    existing.count++;
    existing.total_value += opp.estimated_value ?? 0;
    accountOppMap.set(accId, existing);
  }
  const open_opps_by_account = Array.from(accountOppMap.entries())
    .map(([account_id, v]) => ({ account_id, ...v }))
    .sort((a, b) => b.total_value - a.total_value);

  // 3. Revenue by close month
  const monthMap = new Map<string, { total_value: number; count: number }>();
  for (const opp of opps) {
    if (!opp.expected_close_date || opp.stage === "closed_lost") continue;
    const month = opp.expected_close_date.slice(0, 7);
    const existing = monthMap.get(month) ?? { total_value: 0, count: 0 };
    existing.total_value += opp.estimated_value ?? 0;
    existing.count++;
    monthMap.set(month, existing);
  }
  const revenue_by_close_month = Array.from(monthMap.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // 4. Stale opportunities (no activity in 30+ days, or never)
  const stale_opportunities = opps
    .filter((opp) => {
      if (opp.stage === "closed_lost" || opp.stage === "po_received") return false;
      if (!opp.last_activity_date) return true;
      return new Date(opp.last_activity_date) < thirtyDaysAgo;
    })
    .map((opp) => {
      const days_stale = opp.last_activity_date
        ? Math.floor((Date.now() - new Date(opp.last_activity_date).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      return {
        id: opp.id,
        opportunity_number: opp.opportunity_number,
        project_name: opp.project_name,
        company_name: ((opp.account as unknown) as { company_name: string } | null)?.company_name ?? "Unknown",
        last_activity_date: opp.last_activity_date,
        days_stale,
      };
    })
    .sort((a, b) => b.days_stale - a.days_stale);

  // 5. Accounts with only one known active contact
  const contactCountByAccount = new Map<string, number>();
  for (const c of contacts) {
    contactCountByAccount.set(c.account_id, (contactCountByAccount.get(c.account_id) ?? 0) + 1);
  }
  const accounts_single_contact = accounts
    .map((a) => ({ id: a.id, company_name: a.company_name, contact_count: contactCountByAccount.get(a.id) ?? 0 }))
    .filter((a) => a.contact_count <= 1)
    .sort((a, b) => a.company_name.localeCompare(b.company_name));

  // 6. Contacts by role type
  const roleMap = new Map<string, number>();
  for (const c of contacts) {
    roleMap.set(c.role_type, (roleMap.get(c.role_type) ?? 0) + 1);
  }
  const contacts_by_role = Array.from(roleMap.entries())
    .map(([role_type, count]) => ({ role_type: role_type as CrmContactRoleType, count }))
    .sort((a, b) => b.count - a.count);

  // 7. PO issuers
  const po_issuers = contacts
    .filter((c) => c.issues_purchase_orders)
    .map((c) => ({
      id: c.id,
      display_name: c.display_name,
      company_name: ((c.account as unknown) as { company_name: string } | null)?.company_name ?? "Unknown",
      email: c.email ?? null,
    }));

  // 8. Estimating contacts by account
  const estimatingByAccount = new Map<string, { company_name: string; contacts: Array<{ id: string; display_name: string }> }>();
  for (const c of contacts) {
    if (!c.involved_in_estimating) continue;
    const accId = c.account_id;
    const accName = ((c.account as unknown) as { company_name: string } | null)?.company_name ?? "Unknown";
    const existing = estimatingByAccount.get(accId) ?? { company_name: accName, contacts: [] };
    existing.contacts.push({ id: c.id, display_name: c.display_name });
    estimatingByAccount.set(accId, existing);
  }
  const estimating_contacts_by_account = Array.from(estimatingByAccount.entries())
    .map(([account_id, v]) => ({ account_id, ...v }))
    .sort((a, b) => a.company_name.localeCompare(b.company_name));

  const metrics: CrmDashboardMetrics = {
    pipeline_by_stage,
    open_opps_by_account,
    revenue_by_close_month,
    stale_opportunities,
    accounts_single_contact,
    contacts_by_role,
    tasks_due_this_week: tasks,
    po_issuers,
    estimating_contacts_by_account,
  };

  return NextResponse.json(metrics);
}

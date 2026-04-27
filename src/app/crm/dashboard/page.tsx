import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";
import { OPEN_STAGES } from "@/lib/crm/stages";
import type { CrmDashboardMetrics, CrmOpportunityStage, CrmContactRoleType } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function CrmDashboardPage() {
  const supabase = await createClient();

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, role")
    .maybeSingle();

  const role = profileData?.role ?? "pm";

  // PM/lead get redirected to accounts — dashboard is write-roles only
  if (!["admin", "ops_manager"].includes(role)) {
    redirect("/crm/accounts");
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
    supabase.from("crm_opportunities").select(`
      id, opportunity_number, project_name, stage, estimated_value,
      expected_close_date, last_activity_date, account_id,
      account:crm_accounts!crm_opportunities_account_id_fkey(id, company_name)
    `),
    supabase.from("crm_contacts").select(`
      id, role_type, account_id, display_name, email,
      issues_purchase_orders, involved_in_estimating,
      account:crm_accounts!crm_contacts_account_id_fkey(id, company_name)
    `).eq("is_active", true),
    supabase.from("crm_accounts").select("id, company_name"),
    supabase.from("crm_tasks").select(`
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

  // Aggregate
  const stageMap = new Map<string, { count: number; total_value: number }>();
  for (const opp of opps) {
    if (!OPEN_STAGES.includes(opp.stage as CrmOpportunityStage)) continue;
    const e = stageMap.get(opp.stage) ?? { count: 0, total_value: 0 };
    e.count++; e.total_value += opp.estimated_value ?? 0;
    stageMap.set(opp.stage, e);
  }
  const pipeline_by_stage = OPEN_STAGES.filter((s) => stageMap.has(s)).map((s) => ({ stage: s, ...stageMap.get(s)! }));

  const accountOppMap = new Map<string, { company_name: string; count: number; total_value: number }>();
  for (const opp of opps) {
    if (opp.stage === "closed_lost") continue;
    const id = opp.account_id as string;
    const name = ((opp.account as unknown) as { company_name: string } | null)?.company_name ?? "Unknown";
    const e = accountOppMap.get(id) ?? { company_name: name, count: 0, total_value: 0 };
    e.count++; e.total_value += opp.estimated_value ?? 0;
    accountOppMap.set(id, e);
  }
  const open_opps_by_account = Array.from(accountOppMap.entries()).map(([account_id, v]) => ({ account_id, ...v })).sort((a, b) => b.total_value - a.total_value);

  const monthMap = new Map<string, { total_value: number; count: number }>();
  for (const opp of opps) {
    if (!opp.expected_close_date || opp.stage === "closed_lost") continue;
    const month = opp.expected_close_date.slice(0, 7);
    const e = monthMap.get(month) ?? { total_value: 0, count: 0 };
    e.total_value += opp.estimated_value ?? 0; e.count++;
    monthMap.set(month, e);
  }
  const revenue_by_close_month = Array.from(monthMap.entries()).map(([month, v]) => ({ month, ...v })).sort((a, b) => a.month.localeCompare(b.month));

  const stale_opportunities = opps
    .filter((o) => o.stage !== "closed_lost" && o.stage !== "po_received" && (!o.last_activity_date || new Date(o.last_activity_date) < thirtyDaysAgo))
    .map((o) => ({
      id: o.id,
      opportunity_number: o.opportunity_number,
      project_name: o.project_name,
      company_name: ((o.account as unknown) as { company_name: string } | null)?.company_name ?? "Unknown",
      last_activity_date: o.last_activity_date,
      days_stale: o.last_activity_date ? Math.floor((Date.now() - new Date(o.last_activity_date).getTime()) / 86400000) : 999,
    }))
    .sort((a, b) => b.days_stale - a.days_stale);

  const countByAccount = new Map<string, number>();
  for (const c of contacts) countByAccount.set(c.account_id, (countByAccount.get(c.account_id) ?? 0) + 1);
  const accounts_single_contact = accounts.map((a) => ({ id: a.id, company_name: a.company_name, contact_count: countByAccount.get(a.id) ?? 0 })).filter((a) => a.contact_count <= 1);

  const roleMap = new Map<string, number>();
  for (const c of contacts) roleMap.set(c.role_type, (roleMap.get(c.role_type) ?? 0) + 1);
  const contacts_by_role = Array.from(roleMap.entries()).map(([role_type, count]) => ({ role_type: role_type as CrmContactRoleType, count })).sort((a, b) => b.count - a.count);

  const po_issuers = contacts.filter((c) => c.issues_purchase_orders).map((c) => ({
    id: c.id, display_name: c.display_name,
    company_name: ((c.account as unknown) as { company_name: string } | null)?.company_name ?? "Unknown",
    email: c.email ?? null,
  }));

  const estByAccount = new Map<string, { company_name: string; contacts: Array<{ id: string; display_name: string }> }>();
  for (const c of contacts) {
    if (!c.involved_in_estimating) continue;
    const name = ((c.account as unknown) as { company_name: string } | null)?.company_name ?? "Unknown";
    const e = estByAccount.get(c.account_id) ?? { company_name: name, contacts: [] };
    e.contacts.push({ id: c.id, display_name: c.display_name });
    estByAccount.set(c.account_id, e);
  }
  const estimating_contacts_by_account = Array.from(estByAccount.entries()).map(([account_id, v]) => ({ account_id, ...v })).sort((a, b) => a.company_name.localeCompare(b.company_name));

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

  return <DashboardClient metrics={metrics} role={role} />;
}

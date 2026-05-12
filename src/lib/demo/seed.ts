import { createClient } from "@supabase/supabase-js";

// Fixed UUIDs — these match pre-created Supabase Auth users.
// Create them once via the Supabase dashboard or setup script.
// On each nightly reset, auth users are NOT touched — only app data rows.
export const DEMO = {
  ORG_SLUG: "demo",
  USERS: {
    ADMIN: {
      email: "demo-admin@trimrespond.com",
      profileId: "d0000000-0000-0000-0000-000000000001",
    },
    PM_1: {
      email: "demo-pm1@trimrespond.com",
      profileId: "d0000000-0000-0000-0000-000000000002",
    },
    PM_2: {
      email: "demo-pm2@trimrespond.com",
      profileId: "d0000000-0000-0000-0000-000000000003",
    },
    CUSTOMER: {
      email: "demo-customer@trimrespond.com",
      profileId: "d0000000-0000-0000-0000-000000000004",
    },
  },
  // Other fixed IDs
  IDS: {
    CUSTOMER_SUNBELT:  "d1000000-0000-0000-0000-000000000001",
    CUSTOMER_HORIZON:  "d1000000-0000-0000-0000-000000000002",
    CUSTOMER_NAS:      "d1000000-0000-0000-0000-000000000003",
    PM_MARIA:          "d2000000-0000-0000-0000-000000000001",
    PM_DEREK:          "d2000000-0000-0000-0000-000000000002",
    PROJECT_SUNBELT_HQ:      "d3000000-0000-0000-0000-000000000001",
    PROJECT_NAS_FITNESS:     "d3000000-0000-0000-0000-000000000002",
    PROJECT_HORIZON_APT:     "d3000000-0000-0000-0000-000000000003",
    PROJECT_SUNBELT_WH:      "d3000000-0000-0000-0000-000000000004",
    PROJECT_HORIZON_TOWER:   "d3000000-0000-0000-0000-000000000005",
    CRM_ACCT_SUNBELT:  "d4000000-0000-0000-0000-000000000001",
    CRM_ACCT_HORIZON:  "d4000000-0000-0000-0000-000000000002",
    CRM_ACCT_NAS:      "d4000000-0000-0000-0000-000000000003",
  },
} as const;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function wipeDemoData(orgId: string) {
  const db = adminClient();

  // Delete in FK-safe order (children before parents)
  const tables = [
    "poc_line_items",
    "project_photos",
    "project_rfis",
    "wip_items",
    "bom_items",
    "time_entries",
    "weekly_updates",
    "change_orders",
    "billing_periods",
    "project_contacts",
    "project_assignments",
    "pursuits",
    "quote_requests",
    "crm_opportunity_contacts",
    "crm_activities",
    "crm_tasks",
    "crm_opportunities",
    "crm_contacts",
    "crm_accounts",
    "projects",
    "customers",
    "pm_directory",
    "estimates",
  ];

  for (const table of tables) {
    const { error } = await db.from(table).delete().eq("organization_id", orgId);
    if (error && error.code !== "PGRST116") {
      // PGRST116 = table has no rows matching, safe to ignore
      console.warn(`Demo wipe warning [${table}]:`, error.message);
    }
  }

  // Reset profiles for demo users (keep auth users, just reset profile rows)
  await db.from("profiles").delete().in("id", [
    DEMO.USERS.PM_1.profileId,
    DEMO.USERS.PM_2.profileId,
    DEMO.USERS.CUSTOMER.profileId,
  ]);
}

export async function seedDemoData(orgId: string) {
  const db = adminClient();
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonth = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}`;

  // ── Profiles ─────────────────────────────────────────────────────────────
  await db.from("profiles").upsert([
    {
      id: DEMO.USERS.ADMIN.profileId,
      email: DEMO.USERS.ADMIN.email,
      full_name: "Jordan Apex",
      role: "admin",
      default_organization_id: orgId,
    },
    {
      id: DEMO.USERS.PM_1.profileId,
      email: DEMO.USERS.PM_1.email,
      full_name: "Maria Gutierrez",
      role: "pm",
      default_organization_id: orgId,
    },
    {
      id: DEMO.USERS.PM_2.profileId,
      email: DEMO.USERS.PM_2.email,
      full_name: "Derek Walsh",
      role: "pm",
      default_organization_id: orgId,
    },
    {
      id: DEMO.USERS.CUSTOMER.profileId,
      email: DEMO.USERS.CUSTOMER.email,
      full_name: "Sandra Park",
      role: "customer",
      default_organization_id: orgId,
    },
  ]);

  // Ensure demo users are org members
  await db.from("organization_memberships").upsert([
    { organization_id: orgId, profile_id: DEMO.USERS.ADMIN.profileId,    role: "admin",  is_default: true },
    { organization_id: orgId, profile_id: DEMO.USERS.PM_1.profileId,     role: "member", is_default: true },
    { organization_id: orgId, profile_id: DEMO.USERS.PM_2.profileId,     role: "member", is_default: true },
    { organization_id: orgId, profile_id: DEMO.USERS.CUSTOMER.profileId, role: "customer", is_default: true },
  ], { onConflict: "organization_id,profile_id" });

  // ── PM Directory ──────────────────────────────────────────────────────────
  await db.from("pm_directory").insert([
    {
      id: DEMO.IDS.PM_MARIA,
      organization_id: orgId,
      first_name: "Maria",
      last_name: "Gutierrez",
      email: DEMO.USERS.PM_1.email,
      phone: "850-555-0121",
      profile_id: DEMO.USERS.PM_1.profileId,
    },
    {
      id: DEMO.IDS.PM_DEREK,
      organization_id: orgId,
      first_name: "Derek",
      last_name: "Walsh",
      email: DEMO.USERS.PM_2.email,
      phone: "850-555-0132",
      profile_id: DEMO.USERS.PM_2.profileId,
    },
  ]);

  // ── Customers ─────────────────────────────────────────────────────────────
  await db.from("customers").insert([
    { id: DEMO.IDS.CUSTOMER_SUNBELT, organization_id: orgId, name: "Sunbelt Construction Group", contact_email: "projects@sunbeltcg.com" },
    { id: DEMO.IDS.CUSTOMER_HORIZON, organization_id: orgId, name: "Horizon Property Management", contact_email: "facilities@horizonpm.com" },
    { id: DEMO.IDS.CUSTOMER_NAS,     organization_id: orgId, name: "NAS Pensacola (NAVFAC SE)",  contact_email: "contracting@nas-pensacola.navy.mil" },
  ]);

  // ── Projects ──────────────────────────────────────────────────────────────
  await db.from("projects").insert([
    {
      id: DEMO.IDS.PROJECT_SUNBELT_HQ,
      organization_id: orgId,
      job_number: "DEMO-001",
      name: "Sunbelt Corporate HQ – HVAC Controls",
      customer_id: DEMO.IDS.CUSTOMER_SUNBELT,
      pm_email: DEMO.USERS.PM_1.email,
      estimated_income: 285000,
      status: "active",
      pct_complete: 78,
    },
    {
      id: DEMO.IDS.PROJECT_NAS_FITNESS,
      organization_id: orgId,
      job_number: "DEMO-002",
      name: "NAS Pensacola Fitness Center Retrofit",
      customer_id: DEMO.IDS.CUSTOMER_NAS,
      pm_email: DEMO.USERS.PM_2.email,
      estimated_income: 520000,
      status: "active",
      pct_complete: 45,
    },
    {
      id: DEMO.IDS.PROJECT_HORIZON_APT,
      organization_id: orgId,
      job_number: "DEMO-003",
      name: "Horizon Apartments Phase 2 – BAS",
      customer_id: DEMO.IDS.CUSTOMER_HORIZON,
      pm_email: DEMO.USERS.PM_1.email,
      estimated_income: 148000,
      status: "active",
      pct_complete: 95,
    },
    {
      id: DEMO.IDS.PROJECT_SUNBELT_WH,
      organization_id: orgId,
      job_number: "DEMO-004",
      name: "Sunbelt Warehouse A – BAS Upgrade",
      customer_id: DEMO.IDS.CUSTOMER_SUNBELT,
      pm_email: DEMO.USERS.PM_2.email,
      estimated_income: 94000,
      status: "active",
      pct_complete: 15,
    },
    {
      id: DEMO.IDS.PROJECT_HORIZON_TOWER,
      organization_id: orgId,
      job_number: "DEMO-005",
      name: "Horizon Office Tower – DDC Controls",
      customer_id: DEMO.IDS.CUSTOMER_HORIZON,
      pm_email: DEMO.USERS.PM_1.email,
      estimated_income: 210000,
      status: "completed",
      pct_complete: 100,
    },
  ]);

  // ── Project assignments ───────────────────────────────────────────────────
  await db.from("project_assignments").insert([
    { project_id: DEMO.IDS.PROJECT_SUNBELT_HQ,    profile_id: DEMO.USERS.PM_1.profileId, organization_id: orgId, is_primary: true },
    { project_id: DEMO.IDS.PROJECT_NAS_FITNESS,   profile_id: DEMO.USERS.PM_2.profileId, organization_id: orgId, is_primary: true },
    { project_id: DEMO.IDS.PROJECT_HORIZON_APT,   profile_id: DEMO.USERS.PM_1.profileId, organization_id: orgId, is_primary: true },
    { project_id: DEMO.IDS.PROJECT_SUNBELT_WH,    profile_id: DEMO.USERS.PM_2.profileId, organization_id: orgId, is_primary: true },
    { project_id: DEMO.IDS.PROJECT_HORIZON_TOWER, profile_id: DEMO.USERS.PM_1.profileId, organization_id: orgId, is_primary: true },
  ]);

  // ── Billing periods ───────────────────────────────────────────────────────
  const billingProjects = [
    { projectId: DEMO.IDS.PROJECT_SUNBELT_HQ,    income: 285000, prevPct: 62,  currPct: 78 },
    { projectId: DEMO.IDS.PROJECT_NAS_FITNESS,    income: 520000, prevPct: 28,  currPct: 45 },
    { projectId: DEMO.IDS.PROJECT_HORIZON_APT,    income: 148000, prevPct: 80,  currPct: 95 },
    { projectId: DEMO.IDS.PROJECT_SUNBELT_WH,     income: 94000,  prevPct: 0,   currPct: 15 },
    { projectId: DEMO.IDS.PROJECT_HORIZON_TOWER,  income: 210000, prevPct: 90,  currPct: 100 },
  ];

  const lastMonthRows = billingProjects.map((p) => ({
    organization_id: orgId,
    project_id: p.projectId,
    period_month: lastMonth,
    pct_complete: p.prevPct,
    previously_billed: Math.round(p.income * (p.prevPct / 100) * 0.85),
    to_bill_this_period: Math.round(p.income * ((p.prevPct - (p.prevPct > 20 ? 20 : 0)) / 100)),
    actual_billed: Math.round(p.income * ((p.prevPct - (p.prevPct > 20 ? 20 : 0)) / 100)),
    is_closed: true,
  }));

  const thisMonthRows = billingProjects.map((p) => ({
    organization_id: orgId,
    project_id: p.projectId,
    period_month: thisMonth,
    pct_complete: p.currPct,
    previously_billed: Math.round(p.income * (p.prevPct / 100)),
    to_bill_this_period: Math.max(
      Math.round(p.income * p.currPct / 100) - Math.round(p.income * p.prevPct / 100),
      0
    ),
    actual_billed: null,
    is_closed: false,
  }));

  await db.from("billing_periods").insert([...lastMonthRows, ...thisMonthRows]);

  // ── Weekly updates (2 per active project) ────────────────────────────────
  const activeProjects = [
    { id: DEMO.IDS.PROJECT_SUNBELT_HQ,   pmId: DEMO.USERS.PM_1.profileId },
    { id: DEMO.IDS.PROJECT_NAS_FITNESS,  pmId: DEMO.USERS.PM_2.profileId },
    { id: DEMO.IDS.PROJECT_HORIZON_APT,  pmId: DEMO.USERS.PM_1.profileId },
    { id: DEMO.IDS.PROJECT_SUNBELT_WH,   pmId: DEMO.USERS.PM_2.profileId },
  ];

  const weeklyUpdates = activeProjects.flatMap((p, pi) => [
    {
      organization_id: orgId,
      project_id: p.id,
      submitted_by: p.pmId,
      week_ending: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      summary: [
        "Completed DDC controller installation on floors 2–4. Awaiting TAB sign-off.",
        "Rough-in complete for mechanical room. Equipment startup scheduled for Thursday.",
        "Punch list underway. Final commissioning report in progress.",
        "Mobilized on site. Conduit rough-in started in mechanical room.",
      ][pi],
      work_completed: "On schedule per baseline.",
      blockers: pi === 1 ? "Owner-furnished equipment delivery delayed 1 week." : null,
      status: "submitted",
    },
    {
      organization_id: orgId,
      project_id: p.id,
      submitted_by: p.pmId,
      week_ending: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      summary: [
        "Sensor installation complete floors 1–3. Started floor 4 wiring.",
        "Ductwork modifications complete. Controls rough-in 60% done.",
        "All equipment online. Owner training session completed.",
        "Pre-construction meeting held with GC and owner.",
      ][pi],
      work_completed: "Per schedule.",
      blockers: null,
      status: "submitted",
    },
  ]);

  await db.from("weekly_updates").insert(weeklyUpdates);

  // ── Change orders ─────────────────────────────────────────────────────────
  await db.from("change_orders").insert([
    {
      organization_id: orgId,
      project_id: DEMO.IDS.PROJECT_SUNBELT_HQ,
      co_number: "CO-001",
      description: "Added 14 additional VAV boxes per revised architectural drawings",
      amount: 18500,
      status: "approved",
      submitted_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      organization_id: orgId,
      project_id: DEMO.IDS.PROJECT_NAS_FITNESS,
      co_number: "CO-001",
      description: "Scope addition: emergency generator monitoring integration",
      amount: 32000,
      status: "pending",
      submitted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  // ── WIP items ─────────────────────────────────────────────────────────────
  await db.from("wip_items").insert([
    { organization_id: orgId, project_id: DEMO.IDS.PROJECT_SUNBELT_HQ,   title: "TAB coordination",             status: "in_progress", priority: "high" },
    { organization_id: orgId, project_id: DEMO.IDS.PROJECT_SUNBELT_HQ,   title: "Submit O&M manuals",           status: "pending",     priority: "medium" },
    { organization_id: orgId, project_id: DEMO.IDS.PROJECT_NAS_FITNESS,  title: "Owner-furnished equip RFI",    status: "open",        priority: "high" },
    { organization_id: orgId, project_id: DEMO.IDS.PROJECT_NAS_FITNESS,  title: "Sequence of operations review", status: "in_progress", priority: "medium" },
    { organization_id: orgId, project_id: DEMO.IDS.PROJECT_HORIZON_APT,  title: "Punch list items",             status: "in_progress", priority: "high" },
    { organization_id: orgId, project_id: DEMO.IDS.PROJECT_SUNBELT_WH,   title: "Initial site walkthrough",     status: "completed",   priority: "medium" },
  ]);

  // ── CRM accounts ──────────────────────────────────────────────────────────
  await db.from("crm_accounts").insert([
    { id: DEMO.IDS.CRM_ACCT_SUNBELT, organization_id: orgId, name: "Sunbelt Construction Group", industry: "General Contracting",  stage: "customer" },
    { id: DEMO.IDS.CRM_ACCT_HORIZON, organization_id: orgId, name: "Horizon Property Management", industry: "Property Management", stage: "customer" },
    { id: DEMO.IDS.CRM_ACCT_NAS,     organization_id: orgId, name: "NAS Pensacola (NAVFAC SE)",   industry: "Government / DoD",    stage: "customer" },
  ]);

  // ── CRM contacts ──────────────────────────────────────────────────────────
  await db.from("crm_contacts").insert([
    { organization_id: orgId, account_id: DEMO.IDS.CRM_ACCT_SUNBELT, first_name: "Ray",    last_name: "Morales",  email: "r.morales@sunbeltcg.com",   title: "Project Executive" },
    { organization_id: orgId, account_id: DEMO.IDS.CRM_ACCT_SUNBELT, first_name: "Tiffany", last_name: "Dunn",   email: "t.dunn@sunbeltcg.com",      title: "Preconstruction Manager" },
    { organization_id: orgId, account_id: DEMO.IDS.CRM_ACCT_HORIZON, first_name: "Sandra", last_name: "Park",    email: "s.park@horizonpm.com",       title: "Facilities Director" },
    { organization_id: orgId, account_id: DEMO.IDS.CRM_ACCT_NAS,     first_name: "Cmdr. Chris", last_name: "Okafor", email: "c.okafor@navy.mil",    title: "Contracting Officer" },
  ]);

  // ── CRM opportunities ─────────────────────────────────────────────────────
  await db.from("crm_opportunities").insert([
    {
      organization_id: orgId,
      account_id: DEMO.IDS.CRM_ACCT_SUNBELT,
      name: "Sunbelt Medical Campus – Phase 1 Controls",
      stage: "proposal",
      estimated_value: 680000,
      bid_due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    },
    {
      organization_id: orgId,
      account_id: DEMO.IDS.CRM_ACCT_HORIZON,
      name: "Horizon Retail Center – BAS Replacement",
      stage: "qualification",
      estimated_value: 195000,
      bid_due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    },
    {
      organization_id: orgId,
      account_id: DEMO.IDS.CRM_ACCT_NAS,
      name: "NAS Pensacola Hangar 5 HVAC Controls",
      stage: "rfp_review",
      estimated_value: 1100000,
      bid_due_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    },
  ]);

  console.log(`[demo/seed] Demo org seeded for org ${orgId} at ${new Date().toISOString()}`);
}

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

function normalizeSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const resolvedProfile = await resolveUserRole(user);
  const requesterRole = resolvedProfile?.role ?? "customer";

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section");

  if (section === "billing") {
    if (requesterRole !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    const month = searchParams.get("month");
    if (!month) {
      return NextResponse.json({ error: "Missing month." }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("billing_periods")
      .select(`
        id,
        period_month,
        pct_complete,
        prior_pct,
        prev_billed,
        actual_billed,
        estimated_income_snapshot,
        notes,
        synced_from_onedrive,
        project:projects (
          id,
          name,
          job_number,
          is_active,
          customer:customers ( name ),
          pm:profiles ( email, full_name ),
          pm_directory:pm_directory ( id, first_name, last_name, email ),
          project_assignments (
            role_on_project,
            profile:profiles ( email, full_name ),
            pm_directory:pm_directory ( first_name, last_name, email )
          )
        )
      `)
      .eq("period_month", month)
      .order("period_month");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const periods = data ?? [];
    const projectIds = periods
      .map((period) => {
        const project = Array.isArray(period.project) ? period.project[0] : period.project;
        return project?.id ?? null;
      })
      .filter((id): id is string => Boolean(id));

    const [recentUpdatesResult, pocItemsResult] = projectIds.length
      ? await Promise.all([
          adminClient
            .from("weekly_updates")
            .select("project_id")
            .in("project_id", projectIds)
            .gte("week_of", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
          adminClient
            .from("poc_line_items")
            .select("project_id")
            .in("project_id", projectIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

    if (recentUpdatesResult.error || pocItemsResult.error) {
      return NextResponse.json({
        error:
          recentUpdatesResult.error?.message ||
          pocItemsResult.error?.message ||
          "Failed to load billing metadata.",
      }, { status: 500 });
    }

    return NextResponse.json({
      periods,
      recentUpdateProjectIds: [...new Set((recentUpdatesResult.data ?? []).map((update) => update.project_id))],
      pocDrivenProjectIds: [...new Set((pocItemsResult.data ?? []).map((item) => item.project_id))],
    });
  }

  if (section === "projects") {
    if (requesterRole !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    const { data, error } = await adminClient
      .from("projects")
      .select(`
        id,
        name,
        job_number,
        estimated_income,
        contract_price,
        migration_status,
        is_active,
        billed_in_full,
        paid_in_full,
        completed_at,
        customer_id,
        customer_poc,
        customer_po_number,
        site_address,
        general_contractor,
        mechanical_contractor,
        electrical_contractor,
        all_conduit_plenum,
        certified_payroll,
        buy_american,
        bond_required,
        source_estimate_id,
        special_requirements,
        special_access,
        notes,
        pm_directory_id,
        pm_id,
        sharepoint_folder,
        created_at,
        customer:customers(name),
        pm_directory:pm_directory(id, first_name, last_name, email, profile_id),
        project_assignments(
          id,
          profile_id,
          pm_directory_id,
          role_on_project,
          profile:profiles(id, full_name, email, role),
          pm_directory:pm_directory(id, first_name, last_name, email, profile_id)
        )
      `)
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ projects: data ?? [] });
  }

  if (section === "ops-projects") {
    if (requesterRole !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const [projectsResult, updatesResult] = await Promise.all([
      adminClient
        .from("projects")
        .select(`
          id,
          name,
          is_active,
          sharepoint_folder,
          customer:customers(name),
          pm:profiles(full_name, email),
          pm_directory:pm_directory(first_name, last_name, email),
          project_assignments(
            role_on_project,
            profile:profiles(full_name, email),
            pm_directory:pm_directory(first_name, last_name, email)
          )
        `)
        .order("name"),
      adminClient
        .from("weekly_updates")
        .select("project_id, pct_complete, week_of")
        .eq("status", "submitted")
        .order("week_of", { ascending: false }),
    ]);

    if (projectsResult.error || updatesResult.error) {
      return NextResponse.json({
        error:
          projectsResult.error?.message ||
          updatesResult.error?.message ||
          "Failed to load ops projects.",
      }, { status: 500 });
    }

    const pctByProjectId = new Map<string, number>();
    for (const update of (updatesResult.data ?? [])) {
      if (!pctByProjectId.has(update.project_id) && update.pct_complete !== null) {
        pctByProjectId.set(update.project_id, update.pct_complete);
      }
    }
    const normalizedProjects = (((projectsResult.data ?? []) as Array<{
      id: string;
      name: string;
      is_active: boolean | null;
      sharepoint_folder?: string | null;
      customer?: { name?: string | null } | Array<{ name?: string | null }> | null;
      pm?: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }> | null;
      pm_directory?:
        | { first_name?: string | null; last_name?: string | null; email?: string | null }
        | Array<{ first_name?: string | null; last_name?: string | null; email?: string | null }>
        | null;
      project_assignments?: Array<{
        role_on_project?: string | null;
        profile?: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }> | null;
        pm_directory?:
          | { first_name?: string | null; last_name?: string | null; email?: string | null }
          | Array<{ first_name?: string | null; last_name?: string | null; email?: string | null }>
          | null;
      }> | null;
    }>) ?? [])
      .map((project) => {
        const pm = normalizeSingle(project.pm);
        const pmDirectory = normalizeSingle(project.pm_directory);
        const customer = normalizeSingle(project.customer);
        const primaryAssignment = (project.project_assignments ?? []).find((assignment) => assignment?.role_on_project === "pm");
        const assignmentProfile = normalizeSingle(primaryAssignment?.profile);
        const assignmentDirectory = normalizeSingle(primaryAssignment?.pm_directory);
        const assignmentDirectoryName = [assignmentDirectory?.first_name, assignmentDirectory?.last_name].filter(Boolean).join(" ").trim();
        const pmDirectoryName = [pmDirectory?.first_name, pmDirectory?.last_name].filter(Boolean).join(" ").trim();
        const pmGroupName =
          assignmentProfile?.full_name ||
          assignmentDirectoryName ||
          pm?.full_name ||
          pmDirectoryName ||
          assignmentProfile?.email ||
          assignmentDirectory?.email ||
          pm?.email ||
          pmDirectory?.email ||
          "Unassigned";

        return {
          id: project.id,
          name: project.name,
          is_active: project.is_active !== false,
          customerName: customer?.name ?? null,
          pmGroupName,
          pctComplete: (pctByProjectId.get(project.id) ?? 0) * 100,
          sharepointFolder: project.sharepoint_folder ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ projects: normalizedProjects });
  }

  if (section === "me") {
    if (!["admin", "ops_manager"].includes(requesterRole)) {
      return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
    }

    return NextResponse.json({
      profile: resolvedProfile
        ? {
            id: resolvedProfile.id,
            email: resolvedProfile.email,
            full_name: resolvedProfile.full_name,
            role: resolvedProfile.role,
          }
        : null,
    });
  }

  if (section === "project") {
    if (!["admin", "ops_manager"].includes(requesterRole)) {
      return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
    }
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing project id." }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("projects")
      .select(`
        id,
        name,
        job_number,
        estimated_income,
        contract_price,
        migration_status,
        is_active,
        billed_in_full,
        paid_in_full,
        completed_at,
        customer_id,
        customer_poc,
        customer_po_number,
        site_address,
        general_contractor,
        mechanical_contractor,
        electrical_contractor,
        all_conduit_plenum,
        certified_payroll,
        buy_american,
        bond_required,
        source_estimate_id,
        special_requirements,
        special_access,
        notes,
        pm_directory_id,
        pm_id,
        sharepoint_folder,
        created_at,
        customer:customers(name),
        pm_directory:pm_directory(id, first_name, last_name, email, profile_id),
        project_assignments(
          id,
          profile_id,
          pm_directory_id,
          role_on_project,
          profile:profiles(id, full_name, email, role),
          pm_directory:pm_directory(id, first_name, last_name, email, profile_id)
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ project: data });
  }

  if (section === "project-lookups") {
    if (!["admin", "ops_manager"].includes(requesterRole)) {
      return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
    }
    const [customersResult, profilesResult, contactsResult] = await Promise.all([
      adminClient.from("customers").select("id, name, contact_email").order("name"),
      adminClient.from("profiles").select("id, full_name, email, role").in("role", ["pm", "lead", "installer", "ops_manager"]).order("full_name"),
      adminClient.from("pm_directory").select("id, first_name, last_name, email, profile_id").order("email"),
    ]);

    if (customersResult.error || profilesResult.error || contactsResult.error) {
      return NextResponse.json({
        error:
          customersResult.error?.message ||
          profilesResult.error?.message ||
          contactsResult.error?.message ||
          "Failed to load project lookups.",
      }, { status: 500 });
    }

    return NextResponse.json({
      customers: customersResult.data ?? [],
      profiles: profilesResult.data ?? [],
      contacts: contactsResult.data ?? [],
    });
  }

  if (section === "contacts") {
    if (requesterRole !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    const [contactResult, profileResult] = await Promise.all([
      adminClient
        .from("pm_directory")
        .select("id, email, first_name, last_name, phone, profile_id, intended_role, profile:profiles(full_name)")
        .order("email"),
      adminClient.from("profiles").select("email, role"),
    ]);

    if (contactResult.error || profileResult.error) {
      return NextResponse.json({
        error: contactResult.error?.message || profileResult.error?.message || "Failed to load contacts.",
      }, { status: 500 });
    }

    return NextResponse.json({
      contacts: contactResult.data ?? [],
      profiles: profileResult.data ?? [],
    });
  }

  if (section === "weekly-updates") {
    if (requesterRole !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    const { data, error } = await adminClient
      .from("weekly_updates")
      .select(`
        id,
        week_of,
        pct_complete,
        blockers,
        status,
        submitted_at,
        pm:profiles(full_name, email),
        project:projects(
          name,
          customer:customers(name),
          project_assignments(
            role_on_project,
            profile:profiles(full_name, email),
            pm_directory:pm_directory(first_name, last_name, email)
          )
        )
      `)
      .order("submitted_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updates: data ?? [] });
  }

  if (section === "feedback") {
    if (!["admin", "ops_manager"].includes(requesterRole)) {
      return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
    }
    const showUnreviewedOnly = searchParams.get("unreviewedOnly") === "true";
    let query = adminClient
      .from("customer_feedback")
      .select("id, project_id, profile_id, message, submitted_at, reviewed, project:projects(name), profile:profiles(email)")
      .order("submitted_at", { ascending: false });

    if (showUnreviewedOnly) {
      query = query.eq("reviewed", false);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ feedback: data ?? [] });
  }

  if (section === "users") {
    if (requesterRole !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    const { data, error } = await adminClient
      .from("profiles")
      .select("id, full_name, email, role")
      .order("role")
      .order("email");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data ?? [] });
  }

  if (section === "analytics") {
    if (!["admin", "ops_manager"].includes(requesterRole)) {
      return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
    }

    const startMonth = searchParams.get("startMonth");
    const endMonth = searchParams.get("endMonth");
    const currentMonth = new Date().toISOString().slice(0, 10).replace(/-\d{2}$/, "-01");

    let billingQuery = adminClient
      .from("billing_periods")
      .select("period_month, estimated_income_snapshot, pct_complete, prev_billed, actual_billed, project_id");

    if (startMonth) {
      billingQuery = billingQuery.gte("period_month", startMonth);
    }

    if (endMonth) {
      billingQuery = billingQuery.lte("period_month", endMonth);
    }

    const [billingResult, projectsResult] = await Promise.all([
      billingQuery,
      adminClient
        .from("projects")
        .select("id, estimated_income, is_active, customer:customers(name)")
        .eq("is_active", true),
    ]);

    if (billingResult.error || projectsResult.error) {
      return NextResponse.json({
        error:
          billingResult.error?.message ||
          projectsResult.error?.message ||
          "Failed to load analytics data.",
      }, { status: 500 });
    }

    const [projectsForStatusResult, latestPeriodsResult, assignmentsResult, customerBacklogResult] = await Promise.all([
      adminClient
        .from("projects")
        .select("id, is_active")
        .order("name"),
      adminClient
        .from("billing_periods")
        .select("project_id, pct_complete")
        .eq("period_month", currentMonth),
      adminClient
        .from("project_assignments")
        .select("profile_id, role_on_project, project:projects(is_active), profile:profiles(full_name)")
        .eq("role_on_project", "pm"),
      adminClient
        .from("projects")
        .select("estimated_income, customer:customers(name)")
        .eq("is_active", true)
        .gt("estimated_income", 0),
    ]);

    const extraError =
      projectsForStatusResult.error ||
      latestPeriodsResult.error ||
      assignmentsResult.error ||
      customerBacklogResult.error;

    if (extraError) {
      return NextResponse.json({
        error:
          projectsForStatusResult.error?.message ||
          latestPeriodsResult.error?.message ||
          assignmentsResult.error?.message ||
          customerBacklogResult.error?.message ||
          "Failed to load analytics breakdowns.",
      }, { status: 500 });
    }

    const pctMap = new Map((latestPeriodsResult.data ?? []).map((period) => [period.project_id, period.pct_complete ?? 0]));
    let active = 0;
    let nearComplete = 0;
    let complete = 0;
    let noUpdates = 0;

    for (const project of projectsForStatusResult.data ?? []) {
      if (!project.is_active) {
        complete += 1;
        continue;
      }

      const pct = pctMap.get(project.id);
      if (pct === undefined) {
        noUpdates += 1;
      } else if (pct >= 0.95) {
        complete += 1;
      } else if (pct >= 0.75) {
        nearComplete += 1;
      } else {
        active += 1;
      }
    }

    const projectStatusBreakdown = [
      { name: "Active", value: active },
      { name: "Near Complete", value: nearComplete },
      { name: "Complete", value: complete },
      { name: "No Updates", value: noUpdates },
    ].filter((item) => item.value > 0);

    const workloadMap = new Map<string, { name: string; count: number }>();
    for (const assignment of assignmentsResult.data ?? []) {
      const project = normalizeSingle(assignment.project);
      if (!project?.is_active) continue;
      const profile = normalizeSingle(assignment.profile);
      const name = profile?.full_name ?? "Unknown";
      const existing = workloadMap.get(name) ?? { name, count: 0 };
      workloadMap.set(name, { ...existing, count: existing.count + 1 });
    }
    const pmWorkload = Array.from(workloadMap.values()).sort((a, b) => b.count - a.count);

    const customerMap = new Map<string, number>();
    for (const project of customerBacklogResult.data ?? []) {
      const customer = normalizeSingle(project.customer);
      const name = customer?.name ?? "Unknown";
      customerMap.set(name, (customerMap.get(name) ?? 0) + (project.estimated_income ?? 0));
    }
    const topCustomers = Array.from(customerMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return NextResponse.json({
      billingPeriods: billingResult.data ?? [],
      projects: projectsResult.data ?? [],
      projectStatusBreakdown,
      pmWorkload,
      topCustomers,
    });
  }

  if (section === "project-weekly-updates") {
    if (!["admin", "ops_manager"].includes(requesterRole)) {
      return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
    }

    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Missing project id." }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("weekly_updates")
      .select("id, week_of, pct_complete, status, blockers")
      .eq("project_id", projectId)
      .order("week_of", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updates: data ?? [] });
  }

  if (section === "project-customer-contacts") {
    if (!["admin", "ops_manager"].includes(requesterRole)) {
      return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
    }

    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Missing project id." }, { status: 400 });
    }

    const [contactResult, availableContactsResult] = await Promise.all([
      adminClient
        .from("project_customer_contacts")
        .select("*, profile:profiles(*)")
        .eq("project_id", projectId),
      adminClient
        .from("pm_directory")
        .select("id, email, first_name, last_name, profile_id")
        .order("email"),
    ]);

    if (contactResult.error || availableContactsResult.error) {
      return NextResponse.json({
        error:
          contactResult.error?.message ||
          availableContactsResult.error?.message ||
          "Failed to load customer contacts.",
      }, { status: 500 });
    }

    return NextResponse.json({
      contacts: contactResult.data ?? [],
      availableContacts: availableContactsResult.data ?? [],
    });
  }

  if (section === "project-poc-items") {
    if (!["admin", "ops_manager"].includes(requesterRole)) {
      return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
    }

    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Missing project id." }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("poc_line_items")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [] });
  }

  return NextResponse.json({ error: "Unknown section." }, { status: 400 });
}

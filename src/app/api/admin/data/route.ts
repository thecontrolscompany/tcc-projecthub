import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

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
    if (requesterRole !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
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
    if (requesterRole !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const startMonth = searchParams.get("startMonth");
    const endMonth = searchParams.get("endMonth");

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

    return NextResponse.json({
      billingPeriods: billingResult.data ?? [],
      projects: projectsResult.data ?? [],
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
      .select("id, week_of, pct_complete, notes, blockers")
      .eq("project_id", projectId)
      .order("week_of", { ascending: false });

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

    const [contactResult, profileResult] = await Promise.all([
      adminClient
        .from("project_customer_contacts")
        .select("*, profile:profiles(*)")
        .eq("project_id", projectId),
      adminClient
        .from("profiles")
        .select("*")
        .eq("role", "customer")
        .order("email"),
    ]);

    if (contactResult.error || profileResult.error) {
      return NextResponse.json({
        error:
          contactResult.error?.message ||
          profileResult.error?.message ||
          "Failed to load customer contacts.",
      }, { status: 500 });
    }

    return NextResponse.json({
      contacts: contactResult.data ?? [],
      profiles: profileResult.data ?? [],
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

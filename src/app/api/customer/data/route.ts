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
  const previewAs = searchParams.get("previewAs");

  // Admin/ops_manager may pass ?previewAs=profileId to view as another customer.
  // Any authenticated user may view their own portal if they have project_customer_contacts rows.
  const isAdminPreview = previewAs && ["admin", "ops_manager"].includes(requesterRole);

  if (!isAdminPreview && requesterRole !== "customer") {
    // Non-customer viewing their own portal — allow if they have contact rows (checked below)
    // Anything other than their own data is denied
    if (previewAs && previewAs !== user.id) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
  }

  const viewingAs = isAdminPreview ? previewAs : user.id;

  if (section === "projects") {
    const { data: contactRows, error: contactError } = await adminClient
      .from("project_customer_contacts")
      .select("project_id")
      .eq("profile_id", viewingAs)
      .eq("portal_access", true);

    if (contactError) {
      return NextResponse.json({ error: contactError.message }, { status: 500 });
    }

    const projectIds = [...new Set((contactRows ?? []).map((row) => row.project_id))];

    if (projectIds.length === 0) {
      return NextResponse.json({
        projects: [],
        billingPeriods: [],
        weeklyUpdates: [],
        assignments: [],
        changeOrders: [],
        photosByProject: {},
      });
    }

    const [projectsResult, billingResult, updatesResult, assignmentsResult, changeOrdersResult, photosResult] = await Promise.all([
      adminClient
        .from("projects")
        .select("id, name, estimated_income, job_number, site_address, general_contractor, start_date, scheduled_completion, scope_description, customer:customers(name)")
        .in("id", projectIds)
        .eq("is_active", true)
        .order("name"),
      adminClient
        .from("billing_periods")
        .select("*")
        .in("project_id", projectIds)
        .order("period_month", { ascending: false }),
      adminClient
        .from("weekly_updates")
        .select(`
          id,
          project_id,
          pm_id,
          week_of,
          pct_complete,
          notes,
          blockers,
          submitted_at,
          crew_log,
          material_delivered,
          equipment_set,
          safety_incidents,
          inspections_tests,
          delays_impacts,
          other_remarks,
          include_bom_report
        `)
        .in("project_id", projectIds)
        .eq("status", "submitted")
        .order("week_of", { ascending: false })
        .limit(100),
      adminClient
        .from("project_assignments")
        .select(`
          project_id,
          role_on_project,
          is_primary,
          profile_id,
          pm_directory_id,
          profile:profiles(full_name, email),
          pm_directory:pm_directory(first_name, last_name, email, phone)
        `)
        .in("project_id", projectIds)
        .in("role_on_project", ["pm", "lead", "ops_manager"]),
      adminClient
        .from("change_orders")
        .select("id, project_id, co_number, title, amount, status, submitted_date, approved_date, reference_doc")
        .in("project_id", projectIds)
        .in("status", ["approved"]),
      adminClient
        .from("project_photos")
        .select("project_id")
        .in("project_id", projectIds),
    ]);

    const readError =
      projectsResult.error ||
      billingResult.error ||
      updatesResult.error ||
      assignmentsResult.error ||
      changeOrdersResult.error ||
      photosResult.error;

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    return NextResponse.json({
      projects: projectsResult.data ?? [],
      billingPeriods: billingResult.data ?? [],
      weeklyUpdates: updatesResult.data ?? [],
      assignments: assignmentsResult.data ?? [],
      changeOrders: changeOrdersResult.data ?? [],
      photosByProject: (photosResult.data ?? []).reduce((acc: Record<string, number>, row: { project_id: string }) => {
        acc[row.project_id] = (acc[row.project_id] ?? 0) + 1;
        return acc;
      }, {}),
    });
  }

  return NextResponse.json({ error: "Unknown section." }, { status: 400 });
}

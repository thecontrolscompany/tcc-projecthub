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

  if (requesterRole !== "customer") {
    return NextResponse.json({ error: "Customer access required." }, { status: 403 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section");

  if (section === "projects") {
    const { data: contactRows, error: contactError } = await adminClient
      .from("project_customer_contacts")
      .select("project_id")
      .eq("profile_id", user.id)
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
      });
    }

    const [projectsResult, billingResult, updatesResult, assignmentsResult, changeOrdersResult] = await Promise.all([
      adminClient
        .from("projects")
        .select("id, name, estimated_income, job_number, site_address, general_contractor, customer:customers(name)")
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
          other_remarks
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
          profile:profiles(full_name, email),
          pm_directory:pm_directory(first_name, last_name, email, phone)
        `)
        .in("project_id", projectIds)
        .in("role_on_project", ["pm", "lead"]),
      adminClient
        .from("change_orders")
        .select("id, project_id, co_number, title, amount, status, submitted_date, approved_date, reference_doc")
        .in("project_id", projectIds)
        .in("status", ["approved"]),
    ]);

    const readError =
      projectsResult.error ||
      billingResult.error ||
      updatesResult.error ||
      assignmentsResult.error ||
      changeOrdersResult.error;

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    return NextResponse.json({
      projects: projectsResult.data ?? [],
      billingPeriods: billingResult.data ?? [],
      weeklyUpdates: updatesResult.data ?? [],
      assignments: assignmentsResult.data ?? [],
      changeOrders: changeOrdersResult.data ?? [],
    });
  }

  return NextResponse.json({ error: "Unknown section." }, { status: 400 });
}

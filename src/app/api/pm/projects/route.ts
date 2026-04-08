import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { linkAndGetPmDirectoryIds } from "@/lib/auth/link-pm-directory";
import type { WeeklyUpdateEdit } from "@/types/database";

interface ProjectContact {
  id: string;
  role: string;
  company: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  sort_order: number;
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
  if (!resolvedProfile || !["pm", "lead", "ops_manager", "admin"].includes(resolvedProfile.role)) {
    return NextResponse.json({ error: "PM or lead access required." }, { status: 403 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section");

  await linkAndGetPmDirectoryIds(adminClient, user);

  if (section === "project-data") {
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Missing project id." }, { status: 400 });
    }

    const currentMonthForPeriod = new Date();
    const currentMonthStrForPeriod = `${currentMonthForPeriod.getUTCFullYear()}-${String(currentMonthForPeriod.getUTCMonth() + 1).padStart(2, "0")}-01`;

    const [updatesResult, pocResult, contactsResult, periodResult] = await Promise.all([
      adminClient
        .from("weekly_updates")
        .select("id, project_id, pm_id, week_of, pct_complete, notes, blockers, poc_snapshot, crew_log, material_delivered, equipment_set, safety_incidents, inspections_tests, delays_impacts, other_remarks, imported_from, status, submitted_at")
        .eq("project_id", projectId)
        .order("week_of", { ascending: false }),
      adminClient
        .from("poc_line_items")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order"),
      adminClient
        .from("project_contacts")
        .select("id, role, company, contact_name, phone, email, notes, sort_order")
        .eq("project_id", projectId)
        .order("sort_order")
        .order("created_at"),
      adminClient
        .from("billing_periods")
        .select("*")
        .eq("project_id", projectId)
        .eq("period_month", currentMonthStrForPeriod)
        .maybeSingle(),
    ]);

    if (updatesResult.error || pocResult.error || contactsResult.error) {
      return NextResponse.json({
        error:
          updatesResult.error?.message ||
          pocResult.error?.message ||
          contactsResult.error?.message ||
          "Failed to load project data.",
      }, { status: 500 });
    }

    const updates = updatesResult.data ?? [];
    const latestUpdate = updates[0] ?? null;
    let editHistory: WeeklyUpdateEdit[] = [];

    if (latestUpdate) {
      const { data: edits } = await adminClient
        .from("weekly_update_edits")
        .select("id, weekly_update_id, edited_by_profile_id, edited_at, editor_name, note")
        .eq("weekly_update_id", latestUpdate.id)
        .order("edited_at", { ascending: false });

      editHistory = (edits as WeeklyUpdateEdit[] | null) ?? [];
    }

    return NextResponse.json({
      updates,
      pocItems: pocResult.data ?? [],
      contacts: (contactsResult.data ?? []) as ProjectContact[],
      editHistory,
      currentPeriod: periodResult.data ?? null,
    });
  }

  const currentMonth = new Date();
  const currentMonthStr = `${currentMonth.getUTCFullYear()}-${String(currentMonth.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const linkedPmDirectoryIds = await linkAndGetPmDirectoryIds(adminClient, user);
  const assignmentQuery = adminClient
    .from("project_assignments")
    .select(`
      role_on_project,
      project:projects(
        id,
        customer_id,
        pm_id,
        name,
        estimated_income,
        onedrive_path,
        sharepoint_folder,
        sharepoint_item_id,
        job_number,
        start_date,
        scheduled_completion,
        scope_description,
        migration_status,
        is_active,
        created_at,
        customer:customers(name)
      )
    `)
    .in("role_on_project", ["pm", "lead", "ops_manager"]);

  const { data: assignmentData, error: assignmentError } = linkedPmDirectoryIds.length
    ? await assignmentQuery.or(`profile_id.eq.${user.id},pm_directory_id.in.(${linkedPmDirectoryIds.join(",")})`)
    : await assignmentQuery.eq("profile_id", user.id);

  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 });
  }

  const normalizedProjects = (((assignmentData ?? []) as Array<{
    role_on_project: "pm" | "lead" | "installer" | "ops_manager";
    project:
      | {
          id: string;
          customer_id: string | null;
          pm_id: string | null;
          name: string;
          estimated_income: number;
          onedrive_path: string | null;
          sharepoint_folder: string | null;
          sharepoint_item_id: string | null;
          job_number: string | null;
          start_date: string | null;
          scheduled_completion: string | null;
          scope_description: string | null;
          migration_status: "legacy" | "migrated" | "clean" | null;
          is_active: boolean;
          created_at: string;
          customer?: { name: string } | Array<{ name: string }> | null;
        }
      | Array<{
          id: string;
          customer_id: string | null;
          pm_id: string | null;
          name: string;
          estimated_income: number;
          onedrive_path: string | null;
          sharepoint_folder: string | null;
          sharepoint_item_id: string | null;
          job_number: string | null;
          start_date: string | null;
          scheduled_completion: string | null;
          scope_description: string | null;
          migration_status: "legacy" | "migrated" | "clean" | null;
          is_active: boolean;
          created_at: string;
          customer?: { name: string } | Array<{ name: string }> | null;
        }>;
  }>)
    .map((assignment) => {
      const project = Array.isArray(assignment.project) ? assignment.project[0] : assignment.project;
      if (!project || project.is_active === false) return null;
      const customer = Array.isArray(project.customer) ? project.customer[0] : project.customer;
      return {
        ...project,
        assignmentRole: assignment.role_on_project,
        customer: customer ?? null,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      customer_id: string | null;
      pm_id: string | null;
      name: string;
      estimated_income: number;
      onedrive_path: string | null;
      sharepoint_folder: string | null;
      sharepoint_item_id: string | null;
      job_number: string | null;
      start_date: string | null;
      scheduled_completion: string | null;
      scope_description: string | null;
      migration_status: "legacy" | "migrated" | "clean" | null;
      is_active: boolean;
      created_at: string;
      assignmentRole: "pm" | "lead" | "installer" | "ops_manager";
      customer: { name: string } | null;
    }>)
    .sort((a, b) => a.name.localeCompare(b.name));

  const ids = normalizedProjects.map((project) => project.id);
  const { data: periods, error: periodsError } = ids.length
    ? await adminClient
        .from("billing_periods")
        .select("*")
        .in("project_id", ids)
        .order("period_month", { ascending: false })
    : { data: [], error: null };

  if (periodsError) {
    return NextResponse.json({ error: periodsError.message }, { status: 500 });
  }

  // Take the most recent period per project (periods are ordered desc)
  const periodMap = new Map<string, typeof periods[number]>();
  for (const period of (periods ?? [])) {
    if (!periodMap.has(period.project_id)) {
      periodMap.set(period.project_id, period);
    }
  }

  return NextResponse.json({
    projects: normalizedProjects.map((project) => ({
      ...project,
      current_period: periodMap.get(project.id) ?? null,
    })),
  });
}

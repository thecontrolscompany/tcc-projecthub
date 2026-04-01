import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

export async function GET() {
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

  const currentMonth = new Date();
  const currentMonthStr = `${currentMonth.getUTCFullYear()}-${String(currentMonth.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const { data: assignmentData, error: assignmentError } = await adminClient
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
        migration_status,
        is_active,
        created_at,
        customer:customers(name)
      )
    `)
    .eq("profile_id", user.id)
    .in("role_on_project", ["pm", "lead", "ops_manager"]);

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
        .eq("period_month", currentMonthStr)
    : { data: [], error: null };

  if (periodsError) {
    return NextResponse.json({ error: periodsError.message }, { status: 500 });
  }

  const periodMap = new Map((periods ?? []).map((period) => [period.project_id, period]));

  return NextResponse.json({
    projects: normalizedProjects.map((project) => ({
      ...project,
      current_period: periodMap.get(project.id) ?? null,
    })),
  });
}

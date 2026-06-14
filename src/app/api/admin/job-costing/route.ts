import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { computeProjectBudget } from "@/lib/budget/calculations";

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const profile = await resolveUserRole(user);
  if (!["admin", "ops_manager"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: projects, error } = await adminClient
    .from("projects")
    .select("id, name, job_number, customer:customers(name)")
    .eq("is_active", true)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    const rows = await Promise.all(
      (projects ?? []).map(async (project) => {
        const summary = await computeProjectBudget(adminClient, project.id);
        if (!summary) return null;

        const { labor, material, subcontractor, other } = summary.totals;
        const budgeted = labor.budgeted + material.budgeted + subcontractor.budgeted + other.budgeted;
        const actual = labor.actual + material.actual + subcontractor.actual + other.actual;
        const customer = Array.isArray(project.customer) ? project.customer[0] : project.customer;

        return {
          projectId: project.id,
          name: project.name,
          jobNumber: project.job_number ?? null,
          customerName: customer?.name ?? null,
          budgeted,
          actual,
          variance: budgeted - actual,
        };
      })
    );

    return NextResponse.json({ projects: rows.filter((row) => row !== null) });
  } catch (err) {
    console.error("Failed to load job costing:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load job costing." }, { status: 500 });
  }
}

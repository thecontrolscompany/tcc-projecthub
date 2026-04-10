import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { linkAndGetPmDirectoryIds } from "@/lib/auth/link-pm-directory";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Verify the PM has an assignment on the project
async function isPmAssignedToProject(admin: ReturnType<typeof adminClient>, profileId: string, projectId: string): Promise<boolean> {
  const pmDirRows = await admin
    .from("pm_directory")
    .select("id")
    .eq("profile_id", profileId);

  const pmDirIds = (pmDirRows.data ?? []).map((r: { id: string }) => r.id);

  const directCheck = await admin
    .from("project_assignments")
    .select("id")
    .eq("project_id", projectId)
    .eq("profile_id", profileId)
    .in("role_on_project", ["pm", "lead", "ops_manager"])
    .limit(1)
    .maybeSingle();

  if (directCheck.data) return true;

  if (pmDirIds.length > 0) {
    const dirCheck = await admin
      .from("project_assignments")
      .select("id")
      .eq("project_id", projectId)
      .in("pm_directory_id", pmDirIds)
      .in("role_on_project", ["pm", "lead", "ops_manager"])
      .limit(1)
      .maybeSingle();

    if (dirCheck.data) return true;
  }

  return false;
}

export async function PATCH(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const resolvedProfile = await resolveUserRole(user);
  if (!resolvedProfile || !["pm", "lead", "ops_manager", "admin"].includes(resolvedProfile.role)) {
    return NextResponse.json({ error: "PM or lead access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    billingPeriodId?: string;
    projectId?: string;
    pctComplete?: number;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { billingPeriodId, projectId, pctComplete } = body;

  if (!billingPeriodId || typeof billingPeriodId !== "string") {
    return NextResponse.json({ error: "Missing billingPeriodId." }, { status: 400 });
  }
  if (!projectId || typeof projectId !== "string") {
    return NextResponse.json({ error: "Missing projectId." }, { status: 400 });
  }
  if (typeof pctComplete !== "number" || !Number.isFinite(pctComplete)) {
    return NextResponse.json({ error: "Missing or invalid pctComplete." }, { status: 400 });
  }

  const admin = adminClient();

  await linkAndGetPmDirectoryIds(admin, user);

  const assigned = await isPmAssignedToProject(admin, user.id, projectId);
  if (!assigned && resolvedProfile.role !== "admin") {
    return NextResponse.json({ error: "You are not assigned to this project." }, { status: 403 });
  }

  // Verify the billing period belongs to this project
  const { data: period, error: periodError } = await admin
    .from("billing_periods")
    .select("id, project_id, period_month")
    .eq("id", billingPeriodId)
    .eq("project_id", projectId)
    .single();

  if (periodError || !period) {
    return NextResponse.json({ error: "Billing period not found." }, { status: 404 });
  }

  const pctDecimal = Math.min(Math.max(pctComplete / 100, 0), 1);

  const { error: updateError } = await admin
    .from("billing_periods")
    .update({ pct_complete: pctDecimal })
    .eq("id", billingPeriodId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pct_complete: pctDecimal });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EstimatePayload, UserRole } from "@/types/database";

function isPrivilegedRole(role: UserRole | null | undefined) {
  return role === "admin" || role === "ops_manager";
}

/**
 * POST /api/estimator/sync-poc
 * Body: { project_id: string, estimate_payload: EstimatePayload }
 *
 * Future implementation notes:
 * 1. Validate the posted estimate belongs to a known project or source_estimate_id.
 * 2. Map estimate assemblies (VAV, AHU, FCU, etc.) into project-level poc_line_items categories.
 * 3. Set weights proportional to assembly labor hours.
 * 4. Initialize pct_complete for new poc_line_items at 0.
 * 5. Replace the project's existing poc_line_items so the estimator remains the source for the initial seed.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!isPrivilegedRole(profile?.role as UserRole | null | undefined)) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const body = (await request.json()) as { project_id?: string; estimate_payload?: EstimatePayload };

  if (!body.project_id || !body.estimate_payload) {
    return NextResponse.json({ error: "project_id and estimate_payload are required." }, { status: 400 });
  }

  const payload = body.estimate_payload;

  console.info("Estimator sync stub received payload", {
    project_id: body.project_id,
    estimate_id: payload.estimate_id,
    received_items: payload.items.length,
  });

  return NextResponse.json({
    message: "Stub - POC sync not yet implemented",
    project_id: body.project_id,
    received_items: payload.items.length,
  });
}

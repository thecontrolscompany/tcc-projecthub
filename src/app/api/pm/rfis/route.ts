import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function verifyProjectAccess(projectId: string, userId: string, role: string): Promise<boolean> {
  if (role === "admin" || role === "ops_manager") return true;
  const admin = adminClient();
  const { data: pmRows } = await admin.from("pm_directory").select("id").eq("profile_id", userId);
  const pmDirIds = (pmRows ?? []).map((r: { id: string }) => r.id);
  const { data: direct } = await admin
    .from("project_assignments")
    .select("id")
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .limit(1);
  if ((direct ?? []).length > 0) return true;
  if (pmDirIds.length > 0) {
    const { data: dir } = await admin
      .from("project_assignments")
      .select("id")
      .eq("project_id", projectId)
      .in("pm_directory_id", pmDirIds)
      .limit(1);
    if ((dir ?? []).length > 0) return true;
  }
  return false;
}

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const resolvedProfile = await resolveUserRole(user);
  const role = resolvedProfile?.role ?? "customer";
  if (!["admin", "ops_manager", "pm", "lead"].includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "Missing projectId." }, { status: 400 });

  const hasAccess = await verifyProjectAccess(projectId, user.id, role);
  if (!hasAccess) return NextResponse.json({ error: "Not assigned to this project." }, { status: 403 });

  const { data, error } = await adminClient()
    .from("project_rfis")
    .select("*")
    .eq("project_id", projectId)
    .order("rfi_number", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rfis: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const resolvedProfile = await resolveUserRole(user);
  const role = resolvedProfile?.role ?? "customer";
  if (!["admin", "ops_manager", "pm", "lead"].includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.projectId) return NextResponse.json({ error: "Missing projectId." }, { status: 400 });
  if (!body?.subject?.trim()) return NextResponse.json({ error: "Subject is required." }, { status: 400 });

  const hasAccess = await verifyProjectAccess(body.projectId, user.id, role);
  if (!hasAccess) return NextResponse.json({ error: "Not assigned to this project." }, { status: 403 });

  const admin = adminClient();
  const { data: existing } = await admin
    .from("project_rfis")
    .select("rfi_number")
    .eq("project_id", body.projectId)
    .order("rfi_number", { ascending: false })
    .limit(1);

  const nextNumber = ((existing?.[0]?.rfi_number ?? 0) as number) + 1;

  const { data, error } = await admin
    .from("project_rfis")
    .insert({
      project_id: body.projectId,
      rfi_number: nextNumber,
      subject: body.subject.trim(),
      question: body.question?.trim() || null,
      directed_to: body.directedTo?.trim() || null,
      date_submitted: body.dateSubmitted || new Date().toISOString().slice(0, 10),
      status: "open",
      created_by_profile_id: user.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rfi: data });
}

export async function PATCH(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const resolvedProfile = await resolveUserRole(user);
  const role = resolvedProfile?.role ?? "customer";
  if (!["admin", "ops_manager", "pm", "lead"].includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing RFI id." }, { status: 400 });

  const admin = adminClient();
  const { data: existing } = await admin.from("project_rfis").select("project_id").eq("id", body.id).single();
  if (!existing) return NextResponse.json({ error: "RFI not found." }, { status: 404 });

  const hasAccess = await verifyProjectAccess(existing.project_id, user.id, role);
  if (!hasAccess) return NextResponse.json({ error: "Not assigned to this project." }, { status: 403 });

  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.response !== undefined) updates.response = body.response?.trim() || null;
  if (body.dateResponded !== undefined) updates.date_responded = body.dateResponded || null;
  if (body.subject !== undefined) updates.subject = body.subject.trim();
  if (body.question !== undefined) updates.question = body.question?.trim() || null;
  if (body.directedTo !== undefined) updates.directed_to = body.directedTo?.trim() || null;

  const { data, error } = await admin
    .from("project_rfis")
    .update(updates)
    .eq("id", body.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rfi: data });
}

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

const ALLOWED_WRITE_ROLES = ["admin", "ops_manager"];
const ALLOWED_READ_ROLES = ["admin", "ops_manager", "pm", "lead", "installer"];

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getRequester() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, role: null };

  const profile = await resolveUserRole(user);
  return { user, role: profile?.role ?? null };
}

export async function GET(request: Request) {
  const { user, role } = await getRequester();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!ALLOWED_READ_ROLES.includes(role ?? "")) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "Project id is required." }, { status: 400 });
  }

  const client = adminClient();
  if (!ALLOWED_WRITE_ROLES.includes(role ?? "")) {
    const { data: assignment, error: assignmentError } = await client
      .from("project_assignments")
      .select("id")
      .eq("project_id", projectId)
      .eq("profile_id", user.id)
      .maybeSingle();

    if (assignmentError) {
      return NextResponse.json({ error: assignmentError.message }, { status: 500 });
    }
    if (!assignment) {
      return NextResponse.json({ error: "Project access denied." }, { status: 403 });
    }
  }

  const { data, error } = await client
    .from("wip_items")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order")
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const { user, role } = await getRequester();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!ALLOWED_WRITE_ROLES.includes(role ?? "")) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.project_id === "string" ? body.project_id : "";
  const systemArea = typeof body?.system_area === "string" ? body.system_area.trim() : "";
  const task = typeof body?.task === "string" ? body.task.trim() : "";
  const status = typeof body?.status === "string" ? body.status : "not_started";
  const blocker = typeof body?.blocker === "string" ? body.blocker.trim() : "";

  if (!projectId || !systemArea || !task) {
    return NextResponse.json({ error: "Project, system/area, and task are required." }, { status: 400 });
  }
  if (status === "blocked" && !blocker) {
    return NextResponse.json({ error: "Blocker is required when status is blocked." }, { status: 400 });
  }

  const client = adminClient();
  const { data, error } = await client
    .from("wip_items")
    .insert({
      project_id: projectId,
      system_area: systemArea,
      task,
      status,
      assigned_to: typeof body?.assigned_to === "string" ? body.assigned_to.trim() || null : null,
      responsible_co: typeof body?.responsible_co === "string" ? body.responsible_co.trim() || null : null,
      blocker: blocker || null,
      priority: typeof body?.priority === "string" ? body.priority : "medium",
      due_date: typeof body?.due_date === "string" && body.due_date ? body.due_date : null,
      notes: typeof body?.notes === "string" ? body.notes.trim() || null : null,
      sort_order: Number(body?.sort_order ?? 0),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { user, role } = await getRequester();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!ALLOWED_WRITE_ROLES.includes(role ?? "")) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "Item id is required." }, { status: 400 });
  }
  if (body?.status === "blocked" && !String(body?.blocker ?? "").trim()) {
    return NextResponse.json({ error: "Blocker is required when status is blocked." }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  for (const key of ["system_area", "task", "status", "assigned_to", "responsible_co", "priority", "due_date", "notes", "sort_order"]) {
    if (key in (body ?? {})) payload[key] = body[key];
  }
  if ("blocker" in (body ?? {})) {
    payload.blocker = String(body?.blocker ?? "").trim() || null;
  }

  const client = adminClient();
  const { data, error } = await client
    .from("wip_items")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request) {
  const { user, role } = await getRequester();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "Item id is required." }, { status: 400 });
  }

  const client = adminClient();
  const { error } = await client.from("wip_items").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

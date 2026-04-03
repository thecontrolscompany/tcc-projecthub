import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

const ALLOWED_TYPES = new Set(["bug", "feature", "ux", "other"]);
const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const ALLOWED_STATUSES = new Set(["new", "reviewing", "planned", "done", "wont_fix"]);

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

export async function GET() {
  const { user, role } = await getRequester();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!["admin", "ops_manager"].includes(role ?? "")) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const client = adminClient();
  const { data, error } = await client
    .from("portal_feedback")
    .select("*, profile:profiles(full_name, email)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ feedback: data ?? [] });
}

export async function POST(request: Request) {
  const { user, role } = await getRequester();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!["admin", "pm", "lead", "ops_manager"].includes(role ?? "")) {
    return NextResponse.json({ error: "You do not have access to submit portal feedback." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const type = typeof body?.type === "string" ? body.type : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const priority = typeof body?.priority === "string" ? body.priority : "medium";
  const pageArea = typeof body?.page_area === "string" ? body.page_area.trim() : "";

  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid feedback type." }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "Description is required." }, { status: 400 });
  }
  if (!ALLOWED_PRIORITIES.has(priority)) {
    return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
  }

  const client = adminClient();
  const { data, error } = await client
    .from("portal_feedback")
    .insert({
      submitted_by: user.id,
      type,
      title,
      description,
      priority,
      page_area: pageArea || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ feedback: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { user, role } = await getRequester();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!["admin", "ops_manager"].includes(role ?? "")) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const status = typeof body?.status === "string" ? body.status : "";

  if (!id) {
    return NextResponse.json({ error: "Feedback id is required." }, { status: 400 });
  }
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const client = adminClient();
  const { data, error } = await client
    .from("portal_feedback")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ feedback: data });
}

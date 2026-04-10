import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

const WRITE_ROLES = ["admin", "ops_manager"];
const READ_ROLES = ["admin", "ops_manager", "pm", "lead", "installer", "customer"];

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

async function verifyProjectAccess(client: ReturnType<typeof adminClient>, userId: string, projectId: string, role: string | null) {
  if (role === "customer") {
    const { data, error } = await client
      .from("project_customer_contacts")
      .select("id")
      .eq("project_id", projectId)
      .eq("profile_id", userId)
      .eq("portal_access", true)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  const { data, error } = await client
    .from("project_assignments")
    .select("id")
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function GET(request: Request) {
  const { user, role } = await getRequester();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!READ_ROLES.includes(role ?? "")) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "Project id is required." }, { status: 400 });

  const client = adminClient();
  if (!WRITE_ROLES.includes(role ?? "")) {
    const allowed = await verifyProjectAccess(client, user.id, projectId, role).catch((err) => {
      throw err;
    });
    if (!allowed) {
      return NextResponse.json({ error: "Project access denied." }, { status: 403 });
    }
  }

  const [itemsResult, receiptsResult] = await Promise.all([
    client.from("bom_items").select("*").eq("project_id", projectId).order("sort_order").order("section"),
    client
      .from("material_receipts")
      .select("*, profile:profiles(full_name, email), item:bom_items(project_id)")
      .order("date_received", { ascending: false }),
  ]);

  if (itemsResult.error || receiptsResult.error) {
    return NextResponse.json({
      error: itemsResult.error?.message || receiptsResult.error?.message || "Failed to load BOM data.",
    }, { status: 500 });
  }

  const receipts = (receiptsResult.data ?? []).filter((receipt) => {
    const item = Array.isArray(receipt.item) ? receipt.item[0] : receipt.item;
    return item?.project_id === projectId;
  });

  return NextResponse.json({ items: itemsResult.data ?? [], receipts });
}

export async function POST(request: Request) {
  const { user, role } = await getRequester();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!WRITE_ROLES.includes(role ?? "")) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const body = await request.json().catch(() => null);
  const client = adminClient();

  if (action === "receipt") {
    const { data, error } = await client
      .from("material_receipts")
      .insert({
        bom_item_id: body?.bom_item_id,
        qty_received: Number(body?.qty_received ?? 0),
        date_received: body?.date_received || new Date().toISOString().slice(0, 10),
        received_by: user.id,
        packing_slip: typeof body?.packing_slip === "string" ? body.packing_slip.trim() || null : null,
        notes: typeof body?.notes === "string" ? body.notes.trim() || null : null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ receipt: data }, { status: 201 });
  }

  const { data, error } = await client
    .from("bom_items")
    .insert({
      project_id: body?.project_id,
      section: typeof body?.section === "string" ? body.section.trim() || "General" : "General",
      designation: typeof body?.designation === "string" ? body.designation.trim() || null : null,
      code_number: typeof body?.code_number === "string" ? body.code_number.trim() || null : null,
      description: typeof body?.description === "string" ? body.description.trim() : "",
      qty_required: Number(body?.qty_required ?? 0),
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
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!WRITE_ROLES.includes(role ?? "")) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Item id is required." }, { status: 400 });

  const client = adminClient();
  const payload: Record<string, unknown> = {};
  for (const key of ["section", "designation", "code_number", "description", "qty_required", "notes", "sort_order"]) {
    if (key in (body ?? {})) payload[key] = body[key];
  }

  const { data, error } = await client
    .from("bom_items")
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
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!WRITE_ROLES.includes(role ?? "")) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const body = await request.json().catch(() => null);
  const client = adminClient();

  if (action === "receipt") {
    const { error } = await client.from("material_receipts").delete().eq("id", body?.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (action === "clear-all") {
    const projectId = typeof body?.projectId === "string" ? body.projectId : null;
    if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    const { error } = await client.from("bom_items").delete().eq("project_id", projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const { error } = await client.from("bom_items").delete().eq("id", body?.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

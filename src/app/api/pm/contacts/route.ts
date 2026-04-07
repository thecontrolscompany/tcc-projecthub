import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

export async function PUT(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const resolvedProfile = await resolveUserRole(user);
  const role = resolvedProfile?.role ?? "customer";
  if (!["admin", "ops_manager", "pm"].includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json() as {
    project_id: string;
    contacts: Array<{
      role: string;
      company?: string | null;
      contact_name?: string | null;
      phone?: string | null;
      email?: string | null;
      notes?: string | null;
      sort_order?: number;
    }>;
  };

  const { project_id, contacts } = body;
  if (!project_id) {
    return NextResponse.json({ error: "Missing project_id." }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (role === "pm") {
    const { data: pmRows } = await adminClient
      .from("pm_directory")
      .select("id")
      .eq("profile_id", user.id);

    const pmDirIds = (pmRows ?? []).map((r) => r.id);

    const { data: assignmentRows } = await adminClient
      .from("project_assignments")
      .select("project_id")
      .eq("project_id", project_id)
      .or(
        `profile_id.eq.${user.id}${pmDirIds.length > 0 ? `,pm_directory_id.in.(${pmDirIds.join(",")})` : ""}`
      )
      .limit(1);

    if (!assignmentRows?.length) {
      return NextResponse.json({ error: "Not assigned to this project." }, { status: 403 });
    }
  }

  const nonEmpty = contacts.filter(
    (c) => c.role && (c.company || c.contact_name || c.phone || c.email || c.notes)
  );

  const { error: deleteError } = await adminClient
    .from("project_contacts")
    .delete()
    .eq("project_id", project_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (nonEmpty.length > 0) {
    const rows = nonEmpty.map((c, i) => ({
      project_id,
      role: c.role,
      company: c.company ?? null,
      contact_name: c.contact_name ?? null,
      phone: c.phone ?? null,
      email: c.email ?? null,
      notes: c.notes ?? null,
      sort_order: c.sort_order ?? i,
    }));

    const { error: insertError } = await adminClient
      .from("project_contacts")
      .insert(rows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

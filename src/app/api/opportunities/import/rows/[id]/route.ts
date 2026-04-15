import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const companyName = typeof body?.company_name === "string" ? body.company_name.trim() : null;

  if (!companyName) {
    return NextResponse.json({ error: "company_name is required." }, { status: 400 });
  }

  const { id } = await params;

  const { data: row, error: rowError } = await supabase
    .from("legacy_opportunity_import_rows")
    .update({ company_name: companyName })
    .eq("id", id)
    .select("id, pursuit_id")
    .single();

  if (rowError || !row) {
    return NextResponse.json({ error: rowError?.message ?? "Row not found." }, { status: 400 });
  }

  if (row.pursuit_id) {
    await supabase
      .from("pursuits")
      .update({ owner_name: companyName })
      .eq("id", row.pursuit_id);
  }

  return NextResponse.json({ ok: true });
}

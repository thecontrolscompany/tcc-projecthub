import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import type { ParsedPocImportRow } from "@/lib/poc/import";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const resolvedProfile = await resolveUserRole(user);
  if (!["admin", "ops_manager"].includes(resolvedProfile?.role ?? "")) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const filename = typeof body?.filename === "string" ? body.filename : "";
  const rows = Array.isArray(body?.rows) ? (body.rows as ParsedPocImportRow[]) : [];

  if (!projectId || !filename) {
    return NextResponse.json({ error: "Missing project ID or filename." }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No parsed POC rows provided." }, { status: 400 });
  }

  const sanitizedRows = rows
    .map((row, index) => ({
      project_id: projectId,
      category: typeof row?.category === "string" ? row.category.trim() : "",
      weight: Number(row?.weight),
      pct_complete: Number(row?.pctComplete),
      sort_order: index,
    }))
    .filter((row) => row.category && Number.isFinite(row.weight) && row.weight > 0 && Number.isFinite(row.pct_complete));

  if (sanitizedRows.length === 0) {
    return NextResponse.json({ error: "Parsed rows were invalid." }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { error: deleteError } = await adminClient
      .from("poc_line_items")
      .delete()
      .eq("project_id", projectId);

    if (deleteError) {
      throw deleteError;
    }

    const { error: insertError } = await adminClient
      .from("poc_line_items")
      .insert(sanitizedRows);

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      ok: true,
      imported: sanitizedRows.length,
      filename,
    });
  } catch (error) {
    console.error("Failed to import POC sheet:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import POC sheet." },
      { status: 500 }
    );
  }
}

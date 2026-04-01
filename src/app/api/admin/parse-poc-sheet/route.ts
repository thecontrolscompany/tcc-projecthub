import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { parsePocWorkbook } from "@/lib/poc/import";

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

  const formData = await request.formData();
  const file = formData.get("file");
  const projectId = String(formData.get("projectId") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  if (!projectId) {
    return NextResponse.json({ error: "Missing project ID." }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parsePocWorkbook(buffer);

    const { count, error } = await adminClient
      .from("poc_line_items")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      filename: file.name,
      worksheetName: parsed.worksheetName,
      rows: parsed.rows,
      totalWeight: parsed.totalWeight,
      overallPct: parsed.overallPct,
      existingCount: count ?? 0,
    });
  } catch (error) {
    console.error("Failed to parse POC sheet:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse POC sheet." },
      { status: 500 }
    );
  }
}

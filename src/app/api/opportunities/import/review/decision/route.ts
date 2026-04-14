import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const reviewDecisionSchema = z.object({
  import_row_id: z.string().uuid("Import row id is required."),
  selected_action: z.enum(["link_project", "link_pursuit", "create_pursuit", "standalone", "reject"]),
  selected_project_id: z.string().uuid().nullable().optional(),
  selected_pursuit_id: z.string().uuid().nullable().optional(),
  notes: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = reviewDecisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const { supabase, user } = auth;

  const { error: reviewError } = await supabase.from("legacy_opportunity_link_reviews").insert({
    import_row_id: parsed.data.import_row_id,
    selected_project_id: parsed.data.selected_project_id ?? null,
    selected_pursuit_id: parsed.data.selected_pursuit_id ?? null,
    selected_action: parsed.data.selected_action,
    reviewed_by: user.id,
    notes: parsed.data.notes || null,
  });

  if (reviewError) {
    return handleTableError(reviewError, "Unable to save review decision.");
  }

  const reviewStatus =
    parsed.data.selected_action === "reject"
      ? "rejected"
      : parsed.data.selected_action === "standalone"
        ? "matched"
        : "matched";

  const { error: rowError } = await supabase
    .from("legacy_opportunity_import_rows")
    .update({ review_status: reviewStatus })
    .eq("id", parsed.data.import_row_id);

  if (rowError) {
    return handleTableError(rowError, "Unable to update import row status.");
  }

  return NextResponse.json({ ok: true });
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  return { supabase, user };
}

function handleTableError(error: { code?: string; message?: string } | null, fallbackMessage: string) {
  if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
    return NextResponse.json({ error: fallbackMessage, migrationRequired: true }, { status: 409 });
  }

  return NextResponse.json({ error: error?.message ?? fallbackMessage }, { status: 400 });
}

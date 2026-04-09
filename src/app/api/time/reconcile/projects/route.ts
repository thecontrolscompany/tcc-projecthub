import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("map_existing_project"),
    qbJobcodeId: z.number().int().positive(),
    projectId: z.uuid()
  }),
  z.object({
    action: z.literal("ignore_jobcode"),
    qbJobcodeId: z.number().int().positive()
  })
]);

function adminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  return { profileId: profile.id };
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const client = adminClient();

  try {
    if (parsed.data.action === "map_existing_project") {
      const { qbJobcodeId, projectId } = parsed.data;

      const [{ data: jobcode, error: jobcodeError }, { data: project, error: projectError }] = await Promise.all([
        client.from("qb_time_jobcodes").select("qb_jobcode_id").eq("qb_jobcode_id", qbJobcodeId).maybeSingle(),
        client.from("projects").select("id, name").eq("id", projectId).maybeSingle()
      ]);

      if (jobcodeError) throw jobcodeError;
      if (projectError) throw projectError;
      if (!jobcode) return NextResponse.json({ error: "QuickBooks jobcode not found." }, { status: 404 });
      if (!project) return NextResponse.json({ error: "Portal project not found." }, { status: 404 });

      const { error: upsertError } = await client.from("project_qb_time_mappings").upsert(
        {
          project_id: projectId,
          qb_jobcode_id: qbJobcodeId,
          mapping_source: "manual_admin_map",
          confidence_score: 100,
          is_active: true
        },
        { onConflict: "project_id,qb_jobcode_id" }
      );

      if (upsertError) throw upsertError;

      // Clear any ignore state now that it's mapped
      await client.from("qb_time_jobcode_review_states").delete().eq("qb_jobcode_id", qbJobcodeId);

      return NextResponse.json({ success: true });
    }

    // ignore_jobcode
    const { qbJobcodeId } = parsed.data;

    const { error } = await client.from("qb_time_jobcode_review_states").upsert(
      {
        qb_jobcode_id: qbJobcodeId,
        status: "ignored",
        ignored_by_profile_id: auth.profileId
      },
      { onConflict: "qb_jobcode_id" }
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update project reconciliation state." },
      { status: 500 }
    );
  }
}

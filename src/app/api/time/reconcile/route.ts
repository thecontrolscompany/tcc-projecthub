import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("map_existing_profile"),
    qbUserId: z.number().int().positive(),
    pmDirectoryId: z.uuid()
  }),
  z.object({
    action: z.literal("ignore_user"),
    qbUserId: z.number().int().positive()
  })
]);

function adminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function generateTemporaryPassword() {
  return `${crypto.randomBytes(10).toString("base64url")}Aa1!`;
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
  if ("error" in auth) {
    return auth.error;
  }

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const client = adminClient();

  try {
    if (parsed.data.action === "map_existing_profile") {
      const { qbUserId, pmDirectoryId } = parsed.data;

      const [{ data: qbUser, error: qbUserError }, { data: pmdEntry, error: pmdError }] =
        await Promise.all([
          client.from("qb_time_users").select("qb_user_id").eq("qb_user_id", qbUserId).maybeSingle(),
          client
            .from("pm_directory")
            .select("id, email, first_name, last_name, profile_id")
            .eq("id", pmDirectoryId)
            .maybeSingle(),
        ]);

      if (qbUserError) throw qbUserError;
      if (pmdError) throw pmdError;
      if (!qbUser) return NextResponse.json({ error: "QuickBooks user not found." }, { status: 404 });
      if (!pmdEntry) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

      let profileId = pmdEntry.profile_id;

      if (!profileId) {
        if (!pmdEntry.email) {
          return NextResponse.json(
            { error: "This contact has no email — cannot create a portal account." },
            { status: 400 }
          );
        }
        const fullName =
          [pmdEntry.first_name, pmdEntry.last_name].filter(Boolean).join(" ").trim() ||
          pmdEntry.email;
        const tempPassword = generateTemporaryPassword();

        const { data: created, error: createError } = await client.auth.admin.createUser({
          email: pmdEntry.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName, role: "installer" },
        });

        if (createError) throw createError;
        profileId = created.user?.id ?? null;
        if (!profileId) {
          return NextResponse.json({ error: "Failed to create portal account." }, { status: 500 });
        }

        await client.from("profiles").upsert({
          id: profileId,
          email: pmdEntry.email,
          full_name: fullName,
          role: "installer",
          pm_directory_id: pmDirectoryId,
        });
        await client
          .from("pm_directory")
          .update({ profile_id: profileId })
          .eq("id", pmDirectoryId);
      } else {
        await client
          .from("profiles")
          .update({ pm_directory_id: pmDirectoryId })
          .eq("id", profileId)
          .is("pm_directory_id", null);
      }

      const { error: upsertError } = await client.from("profile_qb_time_mappings").upsert(
        {
          profile_id: profileId,
          qb_user_id: qbUserId,
          match_source: "manual_admin_map",
          confidence_score: 100,
          is_active: true,
        },
        { onConflict: "profile_id,qb_user_id" }
      );
      if (upsertError) throw upsertError;

      await client.from("qb_time_user_review_states").delete().eq("qb_user_id", qbUserId);

      return NextResponse.json({ success: true });
    }

    const { qbUserId } = parsed.data;

    const { error } = await client.from("qb_time_user_review_states").upsert(
      {
        qb_user_id: qbUserId,
        status: "ignored",
        ignored_by_profile_id: auth.profileId
      },
      { onConflict: "qb_user_id" }
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update reconciliation state." },
      { status: 500 }
    );
  }
}

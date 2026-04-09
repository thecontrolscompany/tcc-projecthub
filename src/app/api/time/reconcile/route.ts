import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";

const roleSchema = z.enum(["admin", "pm", "lead", "installer", "ops_manager", "customer"]);

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("map_existing_profile"),
    qbUserId: z.number().int().positive(),
    profileId: z.uuid()
  }),
  z.object({
    action: z.literal("create_portal_user"),
    qbUserId: z.number().int().positive(),
    role: roleSchema
  }),
  z.object({
    action: z.literal("ignore_user"),
    qbUserId: z.number().int().positive()
  })
]);

function adminClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
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

async function ensureProfileNotAlreadyMapped(client: ReturnType<typeof adminClient>, profileId: string, qbUserId: number) {
  const { data: existingMapping, error } = await client
    .from("profile_qb_time_mappings")
    .select("qb_user_id")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .neq("qb_user_id", qbUserId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (existingMapping) {
    throw new Error("That portal profile is already mapped to another QuickBooks user.");
  }
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
      const { qbUserId, profileId } = parsed.data;

      const [{ data: qbUser, error: qbUserError }, { data: profile, error: profileError }] = await Promise.all([
        client.from("qb_time_users").select("qb_user_id").eq("qb_user_id", qbUserId).maybeSingle(),
        client.from("profiles").select("id, full_name, email").eq("id", profileId).maybeSingle()
      ]);

      if (qbUserError) throw qbUserError;
      if (profileError) throw profileError;
      if (!qbUser) {
        return NextResponse.json({ error: "QuickBooks user not found." }, { status: 404 });
      }
      if (!profile) {
        return NextResponse.json({ error: "Portal profile not found." }, { status: 404 });
      }

      await ensureProfileNotAlreadyMapped(client, profileId, qbUserId);

      const { error: upsertError } = await client.from("profile_qb_time_mappings").upsert(
        {
          profile_id: profileId,
          qb_user_id: qbUserId,
          match_source: "manual_admin_map",
          confidence_score: 100,
          is_active: true
        },
        { onConflict: "profile_id,qb_user_id" }
      );

      if (upsertError) throw upsertError;

      await client.from("qb_time_user_review_states").delete().eq("qb_user_id", qbUserId);

      return NextResponse.json({ success: true });
    }

    if (parsed.data.action === "ignore_user") {
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
    }

    const { qbUserId, role } = parsed.data;
    const { data: qbUser, error: qbUserError } = await client
      .from("qb_time_users")
      .select("qb_user_id, email, display_name")
      .eq("qb_user_id", qbUserId)
      .maybeSingle();

    if (qbUserError) throw qbUserError;
    if (!qbUser) {
      return NextResponse.json({ error: "QuickBooks user not found." }, { status: 404 });
    }

    const email = normalizeEmail(qbUser.email);
    if (!email) {
      return NextResponse.json({ error: "This QuickBooks user has no email, so a portal user cannot be created automatically." }, { status: 400 });
    }

    const { data: existingProfile, error: existingProfileError } = await client
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();

    if (existingProfileError) throw existingProfileError;
    if (existingProfile) {
      return NextResponse.json({ error: "A portal profile with this email already exists. Use Map existing profile instead." }, { status: 400 });
    }

    const temporaryPassword = generateTemporaryPassword();
    const { data: createdUser, error: createError } = await client.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: qbUser.display_name,
        role
      }
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const newUserId = createdUser.user?.id;
    if (!newUserId) {
      return NextResponse.json({ error: "Portal user was created without a user id." }, { status: 500 });
    }

    const { error: profileUpsertError } = await client.from("profiles").upsert({
      id: newUserId,
      email,
      full_name: qbUser.display_name,
      role
    });

    if (profileUpsertError) throw profileUpsertError;

    const { error: mappingError } = await client.from("profile_qb_time_mappings").upsert(
      {
        profile_id: newUserId,
        qb_user_id: qbUserId,
        match_source: "admin_created_from_qb_user",
        confidence_score: 100,
        is_active: true
      },
      { onConflict: "profile_id,qb_user_id" }
    );

    if (mappingError) throw mappingError;

    await client.from("qb_time_user_review_states").delete().eq("qb_user_id", qbUserId);

    return NextResponse.json({
      success: true,
      tempPassword: temporaryPassword,
      createdUser: {
        id: newUserId,
        email,
        fullName: qbUser.display_name,
        role
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update reconciliation state." },
      { status: 500 }
    );
  }
}

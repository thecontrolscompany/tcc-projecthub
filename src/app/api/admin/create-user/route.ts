import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.email("Email must be a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  fullName: z.string().trim().min(1, "Full name is required.").max(255, "Full name must be 255 characters or fewer."),
  role: z.enum(["admin", "pm", "lead", "installer", "ops_manager", "customer"], {
    error: "Role must be one of admin, pm, lead, installer, ops_manager, customer.",
  }),
});

/**
 * POST /api/admin/create-user
 * Body: { email, fullName, password, role }
 *
 * Creates a new Supabase Auth user using the service role key (bypasses email verification).
 * Only callable by admin users.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  // Verify caller is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const parsed = createUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const { email, fullName, password, role } = parsed.data;

  // Use service role client to create user without email confirmation
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: newUser, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Update profile (trigger should auto-create it, but set role explicitly)
  if (newUser.user) {
    const userId = newUser.user.id;

    await adminClient.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName,
      role,
    });

    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0] ?? fullName;
    const lastName = nameParts.slice(1).join(" ") || null;

    const { data: existingPmd } = await adminClient
      .from("pm_directory")
      .select("id, profile_id")
      .ilike("email", email)
      .maybeSingle();

    let pmdId: string;

    if (existingPmd) {
      pmdId = existingPmd.id;
      if (!existingPmd.profile_id) {
        await adminClient
          .from("pm_directory")
          .update({ profile_id: userId })
          .eq("id", pmdId);
      }
    } else {
      const { data: newPmd } = await adminClient
        .from("pm_directory")
        .insert({
          email,
          first_name: firstName,
          last_name: lastName,
          profile_id: userId,
          intended_role: ["pm", "lead", "installer", "ops_manager"].includes(role)
            ? role
            : null,
        })
        .select("id")
        .single();
      pmdId = newPmd!.id;
    }

    await adminClient
      .from("profiles")
      .update({ pm_directory_id: pmdId })
      .eq("id", userId)
      .is("pm_directory_id", null);
  }

  return NextResponse.json({ success: true, userId: newUser.user?.id });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

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

  const { email, fullName, password, role } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

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
      full_name: fullName ?? "",
      role: role ?? "customer",
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Update profile (trigger should auto-create it, but set role explicitly)
  if (newUser.user) {
    await adminClient.from("profiles").upsert({
      id: newUser.user.id,
      email,
      full_name: fullName ?? "",
      role: role ?? "customer",
    });
  }

  return NextResponse.json({ success: true, userId: newUser.user?.id });
}

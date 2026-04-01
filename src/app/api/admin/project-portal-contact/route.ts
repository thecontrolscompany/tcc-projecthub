import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

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
  const pmDirectoryId = typeof body?.pmDirectoryId === "string" ? body.pmDirectoryId : "";

  if (!projectId || !pmDirectoryId) {
    return NextResponse.json({ error: "Missing project ID or contact ID." }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: directoryContact, error: directoryError } = await adminClient
    .from("pm_directory")
    .select("id, email, first_name, last_name, profile_id")
    .eq("id", pmDirectoryId)
    .single();

  if (directoryError || !directoryContact) {
    return NextResponse.json({ error: directoryError?.message ?? "Contact not found." }, { status: 404 });
  }

  let resolvedProfileId = directoryContact.profile_id;
  let createdAccountEmail: string | null = null;

  if (!resolvedProfileId) {
    const fullName = [directoryContact.first_name, directoryContact.last_name].filter(Boolean).join(" ").trim() || directoryContact.email;
    const createUserResult = await adminClient.auth.admin.createUser({
      email: directoryContact.email,
      password: crypto.randomUUID(),
      email_confirm: true,
    });

    if (createUserResult.error || !createUserResult.data.user) {
      // Auth account already exists — find it by email and link it
      const alreadyExistsMsg = createUserResult.error?.message ?? "";
      if (alreadyExistsMsg.toLowerCase().includes("already been registered") || alreadyExistsMsg.toLowerCase().includes("already exists")) {
        const { data: userList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        const existingUser = userList?.users?.find((u) => u.email?.toLowerCase() === directoryContact.email.toLowerCase());
        if (!existingUser) {
          return NextResponse.json({ error: "Auth account exists but could not be located." }, { status: 500 });
        }
        resolvedProfileId = existingUser.id;
        // Don't set createdAccountEmail — account already existed, no "new account" message needed
      } else {
        return NextResponse.json({
          error: alreadyExistsMsg || "Failed to create portal account.",
        }, { status: 500 });
      }
    } else {
      resolvedProfileId = createUserResult.data.user.id;
      createdAccountEmail = directoryContact.email;
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: resolvedProfileId,
        email: directoryContact.email,
        full_name: fullName,
        role: "customer",
      });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const { error: updateDirectoryError } = await adminClient
      .from("pm_directory")
      .update({ profile_id: resolvedProfileId })
      .eq("id", pmDirectoryId);

    if (updateDirectoryError) {
      return NextResponse.json({ error: updateDirectoryError.message }, { status: 500 });
    }
  }

  const { error: insertError } = await adminClient
    .from("project_customer_contacts")
    .upsert({
      project_id: projectId,
      profile_id: resolvedProfileId,
      portal_access: false,
      email_digest: false,
    }, { onConflict: "project_id,profile_id", ignoreDuplicates: true });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { data: contact, error: contactError } = await adminClient
    .from("project_customer_contacts")
    .select("*, profile:profiles(email, full_name)")
    .eq("project_id", projectId)
    .eq("profile_id", resolvedProfileId)
    .single();

  if (contactError || !contact) {
    return NextResponse.json({ error: contactError?.message ?? "Failed to load created contact." }, { status: 500 });
  }

  return NextResponse.json({ contact, createdAccountEmail });
}

export async function DELETE(request: Request) {
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
  const profileId = typeof body?.profileId === "string" ? body.profileId : "";

  if (!projectId || !profileId) {
    return NextResponse.json({ error: "Missing project ID or profile ID." }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await adminClient
    .from("project_customer_contacts")
    .delete()
    .eq("project_id", projectId)
    .eq("profile_id", profileId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
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
  const profileId = typeof body?.profileId === "string" ? body.profileId : "";
  const field = body?.field;
  const value = typeof body?.value === "boolean" ? body.value : null;

  if (!projectId || !profileId || !["portal_access", "email_digest"].includes(field) || value === null) {
    return NextResponse.json({ error: "Invalid update payload." }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const updatePayload =
    field === "portal_access" && value === false
      ? { portal_access: false, email_digest: false }
      : { [field]: value };

  const { error } = await adminClient
    .from("project_customer_contacts")
    .update(updatePayload)
    .eq("project_id", projectId)
    .eq("profile_id", profileId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

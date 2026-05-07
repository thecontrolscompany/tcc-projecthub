import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

type PortalContactSource = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  profileId: string | null;
  pmDirectoryId: string | null;
};

async function findAuthUserIdByEmail(adminClient: SupabaseClient, email: string) {
  const { data: userList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  return userList?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

async function ensurePortalProfile(adminClient: SupabaseClient, source: PortalContactSource) {
  let resolvedProfileId = source.profileId;
  let createdAccountEmail: string | null = null;

  if (!resolvedProfileId) {
    const createUserResult = await adminClient.auth.admin.createUser({
      email: source.email,
      password: crypto.randomUUID(),
      email_confirm: true,
    });

    if (createUserResult.error || !createUserResult.data.user) {
      const alreadyExistsMsg = createUserResult.error?.message ?? "";
      if (alreadyExistsMsg.toLowerCase().includes("already been registered") || alreadyExistsMsg.toLowerCase().includes("already exists")) {
        const existingUserId = await findAuthUserIdByEmail(adminClient, source.email);
        if (!existingUserId) {
          return { error: "Auth account exists but could not be located.", status: 500 as const };
        }
        resolvedProfileId = existingUserId;
      } else {
        return { error: alreadyExistsMsg || "Failed to create portal account.", status: 500 as const };
      }
    } else {
      resolvedProfileId = createUserResult.data.user.id;
      createdAccountEmail = source.email;
    }
  }

  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("id", resolvedProfileId)
    .maybeSingle();

  if (existingProfileError) {
    return { error: existingProfileError.message, status: 500 as const };
  }

  if (existingProfile) {
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        email: source.email,
        full_name: source.fullName,
      })
      .eq("id", resolvedProfileId);

    if (profileError) {
      return { error: profileError.message, status: 500 as const };
    }
  } else {
    const { error: profileError } = await adminClient
      .from("profiles")
      .insert({
        id: resolvedProfileId,
        email: source.email,
        full_name: source.fullName,
        role: "customer",
      });

    if (profileError) {
      return { error: profileError.message, status: 500 as const };
    }
  }

  let pmDirectoryId = source.pmDirectoryId;
  if (!pmDirectoryId) {
    const { data: existingDirectory } = await adminClient
      .from("pm_directory")
      .select("id, profile_id")
      .ilike("email", source.email)
      .maybeSingle();

    if (existingDirectory) {
      pmDirectoryId = existingDirectory.id;
      if (!existingDirectory.profile_id) {
        const { error: updateDirectoryError } = await adminClient
          .from("pm_directory")
          .update({ profile_id: resolvedProfileId })
          .eq("id", existingDirectory.id);

        if (updateDirectoryError) {
          return { error: updateDirectoryError.message, status: 500 as const };
        }
      }
    } else {
      const { data: newDirectory, error: directoryInsertError } = await adminClient
        .from("pm_directory")
        .insert({
          email: source.email,
          first_name: source.firstName,
          last_name: source.lastName,
          profile_id: resolvedProfileId,
          intended_role: null,
        })
        .select("id")
        .single();

      if (directoryInsertError || !newDirectory) {
        return { error: directoryInsertError?.message ?? "Failed to create directory contact.", status: 500 as const };
      }

      pmDirectoryId = newDirectory.id;
    }
  }

  await adminClient
    .from("profiles")
    .update({ pm_directory_id: pmDirectoryId })
    .eq("id", resolvedProfileId)
    .is("pm_directory_id", null);

  return { profileId: resolvedProfileId, createdAccountEmail };
}

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
  const crmContactId = typeof body?.crmContactId === "string" ? body.crmContactId : "";

  if (!projectId || (!pmDirectoryId && !crmContactId) || (pmDirectoryId && crmContactId)) {
    return NextResponse.json({ error: "Missing project ID or contact ID." }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let source: PortalContactSource | null = null;

  if (pmDirectoryId) {
    const { data: directoryContact, error: directoryError } = await adminClient
      .from("pm_directory")
      .select("id, email, first_name, last_name, profile_id")
      .eq("id", pmDirectoryId)
      .single();

    if (directoryError || !directoryContact) {
      return NextResponse.json({ error: directoryError?.message ?? "Contact not found." }, { status: 404 });
    }

    const fullName = [directoryContact.first_name, directoryContact.last_name].filter(Boolean).join(" ").trim() || directoryContact.email;
    source = {
      email: directoryContact.email,
      firstName: directoryContact.first_name,
      lastName: directoryContact.last_name,
      fullName,
      profileId: directoryContact.profile_id,
      pmDirectoryId: directoryContact.id,
    };
  } else {
    const { data: crmContact, error: crmError } = await adminClient
      .from("crm_contacts")
      .select("id, email, first_name, last_name, display_name")
      .eq("id", crmContactId)
      .single();

    if (crmError || !crmContact) {
      return NextResponse.json({ error: crmError?.message ?? "CRM contact not found." }, { status: 404 });
    }
    if (!crmContact.email) {
      return NextResponse.json({ error: "CRM contact must have an email address before a portal account can be created." }, { status: 400 });
    }

    const existingProfileId = await findAuthUserIdByEmail(adminClient, crmContact.email);
    source = {
      email: crmContact.email,
      firstName: crmContact.first_name,
      lastName: crmContact.last_name,
      fullName: crmContact.display_name || crmContact.email,
      profileId: existingProfileId,
      pmDirectoryId: null,
    };
  }

  const portalProfile = await ensurePortalProfile(adminClient, source);
  if ("error" in portalProfile) {
    return NextResponse.json({ error: portalProfile.error }, { status: portalProfile.status });
  }

  const { error: insertError } = await adminClient
    .from("project_customer_contacts")
    .upsert({
      project_id: projectId,
      profile_id: portalProfile.profileId,
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
    .eq("profile_id", portalProfile.profileId)
    .single();

  if (contactError || !contact) {
    return NextResponse.json({ error: contactError?.message ?? "Failed to load created contact." }, { status: 500 });
  }

  return NextResponse.json({ contact, createdAccountEmail: portalProfile.createdAccountEmail });
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

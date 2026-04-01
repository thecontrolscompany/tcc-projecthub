import { createClient as createAdminClient, type User } from "@supabase/supabase-js";
import type { UserRole } from "@/types/database";

type ProfileLookupRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
};

const ROLE_PRIORITY: Record<UserRole, number> = {
  admin: 6,
  ops_manager: 5,
  pm: 4,
  lead: 3,
  installer: 2,
  customer: 1,
};

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

export function pickStrongestProfile(rows: ProfileLookupRow[]) {
  if (!rows.length) return null;

  return [...rows].sort((a, b) => {
    return (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0);
  })[0];
}

export async function resolveUserRole(user: Pick<User, "id" | "email">) {
  const client = adminClient();
  const email = normalizeEmail(user.email);
  const merged = new Map<string, ProfileLookupRow>();

  const { data: byId } = await client
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id);

  for (const row of ((byId ?? []) as ProfileLookupRow[])) {
    merged.set(row.id, {
      ...row,
      email: normalizeEmail(row.email),
    });
  }

  if (email) {
    const { data: byEmail } = await client
      .from("profiles")
      .select("id, email, full_name, role")
      .ilike("email", email);

    for (const row of ((byEmail ?? []) as ProfileLookupRow[])) {
      merged.set(row.id, {
        ...row,
        email: normalizeEmail(row.email),
      });
    }
  }

  return pickStrongestProfile(Array.from(merged.values()));
}

export async function ensureResolvedProfile(user: Pick<User, "id" | "email" | "user_metadata">) {
  const client = adminClient();
  const resolved = await resolveUserRole(user);
  const normalizedEmail = normalizeEmail(user.email);
  const fullName =
    resolved?.full_name ??
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") ??
    null;
  const role = resolved?.role ?? "customer";

  await client.from("profiles").upsert({
    id: user.id,
    email: normalizedEmail || user.email || "",
    full_name: fullName,
    role,
  });

  return {
    id: user.id,
    email: normalizedEmail || user.email || "",
    full_name: fullName,
    role,
  };
}

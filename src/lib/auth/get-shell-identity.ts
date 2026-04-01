import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import type { UserRole } from "@/types/database";

export async function getShellIdentity(defaultRole: UserRole) {
  const fallback = {
    role: defaultRole,
    email: "",
  };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return fallback;
    }

    const resolvedProfile = await resolveUserRole(user);

    return {
      role: resolvedProfile?.role ?? defaultRole,
      email: resolvedProfile?.email || user.email || "",
    };
  } catch (error) {
    console.error("Failed to load shell identity:", error);
    return fallback;
  }
}

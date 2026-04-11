import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import type { UserRole } from "@/types/database";

export async function getShellIdentity(defaultRole: UserRole) {
  const fallback = {
    role: defaultRole,
    email: "",
    hasPortalAccess: false,
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
    const role = resolvedProfile?.role ?? defaultRole;

    // Check if this staff user also has customer portal access
    let hasPortalAccess = false;
    if (role !== "customer") {
      const adminClient = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { count } = await adminClient
        .from("project_customer_contacts")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", user.id)
        .eq("portal_access", true);
      hasPortalAccess = (count ?? 0) > 0;
    }

    return {
      role,
      email: resolvedProfile?.email || user.email || "",
      hasPortalAccess,
    };
  } catch (error) {
    console.error("Failed to load shell identity:", error);
    return fallback;
  }
}

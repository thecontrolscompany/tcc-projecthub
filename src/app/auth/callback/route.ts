import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { roleHome } from "@/lib/auth/role-routes";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { UserRole } from "@/types/database";
import { ensureResolvedProfile } from "@/lib/auth/resolve-user-role";

const INTERNAL_CONTACT_ROLES = new Set(["pm", "lead", "installer", "ops_manager"]);
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Role-based redirect
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const resolvedProfile = await ensureResolvedProfile(user);
        const normalizedEmail = resolvedProfile.email;
        let effectiveRole: UserRole = resolvedProfile.role;

        if (normalizedEmail) {
          const { data: pmDirectory } = await supabase
            .from("pm_directory")
            .select("id, intended_role")
            .eq("email", normalizedEmail)
            .maybeSingle();

          await supabase
            .from("pm_directory")
            .update({ profile_id: user.id })
            .eq("email", normalizedEmail)
            .is("profile_id", null);

          if (pmDirectory?.id) {
            await adminClient
              .from("profiles")
              .update({ pm_directory_id: pmDirectory.id })
              .eq("id", user.id)
              .is("pm_directory_id", null);
          }

          if (
            pmDirectory?.id &&
            typeof pmDirectory.intended_role === "string" &&
            INTERNAL_CONTACT_ROLES.has(pmDirectory.intended_role) &&
            effectiveRole === "customer"
          ) {
            await adminClient
              .from("profiles")
              .update({ role: pmDirectory.intended_role })
              .eq("id", user.id)
              .eq("role", "customer");

            await supabase
              .from("pm_directory")
              .update({ intended_role: null })
              .eq("id", pmDirectory.id);

            effectiveRole = pmDirectory.intended_role as UserRole;
          }
        }

        return NextResponse.redirect(`${origin}${roleHome(effectiveRole)}`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}

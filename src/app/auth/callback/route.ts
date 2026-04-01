import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { roleHome } from "@/lib/auth/role-routes";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { UserRole } from "@/types/database";

const INTERNAL_CONTACT_ROLES = new Set(["pm", "lead", "installer", "ops_manager"]);
const ROLE_PRIORITY: Record<UserRole, number> = {
  admin: 6,
  ops_manager: 5,
  pm: 4,
  lead: 3,
  installer: 2,
  customer: 1,
};

type ProfileRow = {
  id: string;
  role: UserRole;
  email: string;
  full_name: string | null;
};

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
        const normalizedEmail = user.email?.toLowerCase().trim() ?? "";
        const { data: matchingProfiles } = normalizedEmail
          ? await adminClient
              .from("profiles")
              .select("id, role, email, full_name")
              .eq("email", normalizedEmail)
          : { data: [] as ProfileRow[] };

        const profiles = ((matchingProfiles ?? []) as ProfileRow[]).sort((a, b) => {
          return (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0);
        });

        const currentProfile = profiles.find((profile) => profile.id === user.id) ?? null;
        const strongestProfile = profiles[0] ?? null;
        let effectiveRole: UserRole = currentProfile?.role ?? strongestProfile?.role ?? "customer";
        const effectiveName =
          currentProfile?.full_name ??
          strongestProfile?.full_name ??
          (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") ??
          "";

        await adminClient.from("profiles").upsert({
          id: user.id,
          email: normalizedEmail || user.email || "",
          full_name: effectiveName || null,
          role: effectiveRole,
        });

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

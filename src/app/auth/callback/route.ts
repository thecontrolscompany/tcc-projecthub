import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const INTERNAL_CONTACT_ROLES = new Set(["pm", "lead", "installer", "ops_manager"]);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Role-based redirect
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, role, email")
          .eq("id", user.id)
          .single();

        if (profile?.id && profile?.email) {
          const normalizedEmail = profile.email.toLowerCase();
          const { data: pmDirectory } = await supabase
            .from("pm_directory")
            .select("id, intended_role")
            .eq("email", normalizedEmail)
            .maybeSingle();

          await supabase
            .from("pm_directory")
            .update({ profile_id: profile.id })
            .eq("email", normalizedEmail)
            .is("profile_id", null);

          if (
            pmDirectory?.id &&
            typeof pmDirectory.intended_role === "string" &&
            INTERNAL_CONTACT_ROLES.has(pmDirectory.intended_role) &&
            profile.role === "customer"
          ) {
            await supabase
              .from("profiles")
              .update({ role: pmDirectory.intended_role })
              .eq("id", profile.id)
              .eq("role", "customer");

            await supabase
              .from("pm_directory")
              .update({ intended_role: null })
              .eq("id", pmDirectory.id);

            profile.role = pmDirectory.intended_role;
          }
        }

        if (profile?.role === "admin") return NextResponse.redirect(`${origin}/admin`);
        if (profile?.role === "pm" || profile?.role === "lead") return NextResponse.redirect(`${origin}/pm`);
        if (profile?.role === "installer") return NextResponse.redirect(`${origin}/installer`);
        if (profile?.role === "ops_manager") return NextResponse.redirect(`${origin}/ops`);
        return NextResponse.redirect(`${origin}/customer`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}

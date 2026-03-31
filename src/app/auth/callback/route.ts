import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
          await supabase
            .from("pm_directory")
            .update({ profile_id: profile.id })
            .eq("email", profile.email)
            .is("profile_id", null);
        }

        if (profile?.role === "admin") return NextResponse.redirect(`${origin}/admin`);
        if (profile?.role === "pm") return NextResponse.redirect(`${origin}/pm`);
        return NextResponse.redirect(`${origin}/customer`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}

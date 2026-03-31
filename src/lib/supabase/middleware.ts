import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { roleHome } from "@/lib/auth/role-routes";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // Public routes that don't require auth
  const publicPaths = ["/login", "/auth/callback", "/auth/confirm"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    // Get role and redirect to correct portal
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname = roleHome(profile?.role);
    return NextResponse.redirect(url);
  }

  // Role-based path enforcement
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    const opsManagerAdminBlocked =
      role === "ops_manager" &&
      (pathname.startsWith("/admin/users") || pathname.startsWith("/admin/migrate-sharepoint"));
    if (
      pathname.startsWith("/admin") &&
      role !== "admin" &&
      !(role === "ops_manager" && !opsManagerAdminBlocked)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = roleHome(role);
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith("/pm") && !["admin", "pm", "lead", "ops_manager"].includes(role ?? "")) {
      const url = request.nextUrl.clone();
      url.pathname = roleHome(role);
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith("/installer") && role !== "installer") {
      const url = request.nextUrl.clone();
      url.pathname = roleHome(role);
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith("/ops") && role !== "ops_manager") {
      const url = request.nextUrl.clone();
      url.pathname = roleHome(role);
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

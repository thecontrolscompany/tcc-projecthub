import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { roleHome } from "@/lib/auth/role-routes";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { resolveOrgFromRequest, ORG_HEADERS } from "@/lib/tenant/context";
import { isLocalhostDevelopmentRequest } from "@/lib/auth/dev-access";

export async function updateSession(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isDevPreviewRoute =
    process.env.NODE_ENV === "development" &&
    (pathname === "/symbol-renderer-preview" || pathname === "/system-template-preview");

  // ── 1. Resolve tenant from host ──────────────────────────────────────────
  const host = request.headers.get("host") ?? "";
  const devOrgParam = process.env.NODE_ENV === "development"
    ? searchParams.get("org")
    : null;

  const org = await resolveOrgFromRequest(host, devOrgParam);

  // Build the base response so we can attach org headers to every reply
  let supabaseResponse = NextResponse.next({ request });

  if (org) {
    supabaseResponse.headers.set(ORG_HEADERS.id, org.id);
    supabaseResponse.headers.set(ORG_HEADERS.slug, org.slug);
    supabaseResponse.headers.set(ORG_HEADERS.name, org.name);
    supabaseResponse.headers.set(ORG_HEADERS.isDemo, String(org.is_demo));

    // Also forward onto the request so server components can read via headers()
    request.headers.set(ORG_HEADERS.id, org.id);
    request.headers.set(ORG_HEADERS.slug, org.slug);
    request.headers.set(ORG_HEADERS.name, org.name);
    request.headers.set(ORG_HEADERS.isDemo, String(org.is_demo));
  }

  if (isLocalhostDevelopmentRequest(host)) {
    return supabaseResponse;
  }

  // The mixed-air preview is a local-only review surface and should not
  // participate in auth redirects or role enforcement.
  if (isDevPreviewRoute) {
    return supabaseResponse;
  }

  // ── 2. Supabase session refresh ──────────────────────────────────────────
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
          // Re-apply org headers after response is recreated
          if (org) {
            supabaseResponse.headers.set(ORG_HEADERS.id, org.id);
            supabaseResponse.headers.set(ORG_HEADERS.slug, org.slug);
            supabaseResponse.headers.set(ORG_HEADERS.name, org.name);
            supabaseResponse.headers.set(ORG_HEADERS.isDemo, String(org.is_demo));
          }
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

  // ── 3. Auth gating ───────────────────────────────────────────────────────
  const publicPaths = [
    "/login",
    "/reset-password",
    "/auth/callback",
    "/auth/confirm",
    "/status",
    "/share",
    "/system-preview",
    "/system-template-preview",
    "/api/system-template-preview",
  ];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  // Demo tenant: redirect /login → /login/demo for the role-button UX
  if (org?.is_demo && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/login/demo";
    return NextResponse.redirect(url);
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    const resolvedProfile = await resolveUserRole(user);
    url.pathname = roleHome(resolvedProfile?.role);
    return NextResponse.redirect(url);
  }

  // ── 4. Role-based path enforcement ──────────────────────────────────────
  if (user) {
    const resolvedProfile = await resolveUserRole(user);
    const role = resolvedProfile?.role;
    const opsManagerAdminBlocked =
      role === "ops_manager" &&
      (pathname.startsWith("/admin/users") ||
        pathname.startsWith("/admin/migrate-sharepoint"));

    if (
      pathname.startsWith("/admin") &&
      role !== "admin" &&
      !(role === "ops_manager" && !opsManagerAdminBlocked)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = roleHome(role);
      return NextResponse.redirect(url);
    }
    if (
      pathname.startsWith("/time-hub") &&
      !["admin", "pm", "lead", "installer", "ops_manager"].includes(role ?? "")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = roleHome(role);
      return NextResponse.redirect(url);
    }
    if (
      pathname.startsWith("/pm") &&
      !["admin", "pm", "lead", "ops_manager"].includes(role ?? "")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = roleHome(role);
      return NextResponse.redirect(url);
    }
    if (
      (pathname === "/time/reconcile" ||
        pathname.startsWith("/time/reconcile/")) &&
      role !== "admin"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = roleHome(role);
      return NextResponse.redirect(url);
    }
    if (
      (pathname === "/time" || pathname.startsWith("/time/")) &&
      !["admin", "pm", "lead", "ops_manager"].includes(role ?? "")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = roleHome(role);
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith("/installer") && role !== "installer") {
      const url = request.nextUrl.clone();
      url.pathname = roleHome(role);
      return NextResponse.redirect(url);
    }
    if (
      pathname.startsWith("/ops") &&
      !["admin", "ops_manager"].includes(role ?? "")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = roleHome(role);
      return NextResponse.redirect(url);
    }
    if (
      pathname.startsWith("/crm") &&
      !["admin", "ops_manager", "pm", "lead"].includes(role ?? "")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = roleHome(role);
      return NextResponse.redirect(url);
    }
    if (
      pathname.startsWith("/feedback") &&
      !["admin", "pm", "lead", "ops_manager"].includes(role ?? "")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = roleHome(role);
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

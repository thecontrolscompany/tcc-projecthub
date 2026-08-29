import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STATE_COOKIE_NAME = "qb_time_oauth_state";

function getAppUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
}

function getCallbackUrl(request: NextRequest) {
  return new URL("/api/auth/qb-time-callback", getAppUrl(request)).toString();
}

function createAuthUrl(request: NextRequest, state: string) {
  const authUrl = new URL("https://rest.tsheets.com/api/v1/authorize");
  authUrl.searchParams.set("client_id", process.env.QUICKBOOKS_TIME_CLIENT_ID?.trim() ?? "");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", getCallbackUrl(request));
  authUrl.searchParams.set("state", state);
  return authUrl;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (userProfile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const clientId = process.env.QUICKBOOKS_TIME_CLIENT_ID?.trim();
  const clientSecret = process.env.QUICKBOOKS_TIME_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/time/reconciliation?tab=overview&qb_time_oauth=error&qb_time_oauth_message=QB+Time+OAuth+credentials+are+missing+from+the+environment.", request.url)
    );
  }

  const state = randomUUID();
  const authUrl = createAuthUrl(request, state);
  const response = NextResponse.redirect(authUrl);

  response.cookies.set({
    name: STATE_COOKIE_NAME,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/qb-time-callback",
    maxAge: 10 * 60,
  });

  return response;
}

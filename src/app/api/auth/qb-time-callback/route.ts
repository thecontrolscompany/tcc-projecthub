import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storeQuickBooksTimeTokens } from "@/lib/qb-time/tokens";

const STATE_COOKIE_NAME = "qb_time_oauth_state";

interface QuickBooksTimeGrantResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  company_id?: unknown;
}

function getAppUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
}

function redirectToOverview(request: NextRequest, status: "success" | "error", message?: string) {
  const url = new URL("/time/reconciliation", request.url);
  url.searchParams.set("tab", "overview");
  url.searchParams.set("qb_time_oauth", status);
  if (message) {
    url.searchParams.set("qb_time_oauth_message", message);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");

  if (oauthError) {
    return redirectToOverview(
      request,
      "error",
      oauthErrorDescription || `QuickBooks Time authorization failed: ${oauthError}`
    );
  }

  if (!code) {
    return redirectToOverview(
      request,
      "error",
      "QuickBooks Time did not return an authorization code."
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (userProfile?.role !== "admin") {
      return redirectToOverview(request, "error", "Admin access is required to connect QuickBooks Time.");
    }

    const expectedState = request.cookies.get(STATE_COOKIE_NAME)?.value;
    if (!expectedState || !state || expectedState !== state) {
      const response = redirectToOverview(
        request,
        "error",
        "QuickBooks Time authorization state check failed. Please try connecting again."
      );
      response.cookies.set({
        name: STATE_COOKIE_NAME,
        value: "",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/api/auth/qb-time-callback",
        maxAge: 0,
      });
      return response;
    }

    // Exchange authorization code for tokens
    const clientId = process.env.QUICKBOOKS_TIME_CLIENT_ID;
    const clientSecret = process.env.QUICKBOOKS_TIME_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return redirectToOverview(
        request,
        "error",
        "QB Time OAuth credentials are not configured in the environment."
      );
    }

    const tokenResponse = await fetch("https://rest.tsheets.com/api/v1/grant", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: new URL("/api/auth/qb-time-callback", getAppUrl(request)).toString(),
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error("[QB Time OAuth] Token exchange failed:", errorBody);
      return redirectToOverview(
        request,
        "error",
        `Token exchange failed: ${errorBody.slice(0, 120)}`
      );
    }

    const tokenData = (await tokenResponse.json()) as QuickBooksTimeGrantResponse;
    if (
      typeof tokenData.access_token !== "string" ||
      typeof tokenData.refresh_token !== "string" ||
      typeof tokenData.expires_in !== "number" ||
      (typeof tokenData.company_id !== "string" && typeof tokenData.company_id !== "number")
    ) {
      throw new Error("QuickBooks Time returned an incomplete OAuth token response.");
    }

    // Store tokens in database
    await storeQuickBooksTimeTokens(
      tokenData.access_token,
      tokenData.refresh_token,
      tokenData.expires_in,
      String(tokenData.company_id),
      null
    );

    const response = redirectToOverview(request, "success");
    response.cookies.set({
      name: STATE_COOKIE_NAME,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/auth/qb-time-callback",
      maxAge: 0,
    });

    // Redirect to success page
    return response;
  } catch (error) {
    console.error("[QB Time OAuth] Callback error:", error);
    return redirectToOverview(
      request,
      "error",
      error instanceof Error ? error.message : "OAuth callback failed"
    );
  }
}

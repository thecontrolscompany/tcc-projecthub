import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * QuickBooks Time OAuth token management
 * Handles access token refresh using refresh token
 */

interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  company_id?: string | number;
}

export interface QuickBooksTimeTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshTokenExpiresAt: Date | null;
}

export interface QuickBooksTimeConnectionStatus {
  connected: boolean;
  realmId: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  refreshTokenExpiringSoon: boolean;
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Get credentials from environment variables
 */
function getOAuthCredentials() {
  const clientId = process.env.QUICKBOOKS_TIME_CLIENT_ID?.trim();
  const clientSecret = process.env.QUICKBOOKS_TIME_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing QB Time OAuth credentials: QUICKBOOKS_TIME_CLIENT_ID and QUICKBOOKS_TIME_CLIENT_SECRET are required"
    );
  }

  return { clientId, clientSecret };
}

async function readQuickBooksTimeTokenRow() {
  const supabase = adminClient();

  const { data, error } = await supabase
    .from("qb_time_tokens")
    .select("realm_id, access_token, refresh_token, expires_at, refresh_token_expires_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch QB Time token from database: ${error.message}`);
  }

  return data ?? null;
}

/**
 * Refresh an expired QB Time access token using the refresh token
 */
export async function refreshQuickBooksTimeToken(): Promise<QuickBooksTimeTokens> {
  const { clientId, clientSecret } = getOAuthCredentials();

  // First, try to get the stored refresh token from database
  const supabase = adminClient();
  const tokenRecord = await readQuickBooksTimeTokenRow();

  if (!tokenRecord?.refresh_token) {
    throw new Error(
      "No QB Time refresh token found in database. Please complete OAuth authentication first."
    );
  }

  if (tokenRecord.refresh_token_expires_at) {
    const refreshTokenExpiresAt = new Date(tokenRecord.refresh_token_expires_at);
    if (refreshTokenExpiresAt <= new Date()) {
      throw new Error(
        "QB Time refresh token has expired. Please reconnect QuickBooks Time from the TimeHub overview page."
      );
    }
  }

  // Refresh through the QuickBooks Time (formerly TSheets) OAuth grant endpoint.
  const tokenUrl = "https://rest.tsheets.com/api/v1/grant";
  const refreshResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${tokenRecord.access_token}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenRecord.refresh_token,
    }),
  });

  if (!refreshResponse.ok) {
    const errorBody = await refreshResponse.text();
    throw new Error(
      `QB Time token refresh failed (${refreshResponse.status}): ${errorBody.slice(0, 240)}`
    );
  }

  const tokenData = (await refreshResponse.json()) as OAuthTokenResponse;

  // Store the new tokens in database (refresh token rotation)
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
  const refreshTokenExpiresAt = tokenRecord.refresh_token_expires_at
    ? new Date(tokenRecord.refresh_token_expires_at)
    : null;
  const { error: updateError } = await supabase.from("qb_time_tokens").upsert(
    {
      realm_id: tokenRecord.realm_id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt.toISOString(),
      refresh_token_expires_at: refreshTokenExpiresAt?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "realm_id" }
  );

  if (updateError) {
    throw new Error(`Failed to store refreshed QB Time token: ${updateError.message}`);
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt,
    refreshTokenExpiresAt,
  };
}

/**
 * Get a valid QB Time access token, refreshing if necessary
 */
export async function getValidQuickBooksTimeToken(): Promise<string> {
  getOAuthCredentials();
  const tokenRecord = await readQuickBooksTimeTokenRow();

  if (!tokenRecord?.access_token) {
    throw new Error("No QB Time access token found. Please complete OAuth authentication first.");
  }

  // Check if token is expired (with 5-minute buffer)
  const expiresAt = new Date(tokenRecord.expires_at);
  const bufferTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  if (expiresAt <= bufferTime) {
    // Token is expired or expiring soon, refresh it
    const newTokens = await refreshQuickBooksTimeToken();
    return newTokens.accessToken;
  }

  return tokenRecord.access_token;
}

/**
 * Store QB Time OAuth tokens in database after initial authentication
 */
export async function storeQuickBooksTimeTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  realmId?: string,
  refreshTokenExpiresIn?: number | null
): Promise<void> {
  const finalRealmId = realmId || process.env.QUICKBOOKS_TIME_REALM_ID?.trim();
  if (!finalRealmId) {
    throw new Error("QuickBooks Time did not return a company ID");
  }

  const supabase = adminClient();
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const refreshTokenExpiresAt = refreshTokenExpiresIn
    ? new Date(Date.now() + refreshTokenExpiresIn * 1000)
    : null;

  const { error } = await supabase.from("qb_time_tokens").upsert(
    {
      realm_id: finalRealmId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt.toISOString(),
      refresh_token_expires_at: refreshTokenExpiresAt?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "realm_id" }
  );

  if (error) {
    throw new Error(`Failed to store QB Time tokens: ${error.message}`);
  }
}

export async function getQuickBooksTimeConnectionStatus(): Promise<QuickBooksTimeConnectionStatus> {
  const realmId = process.env.QUICKBOOKS_TIME_REALM_ID?.trim();
  const supabase = adminClient();

  let query = supabase
    .from("qb_time_tokens")
    .select("realm_id, expires_at, refresh_token_expires_at, updated_at");

  if (realmId) {
    query = query.eq("realm_id", realmId);
  }

  const { data, error } = await query.order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch QB Time connection status: ${error.message}`);
  }

  const tokenRow = Array.isArray(data) ? data[0] : data;
  const accessTokenExpiresAt = tokenRow?.expires_at ?? null;
  const refreshTokenExpiresAt = tokenRow?.refresh_token_expires_at ?? null;
  const refreshExpiry = refreshTokenExpiresAt ? new Date(refreshTokenExpiresAt) : null;
  const refreshTokenExpiringSoon = refreshExpiry
    ? refreshExpiry.getTime() - Date.now() <= 30 * 24 * 60 * 60 * 1000
    : false;

  return {
    connected: Boolean(tokenRow),
    realmId: tokenRow?.realm_id ?? realmId ?? null,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
    refreshTokenExpiringSoon,
  };
}

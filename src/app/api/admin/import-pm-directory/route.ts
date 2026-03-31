import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { graphFetch, listGraphUsers } from "@/lib/graph/client";

const AZURE_TENANT_ID = "7eec7a09-a47b-4bf1-a877-80fd5323c774";
const AZURE_CLIENT_ID = "0777b14d-29c4-4186-8d8e-4a8f43de6589";
const TOKEN_URL = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;

interface GraphErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

function normalizeEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase() ?? "";
  return email.includes("@") ? email : "";
}

function hasPersonalName(firstName: string | null, lastName: string | null) {
  return Boolean(firstName?.trim() || lastName?.trim());
}

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  return { ok: true as const };
}

async function getAppToken() {
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!clientSecret) {
    throw new Error("AZURE_CLIENT_SECRET is not configured.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: AZURE_CLIENT_ID,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to acquire Microsoft app token.");
  }

  const data = await res.json();
  if (typeof data?.access_token !== "string" || !data.access_token) {
    throw new Error("Microsoft token endpoint did not return an access token.");
  }

  return data.access_token as string;
}

async function getGraphError(accessToken: string) {
  const res = await graphFetch("/users?$select=id&$top=1", accessToken);

  if (res.ok) {
    return null;
  }

  let errorBody: GraphErrorBody | null = null;
  try {
    errorBody = await res.json();
  } catch {
    errorBody = null;
  }

  return {
    status: res.status,
    code: errorBody?.error?.code ?? "",
    message: errorBody?.error?.message ?? "",
  };
}

export async function POST() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let rawGraphCount = 0;
  let accessToken = "";

  try {
    accessToken = await getAppToken();

    const users = await listGraphUsers(accessToken);
    rawGraphCount = users.length;

    console.info(`[PM Import] Graph returned ${rawGraphCount} user(s) before filtering.`);

    const candidates = users
      .map((user) => {
        const email = normalizeEmail(user.mail) || normalizeEmail(user.userPrincipalName);
        let firstName = user.givenName?.trim() || null;
        let lastName = user.surname?.trim() || null;

        // User.ReadBasic.All doesn't return givenName/surname — fall back to displayName
        if (!firstName && !lastName && user.displayName?.trim()) {
          const parts = user.displayName.trim().split(/\s+/);
          firstName = parts[0] ?? null;
          lastName = parts.slice(1).join(" ") || null;
        }

        return {
          email,
          first_name: firstName,
          last_name: lastName,
          userType: user.userType?.trim().toLowerCase() ?? null,
          accountEnabled: user.accountEnabled,
        };
      })
      .filter((user) =>
        Boolean(user.email) &&
        (user.userType === null || user.userType === "member") &&
        user.accountEnabled !== false
      );

    const uniqueCandidates = Array.from(
      candidates.reduce((map, user) => map.set(user.email, user), new Map<string, (typeof candidates)[number]>()).values()
    );

    const emails = uniqueCandidates.map((user) => user.email);
    const emailSet = new Set(emails);

    const [existingResult, profilesResult] = await Promise.all([
      emails.length
        ? adminClient
            .from("pm_directory")
            .select("id, email, first_name, last_name, profile_id")
            .in("email", emails)
        : Promise.resolve({ data: [], error: null }),
      emails.length
        ? adminClient
            .from("profiles")
            .select("id, email")
            .in("email", emails)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (existingResult.error) {
      throw new Error(existingResult.error.message);
    }

    if (profilesResult.error) {
      throw new Error(profilesResult.error.message);
    }

    const existingByEmail = new Map(
      (existingResult.data ?? []).map((row) => [normalizeEmail(row.email), row])
    );
    const profileIdByEmail = new Map(
      (profilesResult.data ?? [])
        .map((row) => [normalizeEmail(row.email), row.id] as const)
        .filter(([email]) => emailSet.has(email))
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const upserts = uniqueCandidates.flatMap((candidate) => {
      const existing = existingByEmail.get(candidate.email);
      const profileId = existing?.profile_id ?? profileIdByEmail.get(candidate.email) ?? null;

      if (existing) {
        const unchanged =
          (existing.first_name ?? null) === candidate.first_name &&
          (existing.last_name ?? null) === candidate.last_name &&
          (existing.profile_id ?? null) === profileId;

        if (unchanged) {
          skipped += 1;
          return [];
        }

        updated += 1;
      } else {
        inserted += 1;
      }

      return [{
        email: candidate.email,
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        profile_id: profileId,
      }];
    });

    if (upserts.length) {
      const { error } = await adminClient.from("pm_directory").upsert(upserts, {
        onConflict: "email",
      });

      if (error) {
        throw new Error(error.message);
      }
    }

    return NextResponse.json({
      rawCount: rawGraphCount,
      inserted,
      updated,
      skipped,
    });
  } catch (error) {
    const graphError = accessToken ? await getGraphError(accessToken) : null;

    if (
      graphError &&
      (graphError.status === 403 ||
        graphError.code === "Authorization_RequestDenied" ||
        graphError.code === "InsufficientPermissions" ||
        /insufficient privileges/i.test(graphError.message) ||
        /Authorization_RequestDenied/i.test(graphError.code) ||
        /InsufficientPermissions/i.test(graphError.code))
    ) {
      return NextResponse.json(
        {
          error:
            "Microsoft Graph access was denied. Configure the Azure app with a client secret and grant User.ReadBasic.All as an application permission with admin consent.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        rawCount: rawGraphCount,
        error: error instanceof Error ? error.message : "PM import failed.",
      },
      { status: 500 }
    );
  }
}

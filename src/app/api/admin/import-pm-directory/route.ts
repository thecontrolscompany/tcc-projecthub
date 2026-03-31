import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { graphFetch, listGraphUsers } from "@/lib/graph/client";

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

async function requireAdminWithToken() {
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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.provider_token) {
    return {
      error: NextResponse.json(
        {
          error: "Microsoft access token not available. Please sign out and sign back in with Microsoft.",
        },
        { status: 400 }
      ),
    };
  }

  return { providerToken: session.provider_token };
}

async function getGraphError(providerToken: string) {
  const res = await graphFetch(
    "/users?$select=id&$top=1",
    providerToken
  );

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
  const auth = await requireAdminWithToken();
  if ("error" in auth) return auth.error;

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const users = await listGraphUsers(auth.providerToken);

    const candidates = users
      .map((user) => {
        const email = normalizeEmail(user.mail) || normalizeEmail(user.userPrincipalName);
        const firstName = user.givenName?.trim() || null;
        const lastName = user.surname?.trim() || null;

        return {
          email,
          first_name: firstName,
          last_name: lastName,
          userType: user.userType?.trim().toLowerCase() ?? "",
          accountEnabled: user.accountEnabled,
        };
      })
      .filter((user) =>
        Boolean(user.email) &&
        user.userType === "member" &&
        user.accountEnabled !== false &&
        hasPersonalName(user.first_name, user.last_name)
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

    return NextResponse.json({ inserted, updated, skipped });
  } catch (error) {
    const graphError = await getGraphError(auth.providerToken);

    if (
      graphError &&
      graphError.status === 403 &&
      (graphError.code === "Authorization_RequestDenied" ||
        /insufficient privileges/i.test(graphError.message))
    ) {
      return NextResponse.json(
        {
          error:
            "Microsoft Graph access was denied. Grant admin consent for the User.ReadBasic.All permission in Azure, then sign out and sign back in with Microsoft.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "PM import failed.",
      },
      { status: 500 }
    );
  }
}

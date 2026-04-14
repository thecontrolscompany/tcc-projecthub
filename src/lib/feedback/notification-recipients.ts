import { createClient as createAdminClient } from "@supabase/supabase-js";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function listFeedbackNotificationRecipients(options?: { excludeEmail?: string | null }) {
  const client = adminClient();
  const { data, error } = await client
    .from("profiles")
    .select("email")
    .in("role", ["admin", "ops_manager"]);

  if (error) {
    throw new Error(error.message);
  }

  const excluded = options?.excludeEmail?.trim().toLowerCase() ?? null;

  return Array.from(
    new Set(
      (data ?? [])
        .map((item) => item.email?.trim())
        .filter((email): email is string => Boolean(email))
        .filter((email) => email.toLowerCase() !== excluded)
    )
  );
}

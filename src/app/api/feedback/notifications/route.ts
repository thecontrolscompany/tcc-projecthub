import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getRequester() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, role: null };

  const profile = await resolveUserRole(user);
  return { user, role: profile?.role ?? null };
}

export async function GET() {
  const { user, role } = await getRequester();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!["admin", "ops_manager"].includes(role ?? "")) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const client = adminClient();
  const [customerResult, teamResult] = await Promise.all([
    client.from("customer_feedback").select("id", { count: "exact", head: true }).eq("reviewed", false),
    client.from("portal_feedback").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  if (customerResult.error || teamResult.error) {
    return NextResponse.json(
      { error: customerResult.error?.message ?? teamResult.error?.message ?? "Unable to load feedback notifications." },
      { status: 500 }
    );
  }

  const customerUnreviewed = customerResult.count ?? 0;
  const teamNew = teamResult.count ?? 0;

  return NextResponse.json({
    customer_unreviewed: customerUnreviewed,
    team_new: teamNew,
    total: customerUnreviewed + teamNew,
  });
}

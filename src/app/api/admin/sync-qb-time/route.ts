import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { getQuickBooksTimeConfig, importQuickBooksTimeData } from "@/lib/qb-time/sync";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const role = await resolveUserRole(user);
  if (role?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = getQuickBooksTimeConfig();
  if (!config.enabled) {
    return NextResponse.json(
      { error: "QUICKBOOKS_TIME_ACCESS_TOKEN is not configured." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const days = typeof body.days === "number" ? Math.min(Math.max(body.days, 1), 365) : 30;

  try {
    const result = await importQuickBooksTimeData(days);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

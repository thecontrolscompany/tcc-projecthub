import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { getQuickBooksTimeConfig, importQuickBooksTimeData } from "@/lib/qb-time/sync";
import { getQuickBooksTimeConnectionStatus } from "@/lib/qb-time/tokens";

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
  const connectionStatus = config.accessTokenPresent
    ? { connected: true }
    : await getQuickBooksTimeConnectionStatus().catch(() => ({ connected: false }));

  if (!config.accessTokenPresent && !connectionStatus.connected) {
    return NextResponse.json(
      { error: "QuickBooks Time is not connected. Use the Connect QB Time button on the TimeHub overview page." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const days = typeof body.days === "number" ? Math.min(Math.max(body.days, 1), 365) : 30;

  try {
    const result = await importQuickBooksTimeData(days);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as Record<string, unknown>).message)
          : JSON.stringify(err);
    console.error("QB Time sync error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

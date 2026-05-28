import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  logUserActivity,
  maybeSendLoginAlert,
  requestIp,
  type UserActivityEventType,
} from "@/lib/auth/activity";

const PUBLIC_EVENTS = new Set<UserActivityEventType>(["login_failed", "password_reset_requested"]);
const AUTHENTICATED_EVENTS = new Set<UserActivityEventType>(["login_success", "logout", "password_changed"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const eventType = body?.eventType as UserActivityEventType | undefined;
  const email = typeof body?.email === "string" ? body.email : null;
  const metadata = body?.metadata && typeof body.metadata === "object" ? body.metadata : {};

  if (!eventType || (!PUBLIC_EVENTS.has(eventType) && !AUTHENTICATED_EVENTS.has(eventType))) {
    return NextResponse.json({ error: "Invalid activity event." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (AUTHENTICATED_EVENTS.has(eventType) && !user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await logUserActivity(adminClient, {
    profileId: user?.id ?? null,
    email: user?.email ?? email,
    eventType,
    ipAddress: requestIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata,
  });

  await maybeSendLoginAlert({
    email: user?.email ?? email,
    eventType,
    ipAddress: requestIp(request),
    userAgent: request.headers.get("user-agent"),
    metadata,
  });

  return NextResponse.json({ ok: true });
}

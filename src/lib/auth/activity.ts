import type { SupabaseClient } from "@supabase/supabase-js";
import { sendLoginAlertNotification, shouldSendLoginAlert } from "@/lib/email/notifications";

export type UserActivityEventType =
  | "login_success"
  | "login_failed"
  | "logout"
  | "password_changed"
  | "password_reset_requested"
  | "portal_user_created"
  | "portal_access_enabled"
  | "portal_access_disabled";

export type UserActivityInput = {
  profileId?: string | null;
  email?: string | null;
  eventType: UserActivityEventType;
  projectId?: string | null;
  actorProfileId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

const LOGIN_ALERT_METHODS = new Set<"login_success" | "login_failed">(["login_success", "login_failed"]);

export function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
}

export async function maybeSendLoginAlert(
  input: Pick<UserActivityInput, "email" | "eventType" | "ipAddress" | "userAgent" | "metadata">
) {
  if (!LOGIN_ALERT_METHODS.has(input.eventType as "login_success" | "login_failed")) {
    return;
  }

  if (!shouldSendLoginAlert(input.email)) {
    return;
  }

  const method =
    typeof input.metadata?.method === "string"
      ? input.metadata.method
      : input.eventType === "login_failed"
        ? "password"
        : "microsoft";

  try {
    await sendLoginAlertNotification({
      email: input.email!.trim(),
      eventType: input.eventType as "login_success" | "login_failed",
      method,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (error) {
    console.warn("[auth] unable to send login alert notification", error);
  }
}

export async function logUserActivity(adminClient: SupabaseClient, input: UserActivityInput) {
  const { error } = await adminClient
    .from("user_activity_events")
    .insert({
      profile_id: input.profileId ?? null,
      email: input.email?.toLowerCase() ?? null,
      event_type: input.eventType,
      project_id: input.projectId ?? null,
      actor_profile_id: input.actorProfileId ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    });

  if (error) {
    console.warn("[user-activity] failed to log event:", error.message);
  }
}

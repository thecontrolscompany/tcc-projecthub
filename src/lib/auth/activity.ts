import type { SupabaseClient } from "@supabase/supabase-js";

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

export function requestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
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

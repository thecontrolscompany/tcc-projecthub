import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { canWriteEstimates } from "@/lib/estimates/api";
import { EstimatingSettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

async function resolveDefaultOrganizationId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string | null) {
  const { data: defaultOrgId } = await supabase.rpc("current_user_default_organization_id");
  if (typeof defaultOrgId === "string") return defaultOrgId;

  if (userId) {
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("profile_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membership?.organization_id) return membership.organization_id as string;
  }

  return null;
}

export default async function EstimatingSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const profile = await resolveUserRole(user);
  if (!canWriteEstimates(profile?.role ?? "")) notFound();

  const organizationId = await resolveDefaultOrganizationId(supabase, user.id);
  if (!organizationId) notFound();

  return <EstimatingSettingsClient organizationId={organizationId} />;
}

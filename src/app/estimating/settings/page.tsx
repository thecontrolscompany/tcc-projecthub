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

async function hasOrganizationAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("organization_id", organizationId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

export default async function EstimatingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const profile = await resolveUserRole(user);
  if (!canWriteEstimates(profile?.role ?? "")) notFound();

  const requestedOrganizationId = typeof params.organizationId === "string" ? params.organizationId.trim() : "";
  if (requestedOrganizationId && !(await hasOrganizationAccess(supabase, user.id, requestedOrganizationId))) {
    notFound();
  }

  const organizationId = requestedOrganizationId || (await resolveDefaultOrganizationId(supabase, user.id));
  if (!organizationId) notFound();

  return <EstimatingSettingsClient organizationId={organizationId} />;
}

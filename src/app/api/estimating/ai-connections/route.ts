import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { canReadEstimates, canWriteEstimates } from "@/lib/estimates/api";
import { encryptAiApiKey, getKeyHint } from "@/modules/hvac-estimator/ai/connectionCrypto";
import { isAiProvider } from "@/modules/hvac-estimator/ai/providerRegistry";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function resolveAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  return { supabase, user, role };
}

async function resolveOrganizationAccess(
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

  if (error) return { error };
  if (!data) return { error: new Error("Access denied.") };
  return { ok: true as const };
}

export async function GET(request: Request) {
  const auth = await resolveAuth();
  if ("error" in auth) return auth.error;
  if (!canReadEstimates(auth.role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId") || "";
  if (!organizationId) return badRequest("organizationId is required.");

  const access = await resolveOrganizationAccess(auth.supabase, auth.user.id, organizationId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error instanceof Error ? access.error.message : "Unable to verify access." }, { status: 403 });
  }

  const { data, error } = await auth.supabase
    .from("estimator_ai_connections")
    .select("id, provider, label, model, endpoint, key_hint, created_at, updated_at, last_used_at")
    .eq("organization_id", organizationId)
    .order("provider", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ connections: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await resolveAuth();
  if ("error" in auth) return auth.error;
  if (!canWriteEstimates(auth.role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const organizationId = normalizeText(body?.organizationId);
  const provider = normalizeText(body?.provider);
  const label = normalizeText(body?.label);
  const model = normalizeText(body?.model);
  const endpoint = normalizeText(body?.endpoint);
  const apiKey = normalizeText(body?.apiKey);

  if (!organizationId) return badRequest("organizationId is required.");
  if (!isAiProvider(provider)) return badRequest("Select a supported AI provider.");

  const access = await resolveOrganizationAccess(auth.supabase, auth.user.id, organizationId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error instanceof Error ? access.error.message : "Unable to verify access." }, { status: 403 });
  }

  const existingRes = await auth.supabase
    .from("estimator_ai_connections")
    .select("id, encrypted_api_key, key_hint, label, model, endpoint")
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .maybeSingle();

  if (existingRes.error) return NextResponse.json({ error: existingRes.error.message }, { status: 500 });

  const encryptedApiKey = apiKey
    ? encryptAiApiKey(apiKey)
    : existingRes.data?.encrypted_api_key || "";

  if (!encryptedApiKey) {
    return badRequest("Enter an API key to connect this provider.");
  }

  const payload = {
    organization_id: organizationId,
    created_by_profile_id: auth.user.id,
    provider,
    label: label || existingRes.data?.label || "",
    model: model || existingRes.data?.model || "",
    endpoint: endpoint || existingRes.data?.endpoint || "",
    encrypted_api_key: encryptedApiKey,
    key_hint: apiKey ? getKeyHint(apiKey) : existingRes.data?.key_hint || "",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await auth.supabase
    .from("estimator_ai_connections")
    .upsert(payload, { onConflict: "organization_id,provider" })
    .select("id, provider, label, model, endpoint, key_hint, created_at, updated_at, last_used_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ connection: data });
}

export async function DELETE(request: Request) {
  const auth = await resolveAuth();
  if ("error" in auth) return auth.error;
  if (!canWriteEstimates(auth.role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const organizationId = normalizeText(body?.organizationId);
  const provider = normalizeText(body?.provider);
  if (!organizationId) return badRequest("organizationId is required.");
  if (!isAiProvider(provider)) return badRequest("Select a supported AI provider.");

  const access = await resolveOrganizationAccess(auth.supabase, auth.user.id, organizationId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error instanceof Error ? access.error.message : "Unable to verify access." }, { status: 403 });
  }

  const { error } = await auth.supabase
    .from("estimator_ai_connections")
    .delete()
    .eq("organization_id", organizationId)
    .eq("provider", provider);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

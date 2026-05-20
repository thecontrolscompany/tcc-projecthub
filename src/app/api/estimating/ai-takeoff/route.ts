import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { canReadEstimates } from "@/lib/estimates/api";
import { decryptAiApiKey } from "@/modules/hvac-estimator/ai/connectionCrypto";
import { buildScopeTakeoffPrompt, extractUploadedFileText, runScopeTakeoffWithProvider } from "@/modules/hvac-estimator/ai/takeoffServer";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
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

  if (error) return { error };
  if (!data) return { error: new Error("Access denied.") };
  return { ok: true as const };
}

export async function POST(request: Request) {
  const auth = await resolveAuth();
  if ("error" in auth) return auth.error;
  if (!canReadEstimates(auth.role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return badRequest("Invalid form data.");

  const estimateId = normalizeText(formData.get("estimateId"));
  const provider = normalizeText(formData.get("provider"));
  const scopeText = normalizeText(formData.get("scopeText"));

  if (!estimateId) return badRequest("estimateId is required.");
  if (!provider) return badRequest("provider is required.");
  if (!scopeText && formData.getAll("files").length === 0) {
    return badRequest("Provide pasted scope text or upload at least one file.");
  }

  const { data: estimate, error: estimateError } = await auth.supabase
    .from("estimates")
    .select("id, organization_id, name, customer, body")
    .eq("id", estimateId)
    .maybeSingle();

  if (estimateError) return NextResponse.json({ error: estimateError.message }, { status: 500 });
  if (!estimate) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });

  const organizationId = estimate.organization_id as string | null;
  if (!organizationId) return badRequest("Estimate is not linked to an organization.");

  const access = await hasOrganizationAccess(auth.supabase, auth.user.id, organizationId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error instanceof Error ? access.error.message : "Unable to verify access." }, { status: 403 });
  }

  const { data: connection, error: connectionError } = await auth.supabase
    .from("estimator_ai_connections")
    .select("id, provider, label, model, endpoint, encrypted_api_key")
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .maybeSingle();

  if (connectionError) return NextResponse.json({ error: connectionError.message }, { status: 500 });
  if (!connection) return NextResponse.json({ error: "No AI connection configured for this provider." }, { status: 404 });
  if (!connection.model) return NextResponse.json({ error: "The saved AI connection is missing a model." }, { status: 400 });
  if (connection.provider === "azure_openai" && !connection.endpoint) {
    return NextResponse.json({ error: "The saved Azure OpenAI connection is missing an endpoint." }, { status: 400 });
  }

  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const uploadedFiles = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      text: await extractUploadedFileText(file),
    })),
  );

  const prompt = await buildScopeTakeoffPrompt({
    estimate,
    scopeText,
    uploadedFiles,
  });

  const decryptedKey = decryptAiApiKey(connection.encrypted_api_key);
  const { validated: scopeImport, rawText } = await runScopeTakeoffWithProvider({
    provider: connection.provider,
    apiKey: decryptedKey,
    model: connection.model,
    endpoint: connection.endpoint,
    organizationId,
    prompt,
  });

  await auth.supabase
    .from("estimator_ai_connections")
    .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", connection.id);

  return NextResponse.json({
    scopeImport,
    source: {
      estimateId,
      organizationId,
      provider: connection.provider,
      connectionId: connection.id,
      files: uploadedFiles.map((file) => file.name),
    },
    rawText,
  });
}

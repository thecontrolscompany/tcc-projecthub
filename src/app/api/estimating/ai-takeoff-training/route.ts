import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { canReadEstimates } from "@/lib/estimates/api";
import { decryptAiApiKey } from "@/modules/hvac-estimator/ai/connectionCrypto";
import { buildScopeTakeoffPrompt, extractUploadedFileText, runScopeTakeoffWithProvider } from "@/modules/hvac-estimator/ai/takeoffServer";

function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const profile = await resolveUserRole(user);
    if (!canReadEstimates(profile?.role ?? "")) return NextResponse.json({ error: "Access denied." }, { status: 403 });

    const formData = await request.formData().catch(() => null);
    if (!formData) return bad("Invalid form data.");

    const organizationId = String(formData.get("organizationId") ?? "").trim();
    const provider = String(formData.get("provider") ?? "").trim();
    const scopeText = String(formData.get("scopeText") ?? "").trim();

    if (!organizationId) return bad("organizationId is required.");
    if (!provider) return bad("provider is required.");

    const directFiles = formData.getAll("files").filter((e): e is File => e instanceof File && e.size > 0);
    if (!scopeText && directFiles.length === 0) return bad("Provide scope text or upload at least one file.");

    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: connection, error: connErr } = await admin
      .from("estimator_ai_connections")
      .select("id, provider, label, model, endpoint, encrypted_api_key")
      .eq("organization_id", organizationId)
      .eq("provider", provider)
      .maybeSingle();

    if (connErr) return NextResponse.json({ error: connErr.message }, { status: 500 });
    if (!connection) return NextResponse.json({ error: "No AI connection configured for this provider." }, { status: 404 });
    if (!connection.model) return bad("The saved AI connection is missing a model.");

    const uploadedFiles = await Promise.all(
      directFiles.map(async (file) => ({ name: file.name, text: await extractUploadedFileText(file) })),
    );

    const prompt = await buildScopeTakeoffPrompt({ estimate: null, scopeText, uploadedFiles });
    const decryptedKey = decryptAiApiKey(connection.encrypted_api_key);
    const { validated: scopeImport, rawText } = await runScopeTakeoffWithProvider({
      provider: connection.provider,
      apiKey: decryptedKey,
      model: connection.model,
      endpoint: connection.endpoint ?? null,
      organizationId,
      prompt,
    });

    return NextResponse.json({ scopeImport, rawText });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Parsing failed." },
      { status: 500 },
    );
  }
}

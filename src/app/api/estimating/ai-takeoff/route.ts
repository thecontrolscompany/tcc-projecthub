import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { canReadEstimates } from "@/lib/estimates/api";
import { decryptAiApiKey } from "@/modules/hvac-estimator/ai/connectionCrypto";
import {
  buildScopeTakeoffPrompt,
  extractScheduleSheetCandidates,
  extractUploadedFileText,
  runScopeTakeoffWithProvider,
  transcribeScheduleImages,
} from "@/modules/hvac-estimator/ai/takeoffServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  getSharePointSiteId,
  getSharePointDriveId,
  deleteSharePointItem,
  fetchSharePointItemContent,
  graphFetch,
} from "@/lib/graph/client";

const AI_PARSER_TEMP_FOLDER = "AI Parser Temp";

// Rendering + vision-transcribing multiple schedule pages plus the final takeoff call
// can comfortably exceed the 60s used elsewhere in the app for lighter AI batch routes.
export const maxDuration = 300;

type AiConnectionCtx = {
  provider: string;
  apiKey: string;
  model: string;
  endpoint: string | null;
  organizationId: string;
};

async function extractPdfTextWithSchedules(name: string, buffer: Buffer, connectionCtx: AiConnectionCtx) {
  const file = new File([new Uint8Array(buffer)], name);
  const text = await extractUploadedFileText(file);

  if (!/\.pdf$/i.test(name)) {
    return { text, visionPages: [] };
  }

  try {
    const { pages: candidates } = await extractScheduleSheetCandidates(buffer);
    if (candidates.length === 0) return { text, visionPages: [] };

    const transcribed = await transcribeScheduleImages({ ...connectionCtx, pages: candidates });
    if (transcribed.length === 0) return { text, visionPages: [] };

    const scheduleBlock = transcribed
      .map((page) => `--- SCHEDULE TABLE (vision-extracted, sheet ${page.title || `page ${page.pageNumber}`}) ---\n${page.text}`)
      .join("\n\n");

    return {
      text: `${text}\n\n${scheduleBlock}`,
      visionPages: transcribed.map((page) => page.title || `Page ${page.pageNumber}`),
    };
  } catch (error) {
    console.error(`Schedule-sheet vision extraction failed for ${name}:`, error);
    return { text, visionPages: [] };
  }
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function createServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
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
  organizationId: string,
) {
  const { data, error } = await supabase.rpc("current_user_organization_ids");
  if (error) return { error };
  const organizationIds = Array.isArray(data) ? data.map((value) => String(value)) : [];
  if (!organizationIds.includes(organizationId)) return { error: new Error("Access denied.") };
  return { ok: true as const };
}

async function getProviderToken(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.provider_token;
  if (!token) throw new Error("Microsoft access token not available. Please sign in again.");
  return token;
}

// GET /api/estimating/ai-takeoff?action=prepare-upload&estimateId=...&fileName=...
// Creates a SharePoint upload session so the client can upload large files directly
// to Microsoft without going through Vercel.
export async function GET(request: Request) {
  try {
    const auth = await resolveAuth();
    if ("error" in auth) return auth.error;
    if (!canReadEstimates(auth.role)) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    if (action !== "prepare-upload") return badRequest("Unknown action.");

    const estimateId = (searchParams.get("estimateId") ?? "").trim();
    const fileName = (searchParams.get("fileName") ?? "").trim();
    if (!estimateId) return badRequest("estimateId is required.");
    if (!fileName) return badRequest("fileName is required.");

    const providerToken = await getProviderToken(auth.supabase);
    const siteId = await getSharePointSiteId(providerToken);
    const driveId = await getSharePointDriveId(providerToken, siteId);

    const folderPath = `${AI_PARSER_TEMP_FOLDER}/${estimateId}`;
    const encodedPath = folderPath
      .split("/")
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/");
    const encodedName = encodeURIComponent(fileName);

    const sessionRes = await graphFetch(
      `/drives/${driveId}/root:/${encodedPath}/${encodedName}:/createUploadSession`,
      providerToken,
      {
        method: "POST",
        body: JSON.stringify({
          item: { "@microsoft.graph.conflictBehavior": "replace", name: fileName },
        }),
      },
    );

    if (!sessionRes.ok) {
      const msg = await sessionRes.text();
      throw new Error(msg || "Unable to create SharePoint upload session.");
    }

    const session = await sessionRes.json();
    if (!session?.uploadUrl) throw new Error("SharePoint did not return an upload URL.");

    return NextResponse.json({ uploadUrl: session.uploadUrl, driveId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to prepare upload." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
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
    const tempItemsRaw = normalizeText(formData.get("tempItems"));

    if (!estimateId) return badRequest("estimateId is required.");
    if (!provider) return badRequest("provider is required.");

    const directFiles = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const tempItems: { driveId: string; itemId: string; name: string }[] = tempItemsRaw
      ? (() => { try { return JSON.parse(tempItemsRaw); } catch { return []; } })()
      : [];

    if (!scopeText && directFiles.length === 0 && tempItems.length === 0) {
      return badRequest("Provide pasted scope text or upload at least one file.");
    }

    const admin = createServiceClient();
    const { data: estimate, error: estimateError } = await admin
      .from("estimates")
      .select("id, organization_id, name, body")
      .eq("id", estimateId)
      .maybeSingle();

    if (estimateError) return NextResponse.json({ error: estimateError.message }, { status: 500 });
    if (!estimate) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });

    const organizationId = estimate.organization_id as string | null;
    if (!organizationId) return badRequest("Estimate is not linked to an organization.");

    const access = await hasOrganizationAccess(auth.supabase, organizationId);
    if ("error" in access) {
      return NextResponse.json({ error: access.error instanceof Error ? access.error.message : "Unable to verify access." }, { status: 403 });
    }

    const { data: connection, error: connectionError } = await admin
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

    const decryptedKey = decryptAiApiKey(connection.encrypted_api_key);
    const connectionCtx = {
      provider: connection.provider,
      apiKey: decryptedKey,
      model: connection.model,
      endpoint: connection.endpoint,
      organizationId,
    };

    let processedFiles: { name: string; text: string; visionPages: string[] }[] = [];

    if (tempItems.length > 0) {
      const providerToken = await getProviderToken(auth.supabase);
      processedFiles = await Promise.all(
        tempItems.map(async (item) => {
          const contentRes = await fetchSharePointItemContent(providerToken, item.driveId, item.itemId);
          if (!contentRes.ok) throw new Error(`Unable to download staged file: ${item.name}`);
          const buffer = Buffer.from(await contentRes.arrayBuffer());
          const { text, visionPages } = await extractPdfTextWithSchedules(item.name, buffer, connectionCtx);
          // Clean up temp file — non-fatal if it fails
          deleteSharePointItem(providerToken, item.driveId, item.itemId).catch(() => {});
          return { name: item.name, text, visionPages };
        }),
      );
    } else {
      processedFiles = await Promise.all(
        directFiles.map(async (file) => {
          const buffer = Buffer.from(await file.arrayBuffer());
          const { text, visionPages } = await extractPdfTextWithSchedules(file.name, buffer, connectionCtx);
          return { name: file.name, text, visionPages };
        }),
      );
    }

    const uploadedFiles = processedFiles.map(({ name, text }) => ({ name, text }));
    const visionPages = processedFiles.flatMap((file) => file.visionPages);

    const prompt = await buildScopeTakeoffPrompt({
      estimate,
      scopeText,
      uploadedFiles,
    });

    const { validated: scopeImport, rawText } = await runScopeTakeoffWithProvider({
      provider: connection.provider,
      apiKey: decryptedKey,
      model: connection.model,
      endpoint: connection.endpoint,
      organizationId,
      prompt,
    });

    await admin
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
        visionPages,
      },
      rawText,
    });
  } catch (error) {
    console.error("Estimating AI takeoff failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to parse scope." },
      { status: 500 },
    );
  }
}

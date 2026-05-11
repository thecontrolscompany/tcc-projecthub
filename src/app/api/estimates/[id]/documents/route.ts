import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import {
  canReadEstimates,
  canWriteEstimates,
  ESTIMATE_SELECT,
} from "@/lib/estimates/api";
import {
  createSharePointFolder,
  getSharePointDriveId,
  getSharePointFolderIdByPath,
  getSharePointSiteId,
  graphFetch,
} from "@/lib/graph/client";

type EstimateDocumentRole = "supporting_scope" | "customer_upload" | "addendum";
type EstimateAuth = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string };
  role: string;
};

const DOCUMENT_ROLE_FOLDERS: Record<EstimateDocumentRole, string> = {
  customer_upload: "01 Customer Uploads",
  supporting_scope: "02 Internal Review",
  addendum: "03 Estimate Working",
};

const SUBFOLDERS = ["01 Customer Uploads", "02 Internal Review", "03 Estimate Working", "04 Submitted Quote"];

function sanitizeSegment(value: string) {
  return String(value || "")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function encodeGraphPath(...segments: string[]) {
  return segments
    .flatMap((segment) => segment.split("/"))
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function getEstimateCustomer(body: Record<string, unknown>) {
  const settings = (body.settings as Record<string, unknown> | undefined) ?? {};
  return (
    (body.customer as string | undefined) ??
    (settings.customer as string | undefined) ??
    (body.platformContext as { customer?: string } | null | undefined)?.customer ??
    ""
  );
}

function getEstimateFolderName(estimate: { id: string; number: string | null; name: string; body: Record<string, unknown> }) {
  const estimateLabel = estimate.number?.trim()
    ? `EST-${sanitizeSegment(estimate.number)}`
    : `EST-${estimate.id.slice(0, 8).toUpperCase()}`;
  const customer = sanitizeSegment(getEstimateCustomer(estimate.body));
  const projectName = sanitizeSegment(estimate.name || "Untitled Estimate");
  return [estimateLabel, customer, projectName].filter(Boolean).join(" - ");
}

async function getAuth(): Promise<EstimateAuth | { error: Response }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";

  return { supabase, user, role };
}

async function requireReadAccess(): Promise<EstimateAuth | Response> {
  const auth = await getAuth();
  if ("error" in auth) return auth.error;
  if (!canReadEstimates(auth.role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  return auth;
}

async function requireWriteAccess(): Promise<EstimateAuth | Response> {
  const auth = await getAuth();
  if ("error" in auth) return auth.error;
  if (!canWriteEstimates(auth.role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  return auth;
}

async function resolveEstimateRecord(supabase: Awaited<ReturnType<typeof createClient>>, estimateId: string) {
  const { data, error } = await supabase.from("estimates").select(ESTIMATE_SELECT).eq("id", estimateId).single();
  if (error) throw error;
  return data as {
    id: string;
    number: string | null;
    name: string;
    body: Record<string, unknown>;
    linked_project_id: string | null;
  };
}

async function ensureSharePointFolderPath(
  providerToken: string,
  driveId: string,
  folderPath: string,
) {
  const segments = folderPath.split("/").filter(Boolean);
  let parentPath = "";
  let itemId = "";

  for (const segment of segments) {
    const currentPath = parentPath ? `${parentPath}/${segment}` : segment;

    try {
      itemId = await getSharePointFolderIdByPath(providerToken, driveId, currentPath);
    } catch {
      itemId = await createSharePointFolder(providerToken, driveId, parentPath, segment);
    }

    parentPath = currentPath;
  }

  return itemId;
}

async function resolveSharePointContext(
  providerToken: string,
  estimate: { id: string; number: string | null; name: string; body: Record<string, unknown> },
) {
  const body = estimate.body as Record<string, unknown>;
  const existingFolder = typeof body.sharepointFolder === "string" ? body.sharepointFolder : "";
  const existingItemId = typeof body.sharepointItemId === "string" ? body.sharepointItemId : "";
  const siteId = await getSharePointSiteId(providerToken);
  const driveId = await getSharePointDriveId(providerToken, siteId);

  await ensureSharePointFolderPath(providerToken, driveId, "Bids");

  async function ensureSubfolders(folderPath: string) {
    for (const subfolder of SUBFOLDERS) {
      try {
        await createSharePointFolder(providerToken, driveId, folderPath, subfolder);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("409")) {
          throw error;
        }
      }
    }
  }

  if (existingFolder) {
    const folderItemId = existingItemId || (await ensureSharePointFolderPath(providerToken, driveId, existingFolder));
    await ensureSubfolders(existingFolder);
    return { siteId, driveId, folderPath: existingFolder, itemId: folderItemId || null };
  }
  const folderName = getEstimateFolderName(estimate);
  const folderPath = `Bids/${folderName}`;

  const itemId = await ensureSharePointFolderPath(providerToken, driveId, folderPath);

  for (const subfolder of SUBFOLDERS) {
    try {
      await createSharePointFolder(providerToken, driveId, folderPath, subfolder);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("409")) {
        throw error;
      }
    }
  }

  return { siteId, driveId, folderPath, itemId };
}

async function uploadFile(
  providerToken: string,
  driveId: string,
  folderPath: string,
  fileName: string,
  fileBuffer: ArrayBuffer,
  contentType: string | null,
) {
  const encodedPath = encodeGraphPath(folderPath, fileName);
  const size = fileBuffer.byteLength;

  if (size <= 4 * 1024 * 1024) {
    const uploadRes = await graphFetch(`/drives/${driveId}/root:/${encodedPath}:/content`, providerToken, {
      method: "PUT",
      headers: {
        "Content-Type": contentType || "application/octet-stream",
      },
      body: Buffer.from(fileBuffer),
    });

    if (!uploadRes.ok) {
      const message = await uploadRes.text();
      throw new Error(message || "SharePoint upload failed.");
    }

    const data = await uploadRes.json();
    return {
      id: data?.id as string | null,
      webUrl: data?.webUrl as string | null,
      name: data?.name as string | null,
    };
  }

  const sessionRes = await graphFetch(`/drives/${driveId}/root:/${encodedPath}:/createUploadSession`, providerToken, {
    method: "POST",
    body: JSON.stringify({
      item: {
        "@microsoft.graph.conflictBehavior": "replace",
        name: fileName,
      },
    }),
  });

  if (!sessionRes.ok) {
    const message = await sessionRes.text();
    throw new Error(message || "Unable to create upload session.");
  }

  const session = await sessionRes.json();
  const uploadUrl = session?.uploadUrl as string | undefined;
  if (!uploadUrl) {
    throw new Error("Upload session did not return an upload URL.");
  }

  const buffer = Buffer.from(fileBuffer);
  const chunkSize = 10 * 1024 * 1024;
  let response: Response | null = null;

  for (let start = 0; start < buffer.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, buffer.length);
    const chunk = buffer.subarray(start, end);
    response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${start}-${end - 1}/${buffer.length}`,
      },
      body: chunk,
    });

    if (![200, 201, 202].includes(response.status)) {
      const message = await response.text();
      throw new Error(message || "Chunked SharePoint upload failed.");
    }
  }

  const finalData = response ? await response.json().catch(() => null) : null;
  return {
    id: finalData?.id as string | null,
    webUrl: finalData?.webUrl as string | null,
    name: finalData?.name as string | null,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireReadAccess();
  if (authResult instanceof Response) return authResult;
  const auth = authResult;

  const { id } = await params;
  try {
    const estimate = await resolveEstimateRecord(auth.supabase, id);
    const { data, error } = await auth.supabase
      .from("opportunity_documents")
      .select(
        "id, estimate_id, document_role, file_name, file_ext, content_type, file_size_bytes, storage_provider, storage_path, storage_item_id, storage_web_url, uploaded_by, uploaded_at, archived_for_customer, is_primary_source, extraction_status, extraction_version, extracted_at, extracted_by, extraction_notes, extracted_json",
      )
      .eq("estimate_id", estimate.id)
      .order("uploaded_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      estimate_id: estimate.id,
      sharepoint_folder: typeof estimate.body.sharepointFolder === "string" ? estimate.body.sharepointFolder : null,
      documents: data ?? [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load documents." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireWriteAccess();
  if (authResult instanceof Response) return authResult;
  const auth = authResult;

  const { id } = await params;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  const documentRole = String(formData.get("documentRole") || "supporting_scope") as EstimateDocumentRole;
  const notes = String(formData.get("notes") || "").trim();

  if (!(file instanceof File) || !file.name) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  if (!(documentRole in DOCUMENT_ROLE_FOLDERS)) {
    return NextResponse.json({ error: "Invalid document role." }, { status: 400 });
  }

  try {
    const estimate = await resolveEstimateRecord(auth.supabase, id);
    const providerToken = (await auth.supabase.auth.getSession()).data.session?.provider_token;
    if (!providerToken) {
      return NextResponse.json({ error: "Microsoft access token not available." }, { status: 401 });
    }

    const { driveId, folderPath } = await resolveSharePointContext(providerToken, estimate);
    const destinationFolder = `${folderPath}/${DOCUMENT_ROLE_FOLDERS[documentRole]}`;
    const fileBuffer = await file.arrayBuffer();
    const ext = file.name.includes(".") ? `.${file.name.split(".").pop() ?? ""}`.toLowerCase() : null;

    const upload = await uploadFile(providerToken, driveId, destinationFolder, file.name, fileBuffer, file.type || null);

    const { data: inserted, error } = await auth.supabase
      .from("opportunity_documents")
      .insert({
        estimate_id: estimate.id,
        project_id: estimate.linked_project_id,
        document_role: documentRole,
        file_name: file.name,
        file_ext: ext,
        content_type: file.type || null,
        file_size_bytes: file.size,
        storage_provider: "sharepoint",
        storage_path: `${destinationFolder}/${file.name}`,
        storage_item_id: upload.id,
        storage_web_url: upload.webUrl,
        uploaded_by: auth.user.id,
        archived_for_customer: documentRole !== "customer_upload",
        is_primary_source: documentRole !== "addendum",
        extraction_status: "pending",
        extraction_version: null,
        extracted_at: null,
        extracted_by: null,
        extraction_notes: notes || null,
        extracted_json: null,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ document: inserted }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 },
    );
  }
}

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
  getMailAttachment,
  getSharePointDriveId,
  getSharePointFolderIdByPath,
  getSharePointSiteId,
  graphFetch,
  listRecentMailAttachments,
} from "@/lib/graph/client";

type EstimateDocumentRole = "supporting_scope" | "customer_upload" | "addendum" | "scope_of_work" | "proposal_pdf";
const VALID_DOCUMENT_ROLES = new Set<EstimateDocumentRole>(["supporting_scope", "customer_upload", "addendum", "scope_of_work", "proposal_pdf"]);
type EstimateDocumentStorage = {
  storagePath: string;
  storageItemId: string;
  storageWebUrl: string | null;
};
type EstimateDocumentBase = {
  documentRole: EstimateDocumentRole;
  fileName: string;
  fileExt: string | null;
  contentType: string | null;
  fileSizeBytes: number;
  notes: string;
};
type EstimateAuth = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string };
  role: string;
};

const PROJECT_SUBFOLDERS = [
  "01 Contract",
  "02 Estimate",
  "03 Submittals",
  "04 Drawings",
  "05 Change Orders",
  "06 Closeout",
  "07 Billing",
  "99 Archive - Legacy Files",
];

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
    ? `EST-${sanitizeSegment(estimate.number).replace(/^EST-/i, "")}`
    : `EST-${estimate.id.slice(0, 8).toUpperCase()}`;
  const projectName = sanitizeSegment(estimate.name || "Untitled Estimate");
  return [estimateLabel, projectName].filter(Boolean).join(" - ");
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
  const { data, error } = await supabase.from("estimates").select(ESTIMATE_SELECT).eq("id", estimateId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Estimate not found: ${estimateId}`);
  return data as {
    id: string;
    number: string | null;
    name: string;
    body: Record<string, unknown>;
    linked_project_id: string | null;
  };
}

async function resolveEstimateProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  estimate: { id: string; linked_project_id: string | null },
) {
  if (estimate.linked_project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, job_number, sharepoint_folder, sharepoint_item_id, source_estimate_id")
      .eq("id", estimate.linked_project_id)
      .maybeSingle();
    if (project) return project;
  }

  const { data: sourceProject } = await supabase
    .from("projects")
    .select("id, name, job_number, sharepoint_folder, sharepoint_item_id, source_estimate_id")
    .eq("source_estimate_id", estimate.id)
    .maybeSingle();
  return sourceProject ?? null;
}

async function createDocumentUploadSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  providerToken: string,
  estimate: { id: string; number: string | null; name: string; body: Record<string, unknown>; linked_project_id: string | null },
  documentRole: EstimateDocumentRole,
  fileName: string,
) {
  const { driveId, folderPath } = await resolveSharePointContext(supabase, providerToken, estimate);
  const encodedPath = encodeGraphPath(folderPath, fileName);
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

  return {
    uploadUrl,
    storagePath: `${folderPath}/${fileName}`,
  };
}

async function saveDocumentMetadata(
  auth: EstimateAuth,
  estimate: { id: string; linked_project_id: string | null },
  base: EstimateDocumentBase,
  storage: EstimateDocumentStorage,
) {
  const { data: inserted, error } = await auth.supabase
    .from("opportunity_documents")
    .insert({
      estimate_id: estimate.id,
      project_id: estimate.linked_project_id,
      document_role: base.documentRole,
      file_name: base.fileName,
      file_ext: base.fileExt,
      content_type: base.contentType,
      file_size_bytes: base.fileSizeBytes,
      storage_provider: "sharepoint",
      storage_path: storage.storagePath,
      storage_item_id: storage.storageItemId,
      storage_web_url: storage.storageWebUrl,
      uploaded_by: auth.user.id,
      archived_for_customer: base.documentRole !== "customer_upload",
      is_primary_source: base.documentRole !== "addendum",
      extraction_status: "pending",
      extraction_version: null,
      extracted_at: null,
      extracted_by: null,
      extraction_notes: base.notes || null,
      extracted_json: null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return inserted;
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
  supabase: Awaited<ReturnType<typeof createClient>>,
  providerToken: string,
  estimate: { id: string; number: string | null; name: string; body: Record<string, unknown>; linked_project_id: string | null },
) {
  const body = estimate.body as Record<string, unknown>;
  const siteId = await getSharePointSiteId(providerToken);
  const driveId = await getSharePointDriveId(providerToken, siteId);
  const project = await resolveEstimateProject(supabase, estimate);

  if (project) {
    const projectRoot =
      typeof project.sharepoint_folder === "string" && project.sharepoint_folder.trim()
        ? project.sharepoint_folder.trim()
        : `Active Projects/${sanitizeSegment(project.name || "Untitled Project")}`;
    const estimateRoot = `${projectRoot}/02 Estimate`;

    await ensureSharePointFolderPath(providerToken, driveId, projectRoot);
    for (const subfolder of PROJECT_SUBFOLDERS) {
      try {
        await createSharePointFolder(providerToken, driveId, projectRoot, subfolder);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("409")) {
          throw error;
        }
      }
    }

    const itemId = await ensureSharePointFolderPath(providerToken, driveId, estimateRoot);
    return { siteId, driveId, folderPath: estimateRoot, itemId };
  }

  const existingFolder = typeof body.sharepointFolder === "string" ? body.sharepointFolder : "";
  const existingItemId = typeof body.sharepointItemId === "string" ? body.sharepointItemId : "";

  await ensureSharePointFolderPath(providerToken, driveId, "Bids");

  if (existingFolder) {
    const folderItemId = existingItemId || (await ensureSharePointFolderPath(providerToken, driveId, existingFolder));
    return { siteId, driveId, folderPath: existingFolder, itemId: folderItemId || null };
  }
  const folderName = getEstimateFolderName(estimate);
  const folderPath = `Bids/${folderName}`;
  const itemId = await ensureSharePointFolderPath(providerToken, driveId, folderPath);
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
  const estimate = await resolveEstimateRecord(auth.supabase, id);

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const action = String((payload as { action?: unknown }).action || "");
    const documentRole = String((payload as { documentRole?: unknown }).documentRole || "supporting_scope") as EstimateDocumentRole;

    if (!VALID_DOCUMENT_ROLES.has(documentRole)) {
      return NextResponse.json({ error: "Invalid document role." }, { status: 400 });
    }

    if (action === "prepare") {
      const fileName = String((payload as { fileName?: unknown }).fileName || "").trim();
      if (!fileName) {
        return NextResponse.json({ error: "A file name is required." }, { status: 400 });
      }

      try {
        const providerToken = (await auth.supabase.auth.getSession()).data.session?.provider_token;
        if (!providerToken) {
          return NextResponse.json({ error: "Microsoft access token not available." }, { status: 401 });
        }

        const session = await createDocumentUploadSession(auth.supabase, providerToken, estimate, documentRole, fileName);
        return NextResponse.json({
          uploadUrl: session.uploadUrl,
          storagePath: session.storagePath,
        });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Unable to prepare document upload." },
          { status: 500 },
        );
      }
    }

    if (action === "commit") {
      const fileName = String((payload as { fileName?: unknown }).fileName || "").trim();
      const storageItemId = String((payload as { storageItemId?: unknown }).storageItemId || "").trim();
      const storageWebUrl = String((payload as { storageWebUrl?: unknown }).storageWebUrl || "").trim() || null;
      const storagePath = String((payload as { storagePath?: unknown }).storagePath || "").trim();
      const fileExt = (payload as { fileExt?: unknown }).fileExt;
      const contentTypeValue = String((payload as { contentType?: unknown }).contentType || "").trim() || null;
      const fileSizeBytes = Number((payload as { fileSizeBytes?: unknown }).fileSizeBytes);
      const notes = String((payload as { notes?: unknown }).notes || "").trim();

      if (!fileName || !storageItemId || !storagePath || !Number.isFinite(fileSizeBytes)) {
        return NextResponse.json({ error: "Missing upload metadata." }, { status: 400 });
      }

      try {
        const inserted = await saveDocumentMetadata(
          auth,
          estimate,
          {
            documentRole,
            fileName,
            fileExt: typeof fileExt === "string" ? fileExt : null,
            contentType: contentTypeValue,
            fileSizeBytes,
            notes,
          },
          {
            storagePath,
            storageItemId,
            storageWebUrl,
          }
        );

        return NextResponse.json({ document: inserted }, { status: 201 });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Unable to save document metadata." },
          { status: 500 },
        );
      }
    }

    if (action === "list-email-attachments") {
      try {
        const providerToken = (await auth.supabase.auth.getSession()).data.session?.provider_token;
        if (!providerToken) {
          return NextResponse.json({ error: "Microsoft access token not available." }, { status: 401 });
        }

        const messages = await listRecentMailAttachments(providerToken);
        return NextResponse.json({ messages });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Unable to list email attachments." },
          { status: 500 },
        );
      }
    }

    if (action === "import-email-attachment") {
      const messageId = String((payload as { messageId?: unknown }).messageId || "").trim();
      const attachmentId = String((payload as { attachmentId?: unknown }).attachmentId || "").trim();
      const notes = String((payload as { notes?: unknown }).notes || "").trim();

      if (!messageId || !attachmentId) {
        return NextResponse.json({ error: "A message and attachment are required." }, { status: 400 });
      }

      try {
        const providerToken = (await auth.supabase.auth.getSession()).data.session?.provider_token;
        if (!providerToken) {
          return NextResponse.json({ error: "Microsoft access token not available." }, { status: 401 });
        }

        const { driveId, folderPath } = await resolveSharePointContext(auth.supabase, providerToken, estimate);
        const attachment = await getMailAttachment(providerToken, messageId, attachmentId);
        const ext = attachment.name.includes(".")
          ? `.${attachment.name.split(".").pop() ?? ""}`.toLowerCase()
          : null;

        const upload = await uploadFile(providerToken, driveId, folderPath, attachment.name, attachment.bytes, attachment.contentType);
        if (!upload.id) {
          return NextResponse.json({ error: "SharePoint upload did not return an item ID." }, { status: 500 });
        }

        const inserted = await saveDocumentMetadata(
          auth,
          estimate,
          {
            documentRole,
            fileName: attachment.name,
            fileExt: ext,
            contentType: attachment.contentType,
            fileSizeBytes: attachment.bytes.byteLength,
            notes,
          },
          {
            storagePath: `${folderPath}/${attachment.name}`,
            storageItemId: upload.id,
            storageWebUrl: upload.webUrl,
          }
        );

        return NextResponse.json({ document: inserted }, { status: 201 });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Unable to import email attachment." },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ error: "Unsupported document action." }, { status: 400 });
  }

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

  if (!VALID_DOCUMENT_ROLES.has(documentRole)) {
    return NextResponse.json({ error: "Invalid document role." }, { status: 400 });
  }

  try {
    const providerToken = (await auth.supabase.auth.getSession()).data.session?.provider_token;
    if (!providerToken) {
      return NextResponse.json({ error: "Microsoft access token not available." }, { status: 401 });
    }

    const { driveId, folderPath } = await resolveSharePointContext(auth.supabase, providerToken, estimate);
    const fileBuffer = await file.arrayBuffer();
    const ext = file.name.includes(".") ? `.${file.name.split(".").pop() ?? ""}`.toLowerCase() : null;

    const upload = await uploadFile(providerToken, driveId, folderPath, file.name, fileBuffer, file.type || null);
    if (!upload.id) {
      return NextResponse.json({ error: "SharePoint upload did not return an item ID." }, { status: 500 });
    }
    const inserted = await saveDocumentMetadata(
      auth,
      estimate,
      {
        documentRole,
        fileName: file.name,
        fileExt: ext,
        contentType: file.type || null,
        fileSizeBytes: file.size,
        notes,
      },
      {
        storagePath: `${folderPath}/${file.name}`,
        storageItemId: upload.id,
        storageWebUrl: upload.webUrl,
      }
    );

    return NextResponse.json({ document: inserted }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 },
    );
  }
}

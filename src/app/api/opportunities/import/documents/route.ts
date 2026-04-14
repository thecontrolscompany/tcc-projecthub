import path from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createSharePointFolder,
  getSharePointDriveId,
  getSharePointFolderIdByPath,
  getSharePointSiteId,
  uploadFileToSharePointDrive,
} from "@/lib/graph/client";
import {
  buildLegacyImportFolderName,
  extractEstimateFromWorkbook,
  extractProposalFromDocx,
  extractProposalFromPdf,
  getDocumentDestinationSubfolder,
  LEGACY_IMPORT_SUBFOLDERS,
} from "@/lib/opportunity-document-ingestion";

type UploadRole = "proposal_docx" | "proposal_pdf" | "estimate_xlsm";

const FILE_ROLE_CONFIG: Record<UploadRole, { field: string; accept: string[] }> = {
  proposal_docx: { field: "proposalDocx", accept: [".docx"] },
  proposal_pdf: { field: "proposalPdf", accept: [".pdf"] },
  estimate_xlsm: { field: "estimateWorkbook", accept: [".xlsm"] },
};

export async function POST(request: Request) {
  const auth = await requireAdminWithMicrosoft();
  if ("error" in auth) return auth.error;

  try {
    const formData = await request.formData();
    const importRowId = formData.get("importRowId");

    if (typeof importRowId !== "string" || !importRowId.trim()) {
      return NextResponse.json({ error: "importRowId is required." }, { status: 400 });
    }

    const { supabase, providerToken, user } = auth;
    const { data: row, error: rowError } = await supabase
      .from("legacy_opportunity_import_rows")
      .select("id, batch_id, source_row_number, legacy_opportunity_name, company_name, proposal_date, amount, sharepoint_folder, sharepoint_item_id, proposal_docx_document_id, proposal_pdf_document_id, estimate_workbook_document_id")
      .eq("id", importRowId)
      .single();

    if (rowError || !row) {
      return NextResponse.json({ error: rowError?.message ?? "Import row not found." }, { status: 404 });
    }

    const { driveId } = await resolveSharePointIds(providerToken);
    const folderInfo = await ensureLegacyImportFolder(
      supabase,
      providerToken,
      driveId,
      row.id,
      row.batch_id,
      row.source_row_number,
      row.company_name,
      row.legacy_opportunity_name,
      row.sharepoint_folder,
      row.sharepoint_item_id
    );

    const uploadedDocuments = [];

    for (const [role, config] of Object.entries(FILE_ROLE_CONFIG) as Array<[UploadRole, { field: string; accept: string[] }]>) {
      const file = formData.get(config.field);
      if (!(file instanceof File) || !file.name) continue;

      const ext = path.extname(file.name).toLowerCase();
      if (!config.accept.includes(ext)) {
        return NextResponse.json({ error: `${file.name} is not a valid ${role} file.` }, { status: 400 });
      }

      const fileBytes = await file.arrayBuffer();
      const buffer = Buffer.from(fileBytes);
      const destinationSubfolder = getDocumentDestinationSubfolder(role);
      const upload = await uploadFileToSharePointDrive(
        providerToken,
        driveId,
        `${folderInfo.folderPath}/${destinationSubfolder}`,
        file.name,
        fileBytes,
        file.type || guessContentType(ext)
      );

      const extracted = await extractDocument(role, buffer);

      const { data: document, error: documentError } = await supabase
        .from("opportunity_documents")
        .insert({
          legacy_import_row_id: row.id,
          document_role: role,
          file_name: file.name,
          file_ext: ext,
          content_type: file.type || guessContentType(ext),
          file_size_bytes: file.size,
          storage_provider: "sharepoint",
          storage_path: `${folderInfo.folderPath}/${destinationSubfolder}/${file.name}`,
          storage_item_id: upload.id,
          storage_web_url: upload.webUrl,
          uploaded_by: user.id,
          archived_for_customer: role === "proposal_pdf",
          is_primary_source: role !== "proposal_pdf",
          extraction_status: "completed",
          extraction_version: "v1",
          extracted_at: new Date().toISOString(),
          extracted_by: user.id,
          extracted_json: extracted.documentJson,
        })
        .select("*")
        .single();

      if (documentError || !document) {
        return NextResponse.json({ error: documentError?.message ?? "Unable to save document metadata." }, { status: 400 });
      }

      await storeExtractionArtifacts(supabase, row.id, document.id, extracted);
      await updateImportRowFromDocument(supabase, row.id, role, document.id, extracted.rowPatch);

      uploadedDocuments.push(document);
    }

    return NextResponse.json({
      ok: true,
      sharepoint_folder: folderInfo.folderPath,
      documents: uploadedDocuments,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 }
    );
  }
}

async function requireAdminWithMicrosoft() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.provider_token) {
    return {
      error: NextResponse.json(
        {
          error:
            "Microsoft sign-in required for SharePoint uploads. Please sign out and sign back in with Microsoft.",
        },
        { status: 401 }
      ),
    };
  }

  return { supabase, providerToken: session.provider_token, user };
}

let cachedSiteId = process.env.SHAREPOINT_SITE_ID ?? "";
let cachedDriveId = process.env.SHAREPOINT_DRIVE_ID ?? "";

async function resolveSharePointIds(providerToken: string) {
  let siteId = process.env.SHAREPOINT_SITE_ID || cachedSiteId;
  if (!siteId) {
    siteId = await getSharePointSiteId(providerToken);
    cachedSiteId = siteId;
  }

  let driveId = process.env.SHAREPOINT_DRIVE_ID || cachedDriveId;
  if (!driveId) {
    driveId = await getSharePointDriveId(providerToken, siteId);
    cachedDriveId = driveId;
  }

  return { siteId, driveId };
}

async function ensureLegacyImportFolder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  providerToken: string,
  driveId: string,
  importRowId: string,
  batchId: string,
  sourceRowNumber: number,
  companyName: string | null,
  opportunityName: string | null,
  existingFolder: string | null,
  existingItemId: string | null
) {
  if (existingFolder && existingItemId) {
    return { folderPath: existingFolder, folderItemId: existingItemId };
  }

  const folderName = buildLegacyImportFolderName(companyName, opportunityName, batchId, sourceRowNumber);
  const folderPath = `Bids/${folderName}`;
  let folderItemId = "";

  try {
    folderItemId = await createSharePointFolder(providerToken, driveId, "Bids", folderName);
  } catch (error) {
    if (error instanceof Error && error.message.includes("409")) {
      folderItemId = await getSharePointFolderIdByPath(providerToken, driveId, folderPath);
    } else {
      throw error;
    }
  }

  for (const subfolder of LEGACY_IMPORT_SUBFOLDERS) {
    try {
      await createSharePointFolder(providerToken, driveId, folderPath, subfolder);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("409")) {
        throw error;
      }
    }
  }

  await supabase
    .from("legacy_opportunity_import_rows")
    .update({ sharepoint_folder: folderPath, sharepoint_item_id: folderItemId })
    .eq("id", importRowId);

  return { folderPath, folderItemId };
}

async function extractDocument(role: UploadRole, buffer: Buffer) {
  if (role === "proposal_docx") {
    const extracted = await extractProposalFromDocx(buffer);
    return {
      documentJson: extracted,
      rowPatch: {
        proposal_date: extracted.proposalDate,
      },
      pricingItems: extracted.pricingItems,
      scopeItems: extracted.scopeItems,
      equipmentGroups: extracted.equipmentGroups,
      estimateSummary: null,
    };
  }

  if (role === "proposal_pdf") {
    const extracted = await extractProposalFromPdf(buffer);
    return {
      documentJson: extracted,
      rowPatch: {
        proposal_date: extracted.proposalDate,
      },
      pricingItems: extracted.pricingItems,
      scopeItems: extracted.scopeItems,
      equipmentGroups: extracted.equipmentGroups,
      estimateSummary: null,
    };
  }

  const extracted = await extractEstimateFromWorkbook(buffer);
  return {
    documentJson: extracted,
    rowPatch: {
      amount: extracted.final_total_amount ?? extracted.base_bid_amount ?? null,
    },
    pricingItems: [],
    scopeItems: [],
    equipmentGroups: [],
    estimateSummary: extracted,
  };
}

async function storeExtractionArtifacts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  importRowId: string,
  documentId: string,
  extracted: Awaited<ReturnType<typeof extractDocument>>
) {
  if (extracted.pricingItems.length) {
    await supabase.from("opportunity_pricing_items").insert(
      extracted.pricingItems.map((item) => ({
        ...item,
        legacy_import_row_id: importRowId,
        source_document_id: documentId,
      }))
    );
  }

  if (extracted.scopeItems.length) {
    await supabase.from("opportunity_scope_items").insert(
      extracted.scopeItems.map((item) => ({
        ...item,
        legacy_import_row_id: importRowId,
        source_document_id: documentId,
      }))
    );
  }

  if (extracted.equipmentGroups.length) {
    await supabase.from("opportunity_equipment_groups").insert(
      extracted.equipmentGroups.map((item) => ({
        ...item,
        legacy_import_row_id: importRowId,
        source_document_id: documentId,
      }))
    );
  }

  if (extracted.estimateSummary) {
    await supabase.from("opportunity_estimate_summaries").insert({
      ...extracted.estimateSummary,
      legacy_import_row_id: importRowId,
      source_document_id: documentId,
    });
  }
}

async function updateImportRowFromDocument(
  supabase: Awaited<ReturnType<typeof createClient>>,
  importRowId: string,
  role: UploadRole,
  documentId: string,
  rowPatch: Partial<Record<string, string | number | null>>
) {
  const docColumn =
    role === "proposal_docx"
      ? { proposal_docx_document_id: documentId }
      : role === "proposal_pdf"
        ? { proposal_pdf_document_id: documentId }
        : { estimate_workbook_document_id: documentId };

  await supabase
    .from("legacy_opportunity_import_rows")
    .update({
      ...docColumn,
      ...rowPatch,
    })
    .eq("id", importRowId);
}

function guessContentType(ext: string) {
  switch (ext) {
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".pdf":
      return "application/pdf";
    case ".xlsm":
      return "application/vnd.ms-excel.sheet.macroEnabled.12";
    default:
      return "application/octet-stream";
  }
}

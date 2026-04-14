import { NextResponse } from "next/server";
import {
  parseUploadFiles,
  requireAdminWithMicrosoft,
  uploadLegacyImportDocuments,
} from "@/lib/opportunity-import-server";

export async function POST(request: Request) {
  const auth = await requireAdminWithMicrosoft();
  if ("error" in auth) return auth.error;

  try {
    const formData = await request.formData();
    const importRowId = formData.get("importRowId");

    if (typeof importRowId !== "string" || !importRowId.trim()) {
      return NextResponse.json({ error: "importRowId is required." }, { status: 400 });
    }

    const files = parseUploadFiles(formData);
    const upload = await uploadLegacyImportDocuments({
      supabase: auth.supabase,
      providerToken: auth.providerToken,
      userId: auth.user.id,
      importRowId,
      files,
    });

    return NextResponse.json({
      ok: true,
      sharepoint_folder: upload.sharepoint_folder,
      documents: upload.documents,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 }
    );
  }
}

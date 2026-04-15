import { NextResponse } from "next/server";
import { extractCompanyNameFromDocx } from "@/lib/opportunity-document-ingestion";
import {
  buildValidationIssues,
  derivePackageSourceName,
  parseUploadFiles,
  requireAdminWithMicrosoft,
  uploadLegacyImportDocuments,
} from "@/lib/opportunity-import-server";

export async function POST(request: Request) {
  let batchId: string | null = null;
  let resolvedAuth: Awaited<ReturnType<typeof requireAdminWithMicrosoft>> | null = null;

  try {
    const auth = await requireAdminWithMicrosoft();
    resolvedAuth = auth;
    if ("error" in auth) return auth.error;
    const formData = await request.formData();
    const files = parseUploadFiles(formData);

    if (Object.keys(files).length === 0) {
      return NextResponse.json(
        { error: "Upload at least one proposal or estimate file to start a legacy package." },
        { status: 400 }
      );
    }

    const sourceNameEntry = formData.get("sourceName");
    const bidToEntry = formData.get("bidTo");
    const notesEntry = formData.get("notes");
    const sourceName = derivePackageSourceName(files, typeof sourceNameEntry === "string" ? sourceNameEntry : null);
    const bidTo = typeof bidToEntry === "string" ? bidToEntry.trim() : null;
    const notes = typeof notesEntry === "string" ? notesEntry.trim() : "";

    let extractedCompanyName: string | null = null;
    const docxFile = files.proposal_docx;
    if (docxFile && !bidTo) {
      try {
        const buffer = Buffer.from(await docxFile.arrayBuffer());
        extractedCompanyName = await extractCompanyNameFromDocx(buffer);
      } catch {
        // Non-fatal - proceed without auto-extracted company name.
      }
    }

    const { data: batch, error: batchError } = await auth.supabase
      .from("legacy_opportunity_import_batches")
      .insert({
        source_name: sourceName,
        source_file_name: null,
        source_file_size_bytes: null,
        imported_by: auth.user.id,
        row_count: 1,
        notes: notes || null,
        source_metadata: {
          import_mode: "document_package",
          files: Object.fromEntries(
            Object.entries(files).map(([role, file]) => [
              role,
              {
                file_name: file?.name ?? null,
                file_size_bytes: file?.size ?? null,
              },
            ])
          ),
        },
      })
      .select("*")
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: batchError?.message ?? "Unable to create import batch." }, { status: 400 });
    }

    batchId = batch.id;

    const { data: row, error: rowError } = await auth.supabase
      .from("legacy_opportunity_import_rows")
      .insert({
        batch_id: batch.id,
        source_row_number: 1,
        raw_payload: {
          import_mode: "document_package",
          files: Object.fromEntries(
            Object.entries(files).map(([role, file]) => [
              role,
              {
                file_name: file?.name ?? null,
                file_size_bytes: file?.size ?? null,
              },
            ])
          ),
        },
        normalized_payload: {
          import_mode: "document_package",
        },
        company_name: bidTo || extractedCompanyName || null,
        validation_issues: ["Awaiting document extraction"],
        notes: notes || null,
      })
      .select("*")
      .single();

    if (rowError || !row) {
      await auth.supabase.from("legacy_opportunity_import_batches").delete().eq("id", batch.id);
      return NextResponse.json({ error: rowError?.message ?? "Unable to create import row." }, { status: 400 });
    }

    const upload = await uploadLegacyImportDocuments({
      supabase: auth.supabase,
      providerToken: auth.providerToken,
      userId: auth.user.id,
      importRowId: row.id,
      files,
    });

    const { data: updatedRow, error: updatedRowError } = await auth.supabase
      .from("legacy_opportunity_import_rows")
      .select("*")
      .eq("id", row.id)
      .single();

    if (updatedRowError || !updatedRow) {
      throw new Error(updatedRowError?.message ?? "Unable to refresh imported row.");
    }

    const validationIssues = buildValidationIssues(updatedRow);

    // Create the pursuit now that we have extracted names from the document.
    const { data: pursuit, error: pursuitError } = await auth.supabase
      .from("pursuits")
      .insert({
        project_name: updatedRow.legacy_opportunity_name ?? updatedRow.company_name ?? sourceName,
        owner_name: updatedRow.company_name ?? null,
        project_location: updatedRow.project_location ?? null,
        status: "active",
        created_by: auth.user.id,
      })
      .select("id")
      .single();

    if (pursuitError || !pursuit) {
      throw new Error(pursuitError?.message ?? "Unable to create pursuit for import row.");
    }

    const { error: finalizeError } = await auth.supabase
      .from("legacy_opportunity_import_rows")
      .update({
        pursuit_id: pursuit.id,
        normalized_payload: {
          import_mode: "document_package",
          opportunity_name: updatedRow.legacy_opportunity_name,
          company_name: updatedRow.company_name,
          proposal_date: updatedRow.proposal_date,
          amount: updatedRow.amount,
          documents_uploaded: Object.keys(files),
        },
        validation_issues: validationIssues,
      })
      .eq("id", row.id);

    if (finalizeError) {
      throw new Error(finalizeError.message);
    }

    return NextResponse.json({
      ok: true,
      batch,
      row_id: row.id,
      sharepoint_folder: upload.sharepoint_folder,
      documents: upload.documents,
    });
  } catch (error) {
    if (batchId && resolvedAuth && !("error" in resolvedAuth)) {
      await resolvedAuth.supabase.from("legacy_opportunity_import_batches").delete().eq("id", batchId);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create legacy package." },
      { status: 500 }
    );
  }
}

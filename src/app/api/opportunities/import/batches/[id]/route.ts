import { NextResponse } from "next/server";
import { deleteSharePointItem, getSharePointDriveId, getSharePointSiteId } from "@/lib/graph/client";
import { requireAdminWithMicrosoft } from "@/lib/opportunity-import-server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminWithMicrosoft();
  if ("error" in auth) return auth.error;

  const { supabase, providerToken } = auth;
  const batchId = (await params).id;

  const { data: rows } = await supabase
    .from("legacy_opportunity_import_rows")
    .select("sharepoint_item_id")
    .eq("batch_id", batchId);

  let driveId = process.env.SHAREPOINT_DRIVE_ID ?? "";
  if (!driveId) {
    try {
      const siteId = await getSharePointSiteId(providerToken);
      driveId = await getSharePointDriveId(providerToken, siteId);
    } catch {
      // Proceed without SharePoint deletion if drive resolution fails.
    }
  }

  if (driveId) {
    for (const row of rows ?? []) {
      if (row.sharepoint_item_id) {
        try {
          await deleteSharePointItem(providerToken, driveId, row.sharepoint_item_id);
        } catch {
          // Folder may not exist - continue.
        }
      }
    }
  }

  const { error } = await supabase
    .from("legacy_opportunity_import_batches")
    .delete()
    .eq("id", batchId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

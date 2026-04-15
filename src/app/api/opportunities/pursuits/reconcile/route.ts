import { NextResponse } from "next/server";
import { getSharePointDriveId, getSharePointSiteId, listSharePointFolders } from "@/lib/graph/client";
import { requireAdminWithMicrosoft } from "@/lib/opportunity-import-server";

type PursuitRow = {
  id: string;
  project_name: string | null;
  sharepoint_folder: string | null;
  sharepoint_item_id: string | null;
  bid_year: number | null;
  status: string | null;
};

export async function GET(): Promise<Response> {
  const auth = await requireAdminWithMicrosoft();
  if ("error" in auth) return auth.error;

  const { supabase, providerToken } = auth;

  const { data: pursuits, error } = await supabase
    .from("pursuits")
    .select("id, project_name, sharepoint_folder, sharepoint_item_id, bid_year, status")
    .order("project_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const siteId = await getSharePointSiteId(providerToken);
  const driveId = await getSharePointDriveId(providerToken, siteId);
  const folders = await listSharePointFolders(providerToken, driveId, "Bids");

  const spFolders = folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    path: `Bids/${folder.name}`,
  }));

  const linkedPaths = new Set(
    ((pursuits ?? []) as PursuitRow[])
      .map((pursuit) => pursuit.sharepoint_folder)
      .filter((value): value is string => Boolean(value))
  );

  const spOrphans = spFolders.filter((folder) => !linkedPaths.has(folder.path));
  const importOrphans = ((pursuits ?? []) as PursuitRow[])
    .filter((pursuit) => !pursuit.sharepoint_folder)
    .map((pursuit) => ({
      id: pursuit.id,
      project_name: pursuit.project_name,
      bid_year: pursuit.bid_year,
      status: pursuit.status,
    }));

  return NextResponse.json({
    sp_folders: spFolders,
    sp_orphans: spOrphans,
    import_orphans: importOrphans,
    linked_count: linkedPaths.size,
  });
}

export async function PATCH(request: Request): Promise<Response> {
  const auth = await requireAdminWithMicrosoft();
  if ("error" in auth) return auth.error;

  const { supabase } = auth;
  const body = await request.json().catch(() => null);

  const pursuitId = typeof body?.pursuit_id === "string" ? body.pursuit_id : "";
  const folderPath = typeof body?.folder_path === "string" ? body.folder_path : "";
  const folderItemId = typeof body?.folder_item_id === "string" ? body.folder_item_id : "";

  if (!pursuitId || !folderPath || !folderItemId) {
    return NextResponse.json(
      { error: "pursuit_id, folder_path, and folder_item_id are required." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("pursuits")
    .update({
      sharepoint_folder: folderPath,
      sharepoint_item_id: folderItemId,
    })
    .eq("id", pursuitId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

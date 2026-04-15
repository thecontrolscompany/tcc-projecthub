import { NextResponse } from "next/server";
import { requireAdminWithMicrosoft } from "@/lib/opportunity-import-server";
import {
  getSharePointDriveId,
  getSharePointFolderIdByPath,
  getSharePointSiteId,
  listSharePointChildren,
  moveSharePointItem,
} from "@/lib/graph/client";

export const maxDuration = 60;

type OrgResult = {
  pursuit_id: string;
  pursuit_name: string;
  status: "organized" | "nothing_to_move" | "no_folder" | "error";
  moved: string[];
  error?: string;
};

function classifyFile(name: string): "estimate_working" | "submitted_quote" | null {
  const lower = name.toLowerCase();
  if (
    lower.startsWith("hvac control installation proposal") &&
    (lower.endsWith(".docx") || lower.endsWith(".doc"))
  ) {
    return "estimate_working";
  }
  if (lower.startsWith("hvac control installation proposal") && lower.endsWith(".pdf")) {
    return "submitted_quote";
  }
  if (
    lower.startsWith("electrical budgeting tool") &&
    (lower.endsWith(".xlsm") || lower.endsWith(".xlsx"))
  ) {
    return "estimate_working";
  }
  return null;
}

export async function POST(request: Request) {
  const auth = await requireAdminWithMicrosoft();
  if ("error" in auth) return auth.error;

  const { supabase, providerToken } = auth;
  const body = await request.json().catch(() => null);
  const pursuitIds = Array.isArray(body?.pursuit_ids) ? (body.pursuit_ids as string[]) : null;

  const siteId = await getSharePointSiteId(providerToken);
  const driveId = await getSharePointDriveId(providerToken, siteId);

  const query = pursuitIds
    ? supabase
        .from("pursuits")
        .select("id, project_name, sharepoint_folder, sharepoint_item_id")
        .in("id", pursuitIds)
    : supabase
        .from("pursuits")
        .select("id, project_name, sharepoint_folder, sharepoint_item_id")
        .not("sharepoint_item_id", "is", null);

  const { data: pursuits, error: fetchError } = await query;
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!pursuits || pursuits.length === 0) {
    return NextResponse.json({ ok: true, organized: 0, nothing_to_move: 0, errors: 0, results: [] });
  }

  const results: OrgResult[] = [];

  for (const pursuit of pursuits) {
    if (!pursuit.sharepoint_item_id || !pursuit.sharepoint_folder) {
      results.push({
        pursuit_id: pursuit.id,
        pursuit_name: pursuit.project_name,
        status: "no_folder",
        moved: [],
      });
      continue;
    }

    try {
      const folderChildren = await listSharePointChildren(providerToken, driveId, pursuit.sharepoint_item_id);
      const archiveFolder = folderChildren.find(
        (child) => child.isFolder && child.name.toLowerCase().includes("archive")
      );

      if (!archiveFolder) {
        results.push({
          pursuit_id: pursuit.id,
          pursuit_name: pursuit.project_name,
          status: "nothing_to_move",
          moved: [],
        });
        continue;
      }

      const archiveChildren = await listSharePointChildren(providerToken, driveId, archiveFolder.id);
      let allFiles = archiveChildren
        .filter((child) => !child.isFolder)
        .map((child) => ({ id: child.id, name: child.name }));

      for (const subfolder of archiveChildren.filter((child) => child.isFolder)) {
        const subChildren = await listSharePointChildren(providerToken, driveId, subfolder.id);
        allFiles = allFiles.concat(
          subChildren.filter((child) => !child.isFolder).map((child) => ({ id: child.id, name: child.name }))
        );
      }

      let estimateWorkingId: string | null = null;
      let submittedQuoteId: string | null = null;
      const moved: string[] = [];

      for (const file of allFiles) {
        const destination = classifyFile(file.name);
        if (!destination) continue;

        if (destination === "estimate_working") {
          if (!estimateWorkingId) {
            estimateWorkingId = await getSharePointFolderIdByPath(
              providerToken,
              driveId,
              `${pursuit.sharepoint_folder}/03 Estimate Working`
            );
          }
          await moveSharePointItem(providerToken, driveId, file.id, estimateWorkingId);
          moved.push(file.name);
          continue;
        }

        if (!submittedQuoteId) {
          submittedQuoteId = await getSharePointFolderIdByPath(
            providerToken,
            driveId,
            `${pursuit.sharepoint_folder}/04 Submitted Quote`
          );
        }
        await moveSharePointItem(providerToken, driveId, file.id, submittedQuoteId);
        moved.push(file.name);
      }

      results.push({
        pursuit_id: pursuit.id,
        pursuit_name: pursuit.project_name,
        status: moved.length > 0 ? "organized" : "nothing_to_move",
        moved,
      });
    } catch (error) {
      results.push({
        pursuit_id: pursuit.id,
        pursuit_name: pursuit.project_name,
        status: "error",
        moved: [],
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const organized = results.filter((result) => result.status === "organized").length;
  const nothingToMove = results.filter((result) => result.status === "nothing_to_move").length;
  const errors = results.filter((result) => result.status === "error").length;

  return NextResponse.json({
    ok: true,
    organized,
    nothing_to_move: nothingToMove,
    errors,
    results,
  });
}

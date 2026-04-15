import { NextResponse } from "next/server";
import { requireAdminWithMicrosoft } from "@/lib/opportunity-import-server";
import {
  fetchSharePointItemContent,
  getSharePointDriveId,
  getSharePointSiteId,
  listSharePointChildren,
  listSharePointFolders,
} from "@/lib/graph/client";
import {
  extractEstimateFromWorkbook,
  extractProposalFromDocx,
  extractProposalFromPdf,
} from "@/lib/opportunity-document-ingestion";

export const maxDuration = 60;

const SKIP_NAMES = ["template", "scope", "bom", "admin", "schedule", "budget tool"];
const ARCHIVE_SUBFOLDER = "99 Archive - Legacy Files";

type EnrichResult = {
  pursuit_id: string;
  pursuit_name: string;
  status: "enriched" | "no_folder" | "no_file" | "error";
  sharepoint_folder?: string | null;
  customer_name?: string | null;
  estimated_value?: number | null;
  error?: string;
};

type PursuitStub = {
  id: string;
  project_name: string;
  owner_name: string | null;
  sharepoint_folder: string | null;
  sharepoint_item_id: string | null;
};

function normalizePursuitName(value: string) {
  return value
    .replace(/^QR-\d{4}-\d{3,4}\s*[-–]\s*/i, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function chooseArchiveFile(
  files: Array<{ id: string; name: string }>
): { id: string; name: string } | null {
  const filtered = files.filter((file) => {
    const lower = file.name.toLowerCase();
    return !SKIP_NAMES.some((token) => lower.includes(token));
  });

  return (
    filtered.find((file) => file.name.toLowerCase().endsWith(".docx")) ??
    filtered.find((file) => file.name.toLowerCase().endsWith(".pdf")) ??
    filtered.find((file) => {
      const lower = file.name.toLowerCase();
      return lower.endsWith(".xlsm") || lower.endsWith(".xlsx");
    }) ??
    null
  );
}

export async function POST(request: Request) {
  const auth = await requireAdminWithMicrosoft();
  if ("error" in auth) return auth.error;

  const { supabase, providerToken } = auth;
  const body = await request.json().catch(() => null);
  const pursuitIds =
    Array.isArray(body?.pursuit_ids) && body.pursuit_ids.every((value: unknown) => typeof value === "string")
      ? (body.pursuit_ids as string[])
      : null;

  const siteId = await getSharePointSiteId(providerToken);
  const driveId = await getSharePointDriveId(providerToken, siteId);

  const bidFolders = await listSharePointFolders(providerToken, driveId, "Bids");
  const folderMap = new Map<string, { id: string; name: string }>();
  for (const folder of bidFolders) {
    folderMap.set(normalizePursuitName(folder.name), { id: folder.id, name: folder.name });
  }

  const pursuitQuery = pursuitIds
    ? supabase
        .from("pursuits")
        .select("id, project_name, owner_name, sharepoint_folder, sharepoint_item_id")
        .in("id", pursuitIds)
    : supabase
        .from("pursuits")
        .select("id, project_name, owner_name, sharepoint_folder, sharepoint_item_id")
        .is("owner_name", null);

  const { data: pursuits, error: fetchError } = await pursuitQuery;
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const typedPursuits = (pursuits ?? []) as PursuitStub[];
  if (typedPursuits.length === 0) {
    return NextResponse.json({ ok: true, enriched: 0, no_folder: 0, no_file: 0, errors: 0, results: [] });
  }

  const results: EnrichResult[] = [];

  for (const pursuit of typedPursuits) {
    try {
      let folderPath = pursuit.sharepoint_folder;
      let folderItemId = pursuit.sharepoint_item_id;

      if (!folderPath || !folderItemId) {
        const match = folderMap.get(normalizePursuitName(pursuit.project_name ?? ""));
        if (!match) {
          results.push({
            pursuit_id: pursuit.id,
            pursuit_name: pursuit.project_name,
            status: "no_folder",
          });
          continue;
        }

        folderPath = `Bids/${match.name}`;
        folderItemId = match.id;

        await supabase
          .from("pursuits")
          .update({ sharepoint_folder: folderPath, sharepoint_item_id: folderItemId })
          .eq("id", pursuit.id);
      }

      const folderChildren = await listSharePointChildren(providerToken, driveId, folderItemId);
      const archiveFolder =
        folderChildren.find((item) => item.isFolder && item.name.toLowerCase() === ARCHIVE_SUBFOLDER.toLowerCase()) ??
        folderChildren.find((item) => item.isFolder && item.name.toLowerCase().includes("archive"));

      if (!archiveFolder) {
        results.push({
          pursuit_id: pursuit.id,
          pursuit_name: pursuit.project_name,
          status: "no_file",
          sharepoint_folder: folderPath,
        });
        continue;
      }

      const archiveChildren = await listSharePointChildren(providerToken, driveId, archiveFolder.id);
      const target = chooseArchiveFile(
        archiveChildren
          .filter((item) => !item.isFolder)
          .map((item) => ({ id: item.id, name: item.name }))
      );

      if (!target) {
        results.push({
          pursuit_id: pursuit.id,
          pursuit_name: pursuit.project_name,
          status: "no_file",
          sharepoint_folder: folderPath,
        });
        continue;
      }

      const response = await fetchSharePointItemContent(providerToken, driveId, target.id);
      if (!response.ok) {
        results.push({
          pursuit_id: pursuit.id,
          pursuit_name: pursuit.project_name,
          status: "error",
          sharepoint_folder: folderPath,
          error: `Download failed: ${response.status}`,
        });
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const lowerName = target.name.toLowerCase();

      let customerName: string | null = null;
      let projectName: string | null = null;
      let estimatedValue: number | null = null;
      let proposalDate: string | null = null;

      if (lowerName.endsWith(".docx")) {
        const extracted = await extractProposalFromDocx(buffer);
        customerName = extracted.customerName ?? null;
        projectName = extracted.projectName ?? null;
        estimatedValue = extracted.baseBidAmount ?? null;
        proposalDate = extracted.proposalDate ?? null;
      } else if (lowerName.endsWith(".pdf")) {
        const extracted = await extractProposalFromPdf(buffer);
        customerName = extracted.customerName ?? null;
        projectName = extracted.projectName ?? null;
        estimatedValue = extracted.baseBidAmount ?? null;
        proposalDate = extracted.proposalDate ?? null;
      } else {
        const extracted = await extractEstimateFromWorkbook(buffer);
        estimatedValue = extracted.base_bid_amount ?? extracted.final_total_amount ?? null;
      }

      const pursuitPatch: Record<string, unknown> = {};
      if (folderPath && !pursuit.sharepoint_folder) pursuitPatch.sharepoint_folder = folderPath;
      if (folderItemId && !pursuit.sharepoint_item_id) pursuitPatch.sharepoint_item_id = folderItemId;
      if (customerName) pursuitPatch.owner_name = customerName;
      if (projectName) pursuitPatch.project_name = projectName;

      if (Object.keys(pursuitPatch).length > 0) {
        await supabase.from("pursuits").update(pursuitPatch).eq("id", pursuit.id);
      }

      const quotePatch: Record<string, unknown> = {};
      if (customerName) quotePatch.company_name = customerName;
      if (projectName) {
        quotePatch.project_name = projectName;
        quotePatch.project_description = projectName;
      }
      if (estimatedValue !== null) quotePatch.estimated_value = estimatedValue;
      if (proposalDate) quotePatch.proposal_date = proposalDate;

      if (Object.keys(quotePatch).length > 0) {
        await supabase.from("quote_requests").update(quotePatch).eq("pursuit_id", pursuit.id);
      }

      results.push({
        pursuit_id: pursuit.id,
        pursuit_name: pursuit.project_name,
        status: "enriched",
        sharepoint_folder: folderPath,
        customer_name: customerName,
        estimated_value: estimatedValue,
      });
    } catch (error) {
      results.push({
        pursuit_id: pursuit.id,
        pursuit_name: pursuit.project_name,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const enriched = results.filter((result) => result.status === "enriched").length;
  const no_folder = results.filter((result) => result.status === "no_folder").length;
  const no_file = results.filter((result) => result.status === "no_file").length;
  const errors = results.filter((result) => result.status === "error").length;

  return NextResponse.json({ ok: true, enriched, no_folder, no_file, errors, results });
}

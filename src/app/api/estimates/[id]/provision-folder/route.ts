import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { canWriteEstimates } from "@/lib/estimates/api";
import {
  createSharePointFolder,
  getSharePointDriveId,
  getSharePointFolderIdByPath,
  getSharePointSiteId,
} from "@/lib/graph/client";

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

const ESTIMATE_SUBFOLDERS = [
  "01 Customer Uploads",
  "02 Internal Review",
  "03 Estimate Working",
  "04 Submitted Quote",
  "99 Archive - Legacy Files",
];

function sanitizeFolderSegment(value: string) {
  return String(value || "")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildEstimateFolderName(
  estimate: { number: string | null; name: string; customer: string; bidder?: string | null },
  estimateId: string,
) {
  const estimateNumber = sanitizeFolderSegment(estimate.number || "").replace(/^EST-/i, "");
  const estimateLabel = estimateNumber ? `EST-${estimateNumber}` : `EST-${estimateId.slice(0, 8).toUpperCase()}`;
  const projectName = sanitizeFolderSegment(estimate.name || "Untitled Estimate");
  const bidder = sanitizeFolderSegment(estimate.bidder || "");

  if (bidder) {
    return `${[estimateLabel, projectName].filter(Boolean).join(" - ")}/${bidder}`;
  }

  return [estimateLabel, projectName].filter(Boolean).join(" - ");
}

async function ensureSharePointFolderPath(providerToken: string, driveId: string, folderPath: string) {
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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!canWriteEstimates(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("id, number, name, body, linked_project_id")
    .eq("id", id)
    .single();

  if (estimateError || !estimate) {
    return NextResponse.json({ error: estimateError?.message || "Estimate not found." }, { status: 404 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const providerToken = session?.provider_token;
  if (!providerToken) {
    return NextResponse.json(
      { error: "Microsoft access token not available. Please sign out and sign in again." },
      { status: 400 },
    );
  }

  const customer = typeof estimate.body?.customer === "string" ? estimate.body.customer : "";
  const bidder = typeof estimate.body?.bidder === "string" ? estimate.body.bidder : "";

  const siteId = await getSharePointSiteId(providerToken);
  const driveId = await getSharePointDriveId(providerToken, siteId);

  let sharepointFolder: string;
  let folderItemId: string;

  // Resolve linked project for folder placement
  let linkedProject: { sharepoint_folder: string | null; name: string } | null = null;
  if (estimate.linked_project_id) {
    const { data } = await supabase
      .from("projects")
      .select("id, name, sharepoint_folder")
      .eq("id", estimate.linked_project_id)
      .maybeSingle();
    linkedProject = data ?? null;
  }

  if (linkedProject) {
    const projectRoot =
      typeof linkedProject.sharepoint_folder === "string" && linkedProject.sharepoint_folder.trim()
        ? linkedProject.sharepoint_folder.trim()
        : `Active Projects/${sanitizeFolderSegment(linkedProject.name || "Untitled Project")}`;
    const estimateRoot = `${projectRoot}/02 Estimate`;

    await ensureSharePointFolderPath(providerToken, driveId, projectRoot);
    for (const subfolder of PROJECT_SUBFOLDERS) {
      try {
        await createSharePointFolder(providerToken, driveId, projectRoot, subfolder);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("409")) throw error;
      }
    }

    folderItemId = await ensureSharePointFolderPath(providerToken, driveId, estimateRoot);
    for (const subfolder of ESTIMATE_SUBFOLDERS) {
      try {
        await createSharePointFolder(providerToken, driveId, estimateRoot, subfolder);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("409")) throw error;
      }
    }
    sharepointFolder = estimateRoot;
  } else {
    const folderName = buildEstimateFolderName(
      { number: estimate.number, name: estimate.name, customer, bidder },
      id,
    );
    const folderPath = `Bids/${folderName}`;
    const hasBidder = Boolean(bidder);

    await ensureSharePointFolderPath(providerToken, driveId, "Bids");

    if (hasBidder) {
      folderItemId = await ensureSharePointFolderPath(providerToken, driveId, folderPath);
      for (const subfolder of ESTIMATE_SUBFOLDERS) {
        try {
          await createSharePointFolder(providerToken, driveId, folderPath, subfolder);
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes("409")) throw error;
        }
      }
      sharepointFolder = folderPath;
    } else {
      await ensureSharePointFolderPath(providerToken, driveId, folderPath);
      for (const subfolder of PROJECT_SUBFOLDERS) {
        try {
          await createSharePointFolder(providerToken, driveId, folderPath, subfolder);
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes("409")) throw error;
        }
      }
      const estimateRoot = `${folderPath}/02 Estimate`;
      folderItemId = await ensureSharePointFolderPath(providerToken, driveId, estimateRoot);
      for (const subfolder of ESTIMATE_SUBFOLDERS) {
        try {
          await createSharePointFolder(providerToken, driveId, estimateRoot, subfolder);
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes("409")) throw error;
        }
      }
      sharepointFolder = estimateRoot;
    }
  }

  const updatedBody = {
    ...(estimate.body as Record<string, unknown>),
    sharepointFolder,
    sharepointItemId: folderItemId,
  };

  const { error: updateError } = await supabase
    .from("estimates")
    .update({ body: updatedBody, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ sharepointFolder, ok: true });
}

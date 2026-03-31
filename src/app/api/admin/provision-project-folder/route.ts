import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.provider_token) {
    return NextResponse.json({
      ok: false,
      error: "Microsoft access token not available. Please sign back in with Microsoft.",
    });
  }

  const { projectId, jobNumber, projectName } = await request.json() as {
    projectId?: string;
    jobNumber?: string;
    projectName?: string;
  };

  if (!projectId || !jobNumber || !projectName) {
    return NextResponse.json({ ok: false, error: "projectId, jobNumber, and projectName are required." }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const siteId = await getSharePointSiteId(session.provider_token);
    const driveId = await getSharePointDriveId(session.provider_token, siteId);
    const folderName = `${jobNumber} - ${projectName}`;

    let topLevelFolderId = "";
    try {
      topLevelFolderId = await createSharePointFolder(session.provider_token, driveId, "Active Projects", folderName);
    } catch (error) {
      if (error instanceof Error && error.message.includes("409")) {
        topLevelFolderId = await getSharePointFolderIdByPath(
          session.provider_token,
          driveId,
          `Active Projects/${folderName}`
        );
      } else {
        throw error;
      }
    }

    for (const subfolder of PROJECT_SUBFOLDERS) {
      try {
        await createSharePointFolder(session.provider_token, driveId, `Active Projects/${folderName}`, subfolder);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("409")) {
          throw error;
        }
      }
    }

    await adminClient
      .from("projects")
      .update({
        sharepoint_folder: `Active Projects/${folderName}`,
        sharepoint_item_id: topLevelFolderId,
      })
      .eq("id", projectId);

    return NextResponse.json({ ok: true, sharepoint_folder: `Active Projects/${folderName}` });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "SharePoint provisioning failed.",
    });
  }
}

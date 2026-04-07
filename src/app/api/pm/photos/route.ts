import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import {
  getSharePointSiteId,
  getSharePointDriveId,
  uploadFileToSharePointDrive,
} from "@/lib/graph/client";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function verifyProjectAccess(projectId: string, userId: string, role: string) {
  if (role === "admin" || role === "ops_manager") return true;
  const admin = adminClient();
  const { data: pmRows } = await admin.from("pm_directory").select("id").eq("profile_id", userId);
  const pmDirIds = (pmRows ?? []).map((r: { id: string }) => r.id);
  const { data: direct } = await admin
    .from("project_assignments").select("id")
    .eq("project_id", projectId).eq("profile_id", userId).limit(1);
  if ((direct ?? []).length > 0) return true;
  if (pmDirIds.length > 0) {
    const { data: dir } = await admin
      .from("project_assignments").select("id")
      .eq("project_id", projectId).in("pm_directory_id", pmDirIds).limit(1);
    if ((dir ?? []).length > 0) return true;
  }
  return false;
}

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const resolvedProfile = await resolveUserRole(user);
  const role = resolvedProfile?.role ?? "customer";
  if (!["admin", "ops_manager", "pm", "lead"].includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "Missing projectId." }, { status: 400 });

  const hasAccess = await verifyProjectAccess(projectId, user.id, role);
  if (!hasAccess) return NextResponse.json({ error: "Not assigned to this project." }, { status: 403 });

  const { data, error } = await adminClient()
    .from("project_photos")
    .select("id, caption, filename, content_type, sharepoint_web_url, taken_date, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ photos: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const resolvedProfile = await resolveUserRole(user);
  const role = resolvedProfile?.role ?? "customer";
  if (!["admin", "ops_manager", "pm", "lead"].includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const providerToken = sessionData.session?.provider_token;
  if (!providerToken) {
    return NextResponse.json(
      { error: "Microsoft sign-in required to upload photos. Please sign out and sign back in." },
      { status: 401 }
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data." }, { status: 400 });

  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string | null;
  const caption = (formData.get("caption") as string | null)?.trim() || null;
  const takenDate = (formData.get("takenDate") as string | null) || null;

  if (!file || !projectId) {
    return NextResponse.json({ error: "Missing file or projectId." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are supported." }, { status: 400 });
  }

  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 20 MB per photo)." }, { status: 400 });
  }

  const hasAccess = await verifyProjectAccess(projectId, user.id, role);
  if (!hasAccess) return NextResponse.json({ error: "Not assigned to this project." }, { status: 403 });

  const admin = adminClient();
  const { data: project } = await admin
    .from("projects")
    .select("sharepoint_folder, name")
    .eq("id", projectId)
    .single();

  if (!project?.sharepoint_folder) {
    return NextResponse.json(
      { error: "This project has no SharePoint folder configured. Contact admin." },
      { status: 400 }
    );
  }

  const siteId = await getSharePointSiteId(providerToken);
  const driveId = await getSharePointDriveId(providerToken, siteId);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safeOriginal = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  const uniqueFilename = `${timestamp}-${safeOriginal}`;

  const folderPath = `${project.sharepoint_folder}/Site Photos`;
  const fileBuffer = await file.arrayBuffer();

  const { id: itemId, webUrl } = await uploadFileToSharePointDrive(
    providerToken,
    driveId,
    folderPath,
    uniqueFilename,
    fileBuffer,
    file.type
  );

  const { data: photo, error: insertError } = await admin
    .from("project_photos")
    .insert({
      project_id: projectId,
      caption,
      filename: file.name,
      content_type: file.type,
      sharepoint_item_id: itemId,
      sharepoint_drive_id: driveId,
      sharepoint_web_url: webUrl,
      taken_date: takenDate || null,
      uploaded_by_profile_id: user.id,
    })
    .select("id, caption, filename, content_type, sharepoint_web_url, taken_date, created_at")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ photo });
}

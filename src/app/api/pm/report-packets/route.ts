import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import {
  getSharePointDriveId,
  getSharePointSiteId,
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
  const { data: direct } = await admin
    .from("project_assignments")
    .select("id")
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .limit(1);
  return (direct ?? []).length > 0;
}

type ReportPacketBody = {
  reportDate?: string;
  [key: string]: unknown;
};

type SaveBody = {
  projectId?: string;
  reportType?: string;
  packetDate?: string;
  title?: string;
  body?: ReportPacketBody;
  markdown?: string;
};

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
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
  const reportType = searchParams.get("reportType");
  if (!projectId || !reportType) {
    return NextResponse.json({ error: "Missing projectId or reportType." }, { status: 400 });
  }

  const hasAccess = await verifyProjectAccess(projectId, user.id, role);
  if (!hasAccess) return NextResponse.json({ error: "Not assigned to this project." }, { status: 403 });

  const { data, error } = await adminClient()
    .from("project_report_packets")
    .select("id, packet_date, updated_at, body, sharepoint_web_url")
    .eq("project_id", projectId)
    .eq("report_type", reportType)
    .order("packet_date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ packet: data ?? null });
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

  const body = (await request.json().catch(() => null)) as SaveBody | null;
  if (!body?.projectId || !body?.reportType || !body?.packetDate || !body?.title || !body?.body || !body?.markdown) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const hasAccess = await verifyProjectAccess(body.projectId, user.id, role);
  if (!hasAccess) return NextResponse.json({ error: "Not assigned to this project." }, { status: 403 });

  const admin = adminClient();
  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("name, sharepoint_folder")
    .eq("id", body.projectId)
    .single();

  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 400 });

  const { data: existingPacket } = await admin
    .from("project_report_packets")
    .select("sharepoint_item_id, sharepoint_drive_id, sharepoint_web_url")
    .eq("project_id", body.projectId)
    .eq("report_type", body.reportType)
    .eq("packet_date", body.packetDate)
    .maybeSingle();

  let sharepointItemId: string | null = existingPacket?.sharepoint_item_id ?? null;
  let sharepointDriveId: string | null = existingPacket?.sharepoint_drive_id ?? null;
  let sharepointWebUrl: string | null = existingPacket?.sharepoint_web_url ?? null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const providerToken = session?.provider_token;

  if (providerToken && project?.sharepoint_folder) {
    try {
      const siteId = await getSharePointSiteId(providerToken);
      const driveId = await getSharePointDriveId(providerToken, siteId);
      const filename = sanitizeFilename(`${project.name} - Eglin 1416 Report Packet - ${body.packetDate}.md`);
      const upload = await uploadFileToSharePointDrive(
        providerToken,
        driveId,
        project.sharepoint_folder,
        filename,
        new TextEncoder().encode(body.markdown).buffer,
        "text/markdown; charset=utf-8"
      );
      sharepointItemId = upload.id;
      sharepointDriveId = driveId;
      sharepointWebUrl = upload.webUrl;
    } catch (error) {
      console.error("[report-packets] SharePoint upload failed:", error);
    }
  }

  const row = {
    project_id: body.projectId,
    report_type: body.reportType,
    packet_date: body.packetDate,
    title: body.title,
    body: body.body,
    summary_markdown: body.markdown,
    sharepoint_item_id: sharepointItemId,
    sharepoint_drive_id: sharepointDriveId,
    sharepoint_web_url: sharepointWebUrl,
    created_by_profile_id: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("project_report_packets")
    .upsert(row, { onConflict: "project_id,report_type,packet_date" })
    .select("id, packet_date, updated_at, body, sharepoint_web_url")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ packet: data });
}

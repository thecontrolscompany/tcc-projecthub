import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { graphFetch } from "@/lib/graph/client";

const AZURE_TENANT_ID = "7eec7a09-a47b-4bf1-a877-80fd5323c774";
const AZURE_CLIENT_ID = "0777b14d-29c4-4186-8d8e-4a8f43de6589";
const TOKEN_URL = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`;

const DOCUMENT_TYPE_FOLDERS = {
  contract: "01 Contract",
  scope: "01 Contract",
  estimate: "02 Estimate",
} as const;

type DocumentType = keyof typeof DOCUMENT_TYPE_FOLDERS;

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  return { supabase };
}

async function getAppToken() {
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!clientSecret) {
    throw new Error("AZURE_CLIENT_SECRET is not configured.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: AZURE_CLIENT_ID,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "Failed to acquire Microsoft app token.");
  }

  const data = await res.json();
  if (typeof data?.access_token !== "string" || !data.access_token) {
    throw new Error("Microsoft token endpoint did not return an access token.");
  }

  return data.access_token as string;
}

function isDocumentType(value: string): value is DocumentType {
  return value in DOCUMENT_TYPE_FOLDERS;
}

function encodeGraphPath(...segments: string[]) {
  return segments
    .flatMap((segment) => segment.split("/"))
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const formData = await request.formData();
    const projectId = formData.get("projectId");
    const documentType = formData.get("documentType");
    const file = formData.get("file");

    if (typeof projectId !== "string" || !projectId.trim()) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    if (typeof documentType !== "string" || !isDocumentType(documentType)) {
      return NextResponse.json({ error: "documentType must be one of contract, scope, estimate." }, { status: 400 });
    }

    if (!(file instanceof File) || !file.name) {
      return NextResponse.json({ error: "A file is required." }, { status: 400 });
    }

    const siteId = process.env.SHAREPOINT_SITE_ID;
    const driveId = process.env.SHAREPOINT_DRIVE_ID;

    if (!siteId || !driveId) {
      return NextResponse.json(
        { error: "SHAREPOINT_SITE_ID and SHAREPOINT_DRIVE_ID must be configured." },
        { status: 500 }
      );
    }

    const { data: project, error: projectError } = await auth.supabase
      .from("projects")
      .select("sharepoint_folder")
      .eq("id", projectId)
      .single();

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 400 });
    }

    if (!project?.sharepoint_folder) {
      return NextResponse.json(
        { error: "SharePoint folder not yet provisioned for this project" },
        { status: 400 }
      );
    }

    const accessToken = await getAppToken();
    const subfolder = DOCUMENT_TYPE_FOLDERS[documentType];
    const encodedPath = encodeGraphPath(project.sharepoint_folder, subfolder, file.name);
    const uploadPath = `/sites/${siteId}/drives/${driveId}/root:/${encodedPath}:/content`;

    const uploadRes = await graphFetch(uploadPath, accessToken, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: Buffer.from(await file.arrayBuffer()),
    });

    if (!uploadRes.ok) {
      const message = await uploadRes.text();
      return NextResponse.json(
        { error: message || "SharePoint upload failed." },
        { status: uploadRes.status }
      );
    }

    const data = await uploadRes.json();
    return NextResponse.json({ ok: true, webUrl: data?.webUrl ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 }
    );
  }
}

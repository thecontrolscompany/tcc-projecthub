import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import {
  createSharePointFolder,
  getSharePointDriveId,
  getSharePointFolderIdByPath,
  getSharePointSiteId,
} from "@/lib/graph/client";
import {
  ESTIMATE_SELECT,
  canReadEstimates,
  canWriteEstimates,
  deriveEstimateLifecycleFields,
  estimateCreateSchema,
} from "@/lib/estimates/api";

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
    // Parent folder named after project only; bidder is a subfolder
    return `${[estimateLabel, projectName].filter(Boolean).join(" - ")}/${bidder}`;
  }

  return [estimateLabel, projectName].filter(Boolean).join(" - ");
}

async function ensureSharePointFolderPath(
  providerToken: string,
  driveId: string,
  folderPath: string,
) {
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

async function resolveEstimateProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  estimate: { id: string; linked_project_id: string | null },
) {
  if (estimate.linked_project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, job_number, sharepoint_folder, sharepoint_item_id, source_estimate_id")
      .eq("id", estimate.linked_project_id)
      .maybeSingle();
    if (project) return project;
  }

  const { data: sourceProject } = await supabase
    .from("projects")
    .select("id, name, job_number, sharepoint_folder, sharepoint_item_id, source_estimate_id")
    .eq("source_estimate_id", estimate.id)
    .maybeSingle();
  return sourceProject ?? null;
}

async function provisionEstimateFolder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  estimate: { id: string; number: string | null; name: string; customer: string; bidder?: string | null; linked_project_id: string | null },
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const providerToken = session?.provider_token;
  if (!providerToken) {
    return { sharepointFolder: null as string | null, sharepointItemId: null as string | null, warning: "Microsoft access token not available." };
  }

  const siteId = await getSharePointSiteId(providerToken);
  const driveId = await getSharePointDriveId(providerToken, siteId);
  const project = await resolveEstimateProject(supabase, estimate);

  if (project) {
    const projectRoot =
      typeof project.sharepoint_folder === "string" && project.sharepoint_folder.trim()
        ? project.sharepoint_folder.trim()
        : `Active Projects/${sanitizeFolderSegment(project.name || "Untitled Project")}`;
    const estimateRoot = `${projectRoot}/02 Estimate`;

    await ensureSharePointFolderPath(providerToken, driveId, projectRoot);
    for (const subfolder of PROJECT_SUBFOLDERS) {
      try {
        await createSharePointFolder(providerToken, driveId, projectRoot, subfolder);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("409")) {
          throw error;
        }
      }
    }

    const folderItemId = await ensureSharePointFolderPath(providerToken, driveId, estimateRoot);
    return { sharepointFolder: estimateRoot, sharepointItemId: folderItemId, warning: null as string | null };
  }

  const folderName = buildEstimateFolderName(estimate, estimate.id);
  const folderPath = `Bids/${folderName}`;
  const hasBidder = Boolean(estimate.bidder);

  await ensureSharePointFolderPath(providerToken, driveId, "Bids");

  if (hasBidder) {
    const folderItemId = await ensureSharePointFolderPath(providerToken, driveId, folderPath);
    return { sharepointFolder: folderPath, sharepointItemId: folderItemId, warning: null as string | null };
  }

  // Standalone bids get the full project folder structure; estimate documents land in 02 Estimate.
  await ensureSharePointFolderPath(providerToken, driveId, folderPath);
  for (const subfolder of PROJECT_SUBFOLDERS) {
    try {
      await createSharePointFolder(providerToken, driveId, folderPath, subfolder);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("409")) throw error;
    }
  }
  const estimateRoot = `${folderPath}/02 Estimate`;
  const folderItemId = await ensureSharePointFolderPath(providerToken, driveId, estimateRoot);
  return { sharepointFolder: estimateRoot, sharepointItemId: folderItemId, warning: null as string | null };
}

async function resolveOrganizationId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  options: {
    explicitOrganizationId?: string | null;
    linkedOpportunityId?: string | null;
    userId: string;
  },
) {
  if (options.explicitOrganizationId) return options.explicitOrganizationId;

  if (options.linkedOpportunityId) {
    const { data: opportunity } = await supabase
      .from("crm_opportunities")
      .select("organization_id")
      .eq("id", options.linkedOpportunityId)
      .maybeSingle();

    if (opportunity?.organization_id) return opportunity.organization_id as string;
  }

  const { data: defaultOrgId } = await supabase.rpc("current_user_default_organization_id");
  if (typeof defaultOrgId === "string") return defaultOrgId;

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("profile_id", options.userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership?.organization_id) return membership.organization_id as string;

  const { data: tccOrganization } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "tcc")
    .maybeSingle();

  return typeof tccOrganization?.id === "string" ? tccOrganization.id : null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!canReadEstimates(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = await resolveOrganizationId(supabase, {
    explicitOrganizationId: searchParams.get("organization_id"),
    linkedOpportunityId: searchParams.get("opportunity_id"),
    userId: user.id,
  });
  if (!organizationId) return NextResponse.json({ error: "No organization selected." }, { status: 400 });

  let query = supabase
    .from("estimates")
    .select(ESTIMATE_SELECT)
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  const opportunityId = searchParams.get("opportunity_id");
  const projectId = searchParams.get("project_id");
  const status = searchParams.get("status");
  const includeArchived = searchParams.get("include_archived") === "true";

  if (opportunityId) query = query.eq("linked_opportunity_id", opportunityId);
  if (projectId) query = query.eq("linked_project_id", projectId);
  if (status) query = query.eq("status", status);
  if (!includeArchived) query = query.eq("archived", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ estimates: data ?? [] });
}

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const parsed = estimateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const organizationId = await resolveOrganizationId(supabase, {
    explicitOrganizationId: parsed.data.organization_id,
    linkedOpportunityId: parsed.data.linked_opportunity_id,
    userId: user.id,
  });
  if (!organizationId) return NextResponse.json({ error: "No organization selected." }, { status: 400 });

  const estimateId = parsed.data.id ?? crypto.randomUUID();
  const lifecycleFields = deriveEstimateLifecycleFields(parsed.data);
  const payload = {
    ...parsed.data,
    ...lifecycleFields,
    id: estimateId,
    organization_id: organizationId,
    owner_id: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("estimates")
    .insert(payload)
    .select(ESTIMATE_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let provisionWarning: string | null = null;
  try {
    const folderInfo = await provisionEstimateFolder(supabase, {
      id: data.id,
      number: data.number,
      name: data.name,
      customer: typeof data.body?.customer === "string" ? data.body.customer : "",
      bidder: typeof data.body?.bidder === "string" ? data.body.bidder : "",
      linked_project_id: data.linked_project_id ?? null,
    });

    if (folderInfo.sharepointFolder) {
      const updatedBody = {
        ...(data.body as Record<string, unknown>),
        sharepointFolder: folderInfo.sharepointFolder,
        sharepointItemId: folderInfo.sharepointItemId,
      };

      const { data: updatedEstimate, error: updateError } = await supabase
        .from("estimates")
        .update({ body: updatedBody })
        .eq("id", data.id)
        .select(ESTIMATE_SELECT)
        .single();

      if (!updateError && updatedEstimate) {
        return NextResponse.json({ estimate: updatedEstimate, sharepointFolder: folderInfo.sharepointFolder }, { status: 201 });
      }
    }

    provisionWarning = folderInfo.warning;
  } catch (provisionError) {
    provisionWarning = provisionError instanceof Error ? provisionError.message : "SharePoint provisioning failed.";
  }

  return NextResponse.json({ estimate: data, sharepointWarning: provisionWarning }, { status: 201 });
}

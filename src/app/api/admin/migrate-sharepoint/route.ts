import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  type OneDriveItem,
  getSharePointSiteId,
  getSharePointDriveId,
  getSharePointFolderIdByPath,
  listOneDriveFolders,
  createSharePointFolder,
  copyOneDriveItemToSharePoint,
} from "@/lib/graph/client";

type Classification = "active" | "completed" | "bid";

interface MigrationCandidate {
  sourceId: string;
  sourcePath: string;
  originalName: string;
  classification: Classification;
  proposedJobNumber: string;
  proposedName: string;
  targetLibrary: "Active Projects" | "Completed Projects" | "Bids";
  createdDateTime: string;
}

interface DiscoveredFolder {
  item: OneDriveItem;
  sourcePath: string;
  classification: Classification;
  targetLibrary: MigrationCandidate["targetLibrary"];
  numberingYear: number;
}

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

const BID_SUBFOLDERS = [
  "01 Customer Uploads",
  "02 Internal Review",
  "03 Estimate Working",
  "04 Submitted Quote",
  "99 Archive - Legacy Files",
];

function startsWithUnderscore(name: string) {
  return name.startsWith("_");
}

function isYearBidFolder(name: string) {
  return /^_20\d{2}\s+Bids$/.test(name);
}

function getBidYearFromFolderName(name: string) {
  const match = name.match(/^_(20\d{2})\s+Bids$/);
  return match ? Number(match[1]) : null;
}

function formatSequence(index: number) {
  return String(index).padStart(3, "0");
}

async function requireAdminWithToken() {
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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.provider_token) {
    return {
      error: NextResponse.json(
        {
          error:
            "Microsoft access token not available. Please sign out and sign back in with Microsoft to enable SharePoint migration.",
        },
        { status: 400 }
      ),
    };
  }

  return { providerToken: session.provider_token };
}

async function safeList(providerToken: string, path: string) {
  try {
    return await listOneDriveFolders(providerToken, path);
  } catch {
    return [] as OneDriveItem[];
  }
}

async function discoverCandidates(providerToken: string) {
  const topLevelProjects = (await safeList(providerToken, "Projects")).filter((item) => !startsWithUnderscore(item.name));
  const completedProjects = (await safeList(providerToken, "Projects/_Archive/_Completed")).filter((item) => !startsWithUnderscore(item.name));
  const archiveFolders = await safeList(providerToken, "Projects/_Archive");

  const currentYearBids = archiveFolders.filter(
    (item) => !startsWithUnderscore(item.name) && !isYearBidFolder(item.name)
  );
  const bidYearFolders = archiveFolders.filter((item) => isYearBidFolder(item.name));

  const discovered: DiscoveredFolder[] = [
    ...topLevelProjects.map((item) => ({
      item,
      sourcePath: `Projects/${item.name}`,
      classification: "active" as const,
      targetLibrary: "Active Projects" as const,
      numberingYear: new Date(item.createdDateTime).getFullYear(),
    })),
    ...completedProjects.map((item) => ({
      item,
      sourcePath: `Projects/_Archive/_Completed/${item.name}`,
      classification: "completed" as const,
      targetLibrary: "Completed Projects" as const,
      numberingYear: new Date(item.createdDateTime).getFullYear(),
    })),
    ...currentYearBids.map((item) => ({
      item,
      sourcePath: `Projects/_Archive/${item.name}`,
      classification: "bid" as const,
      targetLibrary: "Bids" as const,
      numberingYear: new Date().getFullYear(),
    })),
  ];

  for (const bidFolder of bidYearFolders) {
    const children = (await safeList(providerToken, `Projects/_Archive/${bidFolder.name}`)).filter(
      (item) => !startsWithUnderscore(item.name)
    );
    const year = getBidYearFromFolderName(bidFolder.name) ?? new Date().getFullYear();

    for (const item of children) {
      discovered.push({
        item,
        sourcePath: `Projects/_Archive/${bidFolder.name}/${item.name}`,
        classification: "bid",
        targetLibrary: "Bids",
        numberingYear: year,
      });
    }
  }

  const projectBuckets = new Map<number, DiscoveredFolder[]>();
  const bidBuckets = new Map<number, DiscoveredFolder[]>();

  for (const entry of discovered) {
    const bucket = entry.classification === "bid" ? bidBuckets : projectBuckets;
    const current = bucket.get(entry.numberingYear) ?? [];
    current.push(entry);
    bucket.set(entry.numberingYear, current);
  }

  const candidates: MigrationCandidate[] = [];

  for (const year of [...projectBuckets.keys()].sort((a, b) => a - b)) {
    const items = (projectBuckets.get(year) ?? []).sort((a, b) =>
      a.item.createdDateTime.localeCompare(b.item.createdDateTime)
    );

    items.forEach((entry, index) => {
      const proposedJobNumber = `${year}-${formatSequence(index + 1)}`;
      candidates.push({
        sourceId: entry.item.id,
        sourcePath: entry.sourcePath,
        originalName: entry.item.name,
        classification: entry.classification,
        proposedJobNumber,
        proposedName: `${proposedJobNumber} - ${entry.item.name}`,
        targetLibrary: entry.targetLibrary,
        createdDateTime: entry.item.createdDateTime,
      });
    });
  }

  for (const year of [...bidBuckets.keys()].sort((a, b) => a - b)) {
    const items = (bidBuckets.get(year) ?? []).sort((a, b) =>
      a.item.createdDateTime.localeCompare(b.item.createdDateTime)
    );

    items.forEach((entry, index) => {
      const proposedJobNumber = `QR-${year}-${formatSequence(index + 1)}`;
      candidates.push({
        sourceId: entry.item.id,
        sourcePath: entry.sourcePath,
        originalName: entry.item.name,
        classification: entry.classification,
        proposedJobNumber,
        proposedName: `${proposedJobNumber} - ${entry.item.name}`,
        targetLibrary: entry.targetLibrary,
        createdDateTime: entry.item.createdDateTime,
      });
    });
  }

  candidates.sort((a, b) => a.createdDateTime.localeCompare(b.createdDateTime));

  return candidates;
}

export async function GET() {
  const auth = await requireAdminWithToken();
  if ("error" in auth) return auth.error;

  try {
    const siteId = await getSharePointSiteId(auth.providerToken);
    const driveId = await getSharePointDriveId(auth.providerToken, siteId);
    const candidates = await discoverCandidates(auth.providerToken);

    return NextResponse.json({ siteId, driveId, candidates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Discovery failed." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminWithToken();
  if ("error" in auth) return auth.error;

  const {
    candidates,
    siteId,
    driveId,
    offset = 0,
    batchSize = 25,
  } = await request.json() as {
    candidates: MigrationCandidate[];
    siteId: string;
    driveId: string;
    offset?: number;
    batchSize?: number;
  };

  if (!Array.isArray(candidates) || !siteId || !driveId) {
    return NextResponse.json({ error: "candidates, siteId, and driveId are required." }, { status: 400 });
  }

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const result = {
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
    nextOffset: Math.min(offset + batchSize, candidates.length),
    total: candidates.length,
  };

  const batch = candidates.slice(offset, offset + batchSize);

  for (const candidate of batch) {
    try {
      const { data: existing } = await adminClient
        .from("projects")
        .select("id")
        .eq("job_number", candidate.proposedJobNumber)
        .maybeSingle();

      if (existing) {
        result.skipped += 1;
        continue;
      }

      let topLevelFolderId: string;
      try {
        topLevelFolderId = await createSharePointFolder(
          auth.providerToken,
          driveId,
          candidate.targetLibrary,
          candidate.proposedName
        );
      } catch (e) {
        if (e instanceof Error && e.message.includes("409")) {
          topLevelFolderId = await getSharePointFolderIdByPath(
            auth.providerToken,
            driveId,
            `${candidate.targetLibrary}/${candidate.proposedName}`
          );
        } else {
          throw e;
        }
      }

      const subfolders = candidate.classification === "bid" ? BID_SUBFOLDERS : PROJECT_SUBFOLDERS;
      for (const subfolder of subfolders) {
        try {
          await createSharePointFolder(
            auth.providerToken,
            driveId,
            `${candidate.targetLibrary}/${candidate.proposedName}`,
            subfolder
          );
        } catch (e) {
          if (!(e instanceof Error) || !e.message.includes("409")) {
            throw e;
          }
        }
      }

      let archiveFolderId = "";
      try {
        archiveFolderId = await getSharePointFolderIdByPath(
          auth.providerToken,
          driveId,
          `${candidate.targetLibrary}/${candidate.proposedName}/99 Archive - Legacy Files`
        );
      } catch {
        archiveFolderId = "";
      }

      if (archiveFolderId) {
        try {
          await copyOneDriveItemToSharePoint(
            auth.providerToken,
            candidate.sourceId,
            driveId,
            archiveFolderId,
            candidate.originalName
          );
        } catch {
          // Copy queued or failed - non-fatal, folder structure is already created
        }
      }

      await adminClient.from("projects").insert({
        name: candidate.proposedName,
        sharepoint_folder: `${candidate.targetLibrary}/${candidate.proposedName}`,
        sharepoint_item_id: topLevelFolderId,
        job_number: candidate.proposedJobNumber,
        is_active: candidate.classification === "active",
        migration_status: "legacy",
        created_at: candidate.createdDateTime,
      });

      result.succeeded += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(
        `${candidate.proposedName}: ${error instanceof Error ? error.message : "Migration failed."}`
      );
    }
  }

  return NextResponse.json(result);
}

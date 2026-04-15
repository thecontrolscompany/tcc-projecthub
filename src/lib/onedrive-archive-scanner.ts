import { graphBatch, listOneDriveChildren, type OneDriveChildItem } from "@/lib/graph/client";

const ARCHIVE_ROOT = "Projects/_Archive";

const YEAR_BUCKETS: Record<string, { status: "active" | "lost" | "won"; year: number | null }> = {
  "_2021 Bids": { status: "lost", year: 2021 },
  "_2022 Bids": { status: "lost", year: 2022 },
  "_2023 Bids": { status: "lost", year: 2023 },
  "_2024 Bids": { status: "lost", year: 2024 },
  "_2025 Bids": { status: "lost", year: 2025 },
  "_Completed": { status: "won", year: null },
};

const KNOWN_GC_NAMES = new Set([
  "JCI",
  "Trane",
  "TRA",
  "Siemens",
  "ECS",
  "BAU",
  "Noresco",
  "Canteen",
  "Integration Project",
  "2022 ECS",
  "MOB 2",
  "Rebid Trane",
  "From ECS",
  "NW FL Bch Int'l Airport North Terminal",
]);

const PROGRAM_FOLDER_PREFIXES: Record<string, string> = {
  Tyndall: "TAFB",
};

const REFERENCE_FOLDER_NAMES = new Set([
  "Plans - Specs",
  "Admin",
  "BOM",
  "Change Orders-RFI",
  "Project Updates",
  "Estimate - Proposal",
  "Submittal",
  "Navigator Files",
  "Plans",
  "Specs",
  "Drawings",
  "Site Photos",
  "Old",
  "Schedule - Contacts",
  "HVLS Fans",
]);

export type ManifestFileRole = "proposal_docx" | "proposal_pdf" | "estimate_xlsm" | "other";

export type ManifestFile = {
  item_id: string;
  name: string;
  size: number;
  role: ManifestFileRole;
};

export type ManifestQuote = {
  gc_name: string | null;
  folder_item_id: string;
  folder_path: string;
  files: ManifestFile[];
};

export type ManifestEntry = {
  pursuit_item_id: string;
  pursuit_path: string;
  pursuit_name: string;
  year: number | null;
  year_bucket: string;
  pursuit_status: "active" | "lost" | "won";
  pattern: "flat" | "gc_subfolders" | "completed";
  quotes: ManifestQuote[];
  warnings: string[];
  skip: boolean;
  already_imported: boolean;
};

function classifyFile(name: string): ManifestFileRole {
  const lower = name.toLowerCase();
  if ((lower.includes("proposal") || lower.startsWith("hvac control")) && (lower.endsWith(".docx") || lower.endsWith(".doc"))) {
    return "proposal_docx";
  }
  if ((lower.includes("proposal") || lower.startsWith("hvac control")) && lower.endsWith(".pdf")) {
    return "proposal_pdf";
  }
  if (lower.includes("budgeting tool") && lower.endsWith(".xlsm")) return "estimate_xlsm";
  return "other";
}

function isProposalFile(name: string): boolean {
  const role = classifyFile(name);
  return role === "proposal_docx" || role === "proposal_pdf";
}

function toManifestFile(item: OneDriveChildItem): ManifestFile {
  return {
    item_id: item.id,
    name: item.name,
    size: item.size,
    role: classifyFile(item.name),
  };
}

async function batchListChildren(
  providerToken: string,
  paths: Array<{ id: string; path: string }>
): Promise<Map<string, OneDriveChildItem[]>> {
  const results = new Map<string, OneDriveChildItem[]>();
  const chunkSize = 20;

  for (let index = 0; index < paths.length; index += chunkSize) {
    const chunk = paths.slice(index, index + chunkSize);
    const requests = chunk.map(({ id, path }) => {
      const encodedPath = path
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
      return {
        id,
        method: "GET",
        url: `/me/drive/root:/${encodedPath}:/children?$select=id,name,size,file,folder,createdDateTime&$top=200`,
      };
    });

    const responses = await graphBatch(providerToken, requests);

    for (const response of responses) {
      const items: OneDriveChildItem[] = [];
      if (response.status === 200) {
        const body = response.body as {
          value?: Array<{
            id?: string;
            name?: string;
            size?: number;
            createdDateTime?: string;
            file?: unknown;
            folder?: { childCount?: number };
          }>;
        };

        for (const item of body.value ?? []) {
          if (!item.id || !item.name) continue;
          items.push({
            id: item.id,
            name: item.name,
            size: item.size ?? 0,
            createdDateTime: item.createdDateTime ?? "",
            isFolder: Boolean(item.folder),
            childCount: item.folder?.childCount ?? null,
          });
        }
      }
      results.set(response.id, items);
    }
  }

  return results;
}

function buildFlatEntry(
  folderItem: OneDriveChildItem,
  path: string,
  children: OneDriveChildItem[],
  bucketName: string,
  bucketMeta: { status: "active" | "lost" | "won"; year: number | null }
): ManifestEntry {
  const files = children.filter((child) => !child.isFolder).map(toManifestFile);
  const proposalFiles = files.filter((file) => file.role !== "other");
  const warnings: string[] = [];

  if (proposalFiles.length === 0) {
    const hasEstimateSubfolder = children.some((child) => child.isFolder && child.name === "Estimate - Proposal");
    if (!hasEstimateSubfolder) {
      warnings.push("No proposal or estimate files found");
    }
  }

  return {
    pursuit_item_id: folderItem.id,
    pursuit_path: path,
    pursuit_name: folderItem.name,
    year: bucketMeta.year,
    year_bucket: bucketName,
    pursuit_status: bucketMeta.status,
    pattern: bucketName === "_Completed" ? "completed" : "flat",
    quotes: [
      {
        gc_name: null,
        folder_item_id: folderItem.id,
        folder_path: path,
        files,
      },
    ],
    warnings,
    skip: false,
    already_imported: false,
  };
}

function classifyPursuitFolder(
  folderItem: OneDriveChildItem,
  folderPath: string,
  children: OneDriveChildItem[],
  subfolderChildrenMap: Map<string, OneDriveChildItem[]>,
  bucketName: string,
  bucketMeta: { status: "active" | "lost" | "won"; year: number | null }
): ManifestEntry[] {
  const directFiles = children.filter((child) => !child.isFolder);
  const subfolders = children.filter((child) => child.isFolder && !REFERENCE_FOLDER_NAMES.has(child.name));
  const hasDirectProposal = directFiles.some((file) => isProposalFile(file.name));

  if (hasDirectProposal || subfolders.length === 0) {
    return [buildFlatEntry(folderItem, folderPath, children, bucketName, bucketMeta)];
  }

  const subfoldersWithProposals = subfolders.filter((subfolder) => {
    const subChildren = subfolderChildrenMap.get(`${folderPath}/${subfolder.name}`) ?? [];
    return subChildren.some((child) => !child.isFolder && isProposalFile(child.name));
  });

  if (subfoldersWithProposals.length === 0) {
    const entry = buildFlatEntry(folderItem, folderPath, children, bucketName, bucketMeta);
    entry.warnings.push("No proposal files found in folder or subfolders");
    return [entry];
  }

  const hasKnownGC = subfoldersWithProposals.some(
    (subfolder) => KNOWN_GC_NAMES.has(subfolder.name) || KNOWN_GC_NAMES.has(subfolder.name.toUpperCase())
  );

  if (hasKnownGC) {
    const quotes: ManifestQuote[] = subfoldersWithProposals.map((subfolder) => {
      const subPath = `${folderPath}/${subfolder.name}`;
      const subChildren = subfolderChildrenMap.get(subPath) ?? [];
      return {
        gc_name: subfolder.name,
        folder_item_id: subfolder.id,
        folder_path: subPath,
        files: subChildren.filter((child) => !child.isFolder).map(toManifestFile),
      };
    });

    return [
      {
        pursuit_item_id: folderItem.id,
        pursuit_path: folderPath,
        pursuit_name: folderItem.name,
        year: bucketMeta.year,
        year_bucket: bucketName,
        pursuit_status: bucketMeta.status,
        pattern: "gc_subfolders",
        quotes,
        warnings: [],
        skip: false,
        already_imported: false,
      },
    ];
  }

  const prefix = PROGRAM_FOLDER_PREFIXES[folderItem.name] ?? folderItem.name;

  return subfoldersWithProposals.map((subfolder) => {
    const subPath = `${folderPath}/${subfolder.name}`;
    const subChildren = subfolderChildrenMap.get(subPath) ?? [];
    const subSubfolders = subChildren.filter((child) => child.isFolder && !REFERENCE_FOLDER_NAMES.has(child.name));
    const subDirectFiles = subChildren.filter((child) => !child.isFolder);
    const subGcFolders = subSubfolders.filter(
      (child) => KNOWN_GC_NAMES.has(child.name) || KNOWN_GC_NAMES.has(child.name.toUpperCase())
    );

    let quotes: ManifestQuote[];
    if (subGcFolders.length > 0) {
      quotes = subGcFolders.map((gcFolder) => ({
        gc_name: gcFolder.name,
        folder_item_id: gcFolder.id,
        folder_path: `${subPath}/${gcFolder.name}`,
        files: [],
      }));
    } else {
      quotes = [
        {
          gc_name: null,
          folder_item_id: subfolder.id,
          folder_path: subPath,
          files: subDirectFiles.map(toManifestFile),
        },
      ];
    }

    return {
      pursuit_item_id: subfolder.id,
      pursuit_path: subPath,
      pursuit_name: `${prefix} ${subfolder.name}`,
      year: bucketMeta.year,
      year_bucket: bucketName,
      pursuit_status: bucketMeta.status,
      pattern: "flat",
      quotes,
      warnings: subGcFolders.length > 0 ? ["GC sub-subfolders detected - quote file details not loaded in scan"] : [],
      skip: false,
      already_imported: false,
    };
  });
}

export async function scanOneDriveArchive(
  providerToken: string,
  yearFilter?: string
): Promise<ManifestEntry[]> {
  const rootChildren = await listOneDriveChildren(providerToken, ARCHIVE_ROOT);

  const yearBucketFolders = rootChildren.filter((child) => child.isFolder && child.name in YEAR_BUCKETS);
  const currentYearFolders = rootChildren.filter(
    (child) => child.isFolder && !(child.name in YEAR_BUCKETS) && !child.name.startsWith("_")
  );

  type BucketWork = {
    bucketName: string;
    bucketMeta: { status: "active" | "lost" | "won"; year: number | null };
    pursuitFolders: Array<{ item: OneDriveChildItem; path: string }>;
  };

  const buckets: BucketWork[] = [];

  if (!yearFilter || yearFilter === "_Archive") {
    buckets.push({
      bucketName: "_Archive",
      bucketMeta: { status: "active", year: new Date().getFullYear() },
      pursuitFolders: currentYearFolders.map((item) => ({
        item,
        path: `${ARCHIVE_ROOT}/${item.name}`,
      })),
    });
  }

  for (const bucketFolder of yearBucketFolders) {
    if (yearFilter && yearFilter !== bucketFolder.name) continue;

    const bucketPath = `${ARCHIVE_ROOT}/${bucketFolder.name}`;
    const bucketMeta = YEAR_BUCKETS[bucketFolder.name];
    const pursuitItems = await listOneDriveChildren(providerToken, bucketPath);
    const pursuitFolders = pursuitItems
      .filter((child) => child.isFolder)
      .map((item) => ({ item, path: `${bucketPath}/${item.name}` }));

    buckets.push({ bucketName: bucketFolder.name, bucketMeta, pursuitFolders });
  }

  const allPursuitPaths: Array<{ id: string; path: string }> = [];
  for (const bucket of buckets) {
    for (const { item, path } of bucket.pursuitFolders) {
      allPursuitPaths.push({ id: `${bucket.bucketName}||${item.name}`, path });
    }
  }

  const pursuitChildrenMap = await batchListChildren(providerToken, allPursuitPaths);

  const subfolderPaths: Array<{ id: string; path: string }> = [];
  for (const bucket of buckets) {
    for (const { item, path } of bucket.pursuitFolders) {
      const children = pursuitChildrenMap.get(`${bucket.bucketName}||${item.name}`) ?? [];
      const actionableSubfolders = children.filter(
        (child) => child.isFolder && !REFERENCE_FOLDER_NAMES.has(child.name) && (child.childCount ?? 0) > 0
      );
      for (const subfolder of actionableSubfolders) {
        const subPath = `${path}/${subfolder.name}`;
        subfolderPaths.push({ id: subPath, path: subPath });
      }
    }
  }

  const subfolderChildrenMap = await batchListChildren(providerToken, subfolderPaths);

  const manifest: ManifestEntry[] = [];

  for (const bucket of buckets) {
    for (const { item, path } of bucket.pursuitFolders) {
      const children = pursuitChildrenMap.get(`${bucket.bucketName}||${item.name}`) ?? [];
      const entries = classifyPursuitFolder(
        item,
        path,
        children,
        subfolderChildrenMap,
        bucket.bucketName,
        bucket.bucketMeta
      );
      manifest.push(...entries);
    }
  }

  return manifest;
}

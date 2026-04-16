import { NextResponse } from "next/server";
import {
  getSharePointDriveId,
  getSharePointSiteId,
  listSharePointChildren,
} from "@/lib/graph/client";
import { requireAdminWithMicrosoft } from "@/lib/opportunity-import-server";

type PursuitRow = {
  id: string;
  project_name: string | null;
  owner_name: string | null;
  sharepoint_folder: string | null;
  sharepoint_item_id: string | null;
};

type FolderNode = {
  id: string;
  name: string;
  path: string;
  depth: number;
  child_count: number;
};

type SuggestedFolder = FolderNode & {
  score: number;
};

const STANDARD_FOLDER_NAMES = new Set([
  "01 customer uploads",
  "02 internal review",
  "03 estimate working",
  "04 submitted quote",
  "99 archive legacy files",
  "99 archive - legacy files",
]);

export async function GET(): Promise<Response> {
  const auth = await requireAdminWithMicrosoft();
  if ("error" in auth) return auth.error;

  const { supabase, providerToken } = auth;

  const { data: pursuits, error } = await supabase
    .from("pursuits")
    .select("id, project_name, owner_name, sharepoint_folder, sharepoint_item_id")
    .not("sharepoint_folder", "is", null)
    .not("sharepoint_item_id", "is", null)
    .order("project_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const linkedPursuits = (pursuits ?? []) as PursuitRow[];
  const groups = new Map<string, PursuitRow[]>();

  for (const pursuit of linkedPursuits) {
    if (!pursuit.sharepoint_folder || !pursuit.sharepoint_item_id) continue;
    const key = `${pursuit.sharepoint_folder}|||${pursuit.sharepoint_item_id}`;
    const current = groups.get(key) ?? [];
    current.push(pursuit);
    groups.set(key, current);
  }

  const duplicateGroups = [...groups.values()]
    .filter((group) => group.length > 1)
    .sort(
      (left, right) =>
        right.length - left.length ||
        (left[0]?.sharepoint_folder ?? "").localeCompare(right[0]?.sharepoint_folder ?? "")
    );

  const siteId = await getSharePointSiteId(providerToken);
  const driveId = await getSharePointDriveId(providerToken, siteId);

  const responseGroups = [];
  for (const group of duplicateGroups) {
    const parentPath = group[0]?.sharepoint_folder ?? "";
    const parentItemId = group[0]?.sharepoint_item_id ?? "";
    const descendants = await collectDescendantFolders(providerToken, driveId, parentItemId, parentPath);
    const candidateFolders = buildCandidateFolders(descendants);

    responseGroups.push({
      sharepoint_folder: parentPath,
      sharepoint_item_id: parentItemId,
      pursuit_count: group.length,
      candidate_folder_count: candidateFolders.length,
      child_folders: candidateFolders,
      pursuits: group.map((pursuit) => ({
        id: pursuit.id,
        project_name: pursuit.project_name,
        owner_name: pursuit.owner_name,
        current_folder: pursuit.sharepoint_folder,
        current_item_id: pursuit.sharepoint_item_id,
        suggestions: suggestFolders(pursuit, candidateFolders),
      })),
    });
  }

  return NextResponse.json({
    umbrella_group_count: responseGroups.length,
    umbrella_pursuit_total: responseGroups.reduce((sum, group) => sum + group.pursuit_count, 0),
    groups: responseGroups,
  });
}

async function collectDescendantFolders(
  providerToken: string,
  driveId: string,
  rootItemId: string,
  rootPath: string,
  maxDepth = 5
): Promise<FolderNode[]> {
  const seen = new Set<string>();
  const collected: FolderNode[] = [];

  async function walk(itemId: string, path: string, depth: number) {
    if (depth >= maxDepth || seen.has(itemId)) return;
    seen.add(itemId);

    const children = await listSharePointChildren(providerToken, driveId, itemId);
    const folders = children.filter((child) => child.isFolder);

    for (const folder of folders) {
      const childPath = `${path}/${folder.name}`;
      collected.push({
        id: folder.id,
        name: folder.name,
        path: childPath,
        depth: depth + 1,
        child_count: folder.childCount ?? 0,
      });
      await walk(folder.id, childPath, depth + 1);
    }
  }

  await walk(rootItemId, rootPath, 0);
  return collected;
}

function buildCandidateFolders(descendants: FolderNode[]): FolderNode[] {
  const nonStandard = descendants.filter((folder) => !isStandardFolder(folder.name));
  const leafLike = nonStandard.filter(
    (folder) =>
      folder.child_count === 0 ||
      !descendants.some((child) => child.path.startsWith(`${folder.path}/`) && !isStandardFolder(child.name))
  );

  const candidates = leafLike.length > 0 ? leafLike : nonStandard.length > 0 ? nonStandard : descendants;

  return [...candidates].sort(
    (left, right) => left.depth - right.depth || left.path.localeCompare(right.path)
  );
}

function suggestFolders(pursuit: PursuitRow, candidates: FolderNode[]): SuggestedFolder[] {
  const projectName = pursuit.project_name ?? "";
  const ownerName = pursuit.owner_name ?? "";

  return candidates
    .map((folder) => {
      let score = scoreMatch(projectName, folder.name) * 2 + scoreMatch(projectName, folder.path);
      if (ownerName) {
        score += Math.round(scoreMatch(ownerName, folder.path) * 0.6);
      }
      score -= Math.max(0, folder.depth - 2) * 3;

      return { ...folder, score };
    })
    .filter((folder) => folder.score >= 25)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, 8);
}

function isStandardFolder(name: string) {
  return STANDARD_FOLDER_NAMES.has(normalizeText(name));
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(source: string, target: string) {
  const normalizedSource = normalizeText(source);
  const normalizedTarget = normalizeText(target);
  if (!normalizedSource || !normalizedTarget) return 0;
  if (normalizedSource === normalizedTarget) return 100;
  if (normalizedTarget.includes(normalizedSource) || normalizedSource.includes(normalizedTarget)) return 84;

  const sourceTokens = normalizedSource.split(" ").filter((token) => token.length > 2);
  const targetTokens = new Set(normalizedTarget.split(" ").filter((token) => token.length > 2));
  if (sourceTokens.length === 0 || targetTokens.size === 0) return 0;

  const overlap = sourceTokens.filter((token) => targetTokens.has(token)).length;
  if (overlap === 0) return 0;

  return Math.round((overlap / sourceTokens.length) * 70);
}

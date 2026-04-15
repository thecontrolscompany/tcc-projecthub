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
const GARBAGE_PATTERNS = [
  /contractor/i,
  /submit/i,
  /stripping/i,
  /checkout/i,
  /proceed/i,
  /bidders/i,
  /determination/i,
  /conduit/i,
  /cabling/i,
  /hancars/i,
  /loan.*number/i,
  /wage/i,
];

type EnrichResult = {
  pursuit_id: string;
  pursuit_name: string;
  status: "enriched" | "no_folder" | "no_file" | "error";
  sharepoint_folder?: string | null;
  customer_name?: string | null;
  estimated_value?: number | null;
  candidate_file?: string | null;
  error?: string;
};

type PursuitStub = {
  id: string;
  project_name: string;
  owner_name: string | null;
  sharepoint_folder: string | null;
  sharepoint_item_id: string | null;
};

type CandidateFile = {
  id: string;
  name: string;
  sourceFolder: string;
};

function isValidCustomerName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return false;
  if (/[;@]/.test(trimmed)) return false;
  if (/^_+$/.test(trimmed)) return false;
  if (/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(trimmed)) return false;
  if (GARBAGE_PATTERNS.some((re) => re.test(trimmed))) return false;
  return true;
}

function hasMeaningfulExtraction(fields: {
  customerName: string | null;
  projectName: string | null;
  estimatedValue: number | null;
  proposalDate: string | null;
}) {
  return (
    isValidCustomerName(fields.customerName) ||
    Boolean(fields.projectName?.trim()) ||
    fields.estimatedValue !== null ||
    Boolean(fields.proposalDate)
  );
}

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
    filtered.find((file) => file.name.toLowerCase().endsWith(".doc")) ??
    filtered.find((file) => file.name.toLowerCase().endsWith(".pdf")) ??
    filtered.find((file) => {
      const lower = file.name.toLowerCase();
      return lower.endsWith(".xlsm") || lower.endsWith(".xlsx");
    }) ??
    null
  );
}

function normalizeMatchText(value: string) {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/\b(hvac|controls|control|installation|proposal|submitted|quote|working|estimate)\b/g, " ")
    .replace(/[^\w\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreCandidateFile(candidate: CandidateFile, pursuitName: string, folderPath: string | null) {
  const fileNorm = normalizeMatchText(candidate.name);
  const pursuitNorm = normalizeMatchText(pursuitName);
  const folderNorm = normalizeMatchText((folderPath ?? "").replace(/^Bids[\\/]/i, ""));

  const fileTokens = new Set(fileNorm.split(" ").filter((token) => token.length > 2));
  const pursuitTokens = new Set(pursuitNorm.split(" ").filter((token) => token.length > 2));
  const overlap = Array.from(pursuitTokens).filter((token) => fileTokens.has(token)).length;
  const extraTokens = Array.from(fileTokens).filter((token) => !pursuitTokens.has(token)).length;

  let score = 0;
  if (candidate.sourceFolder === "03 Estimate Working") score += 50;
  else if (candidate.sourceFolder === "04 Submitted Quote") score += 30;
  else if (candidate.sourceFolder === ARCHIVE_SUBFOLDER) score += 10;

  const lowerName = candidate.name.toLowerCase();
  if (lowerName.endsWith(".docx")) score += 25;
  else if (lowerName.endsWith(".doc")) score += 20;
  else if (lowerName.endsWith(".pdf")) score += 15;
  else score += 5;

  if (/\bproposal\b/i.test(candidate.name)) score += 25;
  if (pursuitNorm && fileNorm === pursuitNorm) score += 120;
  else if (pursuitNorm && fileNorm.includes(pursuitNorm)) score += 90;
  else if (folderNorm && fileNorm.includes(folderNorm)) score += 80;

  score += overlap * 20;
  score -= extraTokens * 5;

  if (/renovation/i.test(candidate.name) && !/renovation/i.test(pursuitName)) score -= 40;

  return score;
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

      if (!folderItemId) {
        // If folderPath is already set (e.g. manually linked), derive lookup name
        // from the path; otherwise match by pursuit name.
        const lookupName = folderPath
          ? normalizePursuitName(folderPath.replace(/^Bids\//, ""))
          : normalizePursuitName(pursuit.project_name ?? "");

        const match = folderMap.get(lookupName);
        if (!match) {
          results.push({
            pursuit_id: pursuit.id,
            pursuit_name: pursuit.project_name,
            status: "no_folder",
          });
          continue;
        }

        if (!folderPath) folderPath = `Bids/${match.name}`;
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

      const EXTRACTABLE_EXTS = ["docx", "doc", "pdf", "xlsm", "xlsx"];
      const hasExtractable = (files: CandidateFile[]) =>
        files.some((f) => EXTRACTABLE_EXTS.includes(f.name.toLowerCase().split(".").pop() ?? ""));

      let archiveFiles: CandidateFile[] = [];

      if (archiveFolder) {
        const archiveChildren = await listSharePointChildren(providerToken, driveId, archiveFolder.id);
        archiveFiles = archiveChildren
          .filter((item) => !item.isFolder)
          .map((item) => ({ id: item.id, name: item.name, sourceFolder: ARCHIVE_SUBFOLDER }));

        // Files may be nested inside subfolders (e.g. "99 Archive - Legacy Files/Adams
        // Homes/proposal.docx" or two levels deep for multi-project folders like USA).
        // Recurse up to 2 levels until extractable files are found.
        if (!hasExtractable(archiveFiles)) {
          const level1Folders = archiveChildren.filter((item) => item.isFolder);
          for (const sub of level1Folders) {
            const subChildren = await listSharePointChildren(providerToken, driveId, sub.id);
            archiveFiles = archiveFiles.concat(
              subChildren
                .filter((item) => !item.isFolder)
                .map((item) => ({ id: item.id, name: item.name, sourceFolder: `${ARCHIVE_SUBFOLDER}/${sub.name}` }))
            );

            if (!hasExtractable(archiveFiles)) {
              const level2Folders = subChildren.filter((item) => item.isFolder);
              for (const sub2 of level2Folders) {
                const sub2Children = await listSharePointChildren(providerToken, driveId, sub2.id);
                archiveFiles = archiveFiles.concat(
                  sub2Children
                    .filter((item) => !item.isFolder)
                    .map((item) => ({
                      id: item.id,
                      name: item.name,
                      sourceFolder: `${ARCHIVE_SUBFOLDER}/${sub.name}/${sub2.name}`,
                    }))
                );
              }
            }
          }
        }
      }

      // Always include the standard subfolders in the candidate pool. The best
      // extractable file may live in 03/04 even when the archive still contains
      // other extractable documents.
      const STANDARD_SUBFOLDERS = ["03 Estimate Working", "04 Submitted Quote"];
      for (const subName of STANDARD_SUBFOLDERS) {
        const subFolder = folderChildren.find(
          (item) => item.isFolder && item.name.toLowerCase() === subName.toLowerCase()
        );
        if (subFolder) {
          const subChildren = await listSharePointChildren(providerToken, driveId, subFolder.id);
          archiveFiles = archiveFiles.concat(
            subChildren
              .filter((item) => !item.isFolder)
              .map((item) => ({ id: item.id, name: item.name, sourceFolder: subName }))
          );
        }
      }

      if (!hasExtractable(archiveFiles)) {
        results.push({
          pursuit_id: pursuit.id,
          pursuit_name: pursuit.project_name,
          status: "no_file",
          sharepoint_folder: folderPath,
        });
        continue;
      }

      // Try candidates in priority order, falling back if download or extraction fails.
      let customerName: string | null = null;
      let projectName: string | null = null;
      let estimatedValue: number | null = null;
      let proposalDate: string | null = null;
      let extracted = false;
      let candidateFile: string | null = null;

      // Build ordered candidate list: docx > doc > pdf > xlsm/xlsx
      const candidates = [
        ...archiveFiles.filter((f) => f.name.toLowerCase().endsWith(".docx")),
        ...archiveFiles.filter((f) => f.name.toLowerCase().endsWith(".doc")),
        ...archiveFiles.filter((f) => f.name.toLowerCase().endsWith(".pdf")),
        ...archiveFiles.filter((f) => f.name.toLowerCase().endsWith(".xlsm") || f.name.toLowerCase().endsWith(".xlsx")),
      ]
        .filter((f) => !SKIP_NAMES.some((s) => f.name.toLowerCase().includes(s)))
        .sort(
          (left, right) =>
            scoreCandidateFile(right, pursuit.project_name ?? "", folderPath) -
            scoreCandidateFile(left, pursuit.project_name ?? "", folderPath)
        );

      for (const candidate of candidates) {
        try {
          const response = await fetchSharePointItemContent(providerToken, driveId, candidate.id);
          if (!response.ok) continue;

          const buffer = Buffer.from(await response.arrayBuffer());
          const ext = candidate.name.toLowerCase().split(".").pop() ?? "";

          if (ext === "docx" || ext === "doc") {
            const e = await extractProposalFromDocx(buffer);
            customerName   = e.customerName  ?? null;
            projectName    = e.projectName   ?? null;
            estimatedValue = e.baseBidAmount ?? null;
            proposalDate   = e.proposalDate  ?? null;
          } else if (ext === "pdf") {
            const e = await extractProposalFromPdf(buffer);
            customerName   = e.customerName  ?? null;
            projectName    = e.projectName   ?? null;
            estimatedValue = e.baseBidAmount ?? null;
            proposalDate   = e.proposalDate  ?? null;
          } else {
            const e = await extractEstimateFromWorkbook(buffer);
            estimatedValue = e.base_bid_amount ?? e.final_total_amount ?? null;
          }

          if (!hasMeaningfulExtraction({ customerName, projectName, estimatedValue, proposalDate })) {
            customerName = null;
            projectName = null;
            estimatedValue = null;
            proposalDate = null;
            continue;
          }

          extracted = true;
          candidateFile = candidate.name;
          break; // stop at first successful extraction
        } catch {
          // This candidate failed — try the next one.
          continue;
        }
      }

      if (!extracted) {
        results.push({
          pursuit_id: pursuit.id,
          pursuit_name: pursuit.project_name,
          status: "no_file",
          sharepoint_folder: folderPath,
        });
        continue;
      }

      const pursuitPatch: Record<string, unknown> = {};
      if (folderPath && !pursuit.sharepoint_folder) pursuitPatch.sharepoint_folder = folderPath;
      if (folderItemId && !pursuit.sharepoint_item_id) pursuitPatch.sharepoint_item_id = folderItemId;
      if (isValidCustomerName(customerName)) pursuitPatch.owner_name = customerName;

      if (Object.keys(pursuitPatch).length > 0) {
        await supabase.from("pursuits").update(pursuitPatch).eq("id", pursuit.id);
      }

      const quotePatch: Record<string, unknown> = {};
      if (isValidCustomerName(customerName)) quotePatch.company_name = customerName;
      if (projectName) {
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
        candidate_file: candidateFile,
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

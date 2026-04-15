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

export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdminWithMicrosoft();
  if ("error" in auth) return auth.error;

  const { supabase, providerToken } = auth;
  const { searchParams } = new URL(request.url);
  const pursuitId = searchParams.get("pursuit_id");
  const projectName = searchParams.get("project_name");

  if (!pursuitId && !projectName) {
    return NextResponse.json(
      { error: "Provide pursuit_id or project_name query parameter." },
      { status: 400 }
    );
  }

  let query = supabase
    .from("pursuits")
    .select(`
      id,
      project_name,
      owner_name,
      sharepoint_folder,
      sharepoint_item_id,
      quote_requests (
        id,
        company_name,
        estimated_value,
        proposal_date,
        project_description,
        created_at
      )
    `)
    .limit(1);

  if (pursuitId) query = query.eq("id", pursuitId);
  else query = query.ilike("project_name", `%${projectName}%`);

  const { data: pursuit, error: pursuitError } = await query.maybeSingle();
  if (pursuitError) {
    return NextResponse.json({ error: pursuitError.message }, { status: 500 });
  }
  if (!pursuit) {
    return NextResponse.json({ error: "Pursuit not found." }, { status: 404 });
  }

  const typedPursuit = pursuit as PursuitStub & {
    quote_requests: Array<{
      id: string;
      company_name: string;
      estimated_value: number | null;
      proposal_date: string | null;
      project_description: string | null;
      created_at: string;
    }>;
  };

  const siteId = await getSharePointSiteId(providerToken);
  const driveId = await getSharePointDriveId(providerToken, siteId);

  let folderPath = typedPursuit.sharepoint_folder;
  let folderItemId = typedPursuit.sharepoint_item_id;

  if (!folderItemId) {
    const bidFolders = await listSharePointFolders(providerToken, driveId, "Bids");
    const lookupName = folderPath
      ? normalizePursuitName(folderPath.replace(/^Bids\//, ""))
      : normalizePursuitName(typedPursuit.project_name ?? "");
    const match = bidFolders.find((folder) => normalizePursuitName(folder.name) === lookupName);
    if (!match) {
      return NextResponse.json({
        pursuit: typedPursuit,
        resolved_folder: null,
        candidates: [],
        error: "No SharePoint folder match found.",
      });
    }
    folderPath = folderPath ?? `Bids/${match.name}`;
    folderItemId = match.id;
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

  if (!hasExtractable(archiveFiles)) {
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
  }

  const candidates = [
    ...archiveFiles.filter((f) => f.name.toLowerCase().endsWith(".docx")),
    ...archiveFiles.filter((f) => f.name.toLowerCase().endsWith(".doc")),
    ...archiveFiles.filter((f) => f.name.toLowerCase().endsWith(".pdf")),
    ...archiveFiles.filter((f) => f.name.toLowerCase().endsWith(".xlsm") || f.name.toLowerCase().endsWith(".xlsx")),
  ]
    .filter((f) => !SKIP_NAMES.some((s) => f.name.toLowerCase().includes(s)))
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidateFile(candidate, typedPursuit.project_name ?? "", folderPath),
    }))
    .sort((left, right) => right.score - left.score);

  const diagnostics = [];
  for (const candidate of candidates) {
    try {
      const response = await fetchSharePointItemContent(providerToken, driveId, candidate.id);
      if (!response.ok) {
        diagnostics.push({
          ...candidate,
          http_status: response.status,
          extraction: null,
          meaningful: false,
        });
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const ext = candidate.name.toLowerCase().split(".").pop() ?? "";

      let customerName: string | null = null;
      let projectNameValue: string | null = null;
      let estimatedValue: number | null = null;
      let proposalDate: string | null = null;

      if (ext === "docx" || ext === "doc") {
        const extracted = await extractProposalFromDocx(buffer);
        customerName = extracted.customerName ?? null;
        projectNameValue = extracted.projectName ?? null;
        estimatedValue = extracted.baseBidAmount ?? null;
        proposalDate = extracted.proposalDate ?? null;
      } else if (ext === "pdf") {
        const extracted = await extractProposalFromPdf(buffer);
        customerName = extracted.customerName ?? null;
        projectNameValue = extracted.projectName ?? null;
        estimatedValue = extracted.baseBidAmount ?? null;
        proposalDate = extracted.proposalDate ?? null;
      } else {
        const extracted = await extractEstimateFromWorkbook(buffer);
        estimatedValue = extracted.base_bid_amount ?? extracted.final_total_amount ?? null;
      }

      diagnostics.push({
        ...candidate,
        http_status: response.status,
        extraction: {
          customer_name: customerName,
          valid_customer_name: isValidCustomerName(customerName),
          project_name: projectNameValue,
          estimated_value: estimatedValue,
          proposal_date: proposalDate,
        },
        meaningful: hasMeaningfulExtraction({
          customerName,
          projectName: projectNameValue,
          estimatedValue,
          proposalDate,
        }),
      });
    } catch (error) {
      diagnostics.push({
        ...candidate,
        extraction: null,
        meaningful: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    pursuit: typedPursuit,
    resolved_folder: {
      path: folderPath,
      item_id: folderItemId,
    },
    folder_children: folderChildren.map((child) => ({
      id: child.id,
      name: child.name,
      is_folder: child.isFolder,
    })),
    candidates: diagnostics,
    selected_candidate: diagnostics.find((candidate) => candidate.meaningful) ?? null,
  });
}

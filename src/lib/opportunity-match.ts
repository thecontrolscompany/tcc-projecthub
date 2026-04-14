import type { LegacyOpportunityImportRow, Project } from "@/types/database";

export type ProjectMatchSuggestion = {
  candidateId: string;
  candidateName: string;
  jobNumber: string | null;
  confidenceScore: number;
  reasons: string[];
};

export function findProjectMatchSuggestions(
  row: Pick<LegacyOpportunityImportRow, "legacy_opportunity_name" | "company_name" | "project_location" | "job_number" | "amount">,
  projects: Array<Pick<Project, "id" | "name" | "job_number" | "site_address" | "contract_price">>,
  limit = 3
) {
  return projects
    .map((project) => scoreProjectMatch(row, project))
    .filter((candidate) => candidate.confidenceScore > 0)
    .sort((left, right) => right.confidenceScore - left.confidenceScore)
    .slice(0, limit);
}

function scoreProjectMatch(
  row: Pick<LegacyOpportunityImportRow, "legacy_opportunity_name" | "company_name" | "project_location" | "job_number" | "amount">,
  project: Pick<Project, "id" | "name" | "job_number" | "site_address" | "contract_price">
): ProjectMatchSuggestion {
  let confidenceScore = 0;
  const reasons: string[] = [];

  const normalizedRowJob = normalizeSimple(row.job_number);
  const normalizedProjectJob = normalizeSimple(project.job_number);
  if (normalizedRowJob && normalizedProjectJob && normalizedRowJob === normalizedProjectJob) {
    confidenceScore += 70;
    reasons.push("Exact job number match");
  }

  const rowName = normalizeName(row.legacy_opportunity_name);
  const projectName = normalizeName(project.name);
  const nameSimilarity = similarityScore(rowName, projectName);
  if (nameSimilarity >= 0.9) {
    confidenceScore += 25;
    reasons.push("Project name closely matches");
  } else if (nameSimilarity >= 0.75) {
    confidenceScore += 15;
    reasons.push("Project name partially matches");
  }

  const rowLocation = normalizeName(row.project_location);
  const projectLocation = normalizeName(project.site_address);
  const locationSimilarity = similarityScore(rowLocation, projectLocation);
  if (locationSimilarity >= 0.85) {
    confidenceScore += 15;
    reasons.push("Location closely matches");
  }

  if (typeof row.amount === "number" && typeof project.contract_price === "number") {
    const difference = Math.abs(row.amount - project.contract_price);
    const tolerance = Math.max(1000, project.contract_price * 0.05);
    if (difference <= tolerance) {
      confidenceScore += 10;
      reasons.push("Amount is within tolerance");
    }
  }

  return {
    candidateId: project.id,
    candidateName: project.name,
    jobNumber: project.job_number ?? null,
    confidenceScore,
    reasons,
  };
}

function normalizeSimple(value: string | null | undefined) {
  return value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
}

function normalizeName(value: string | null | undefined) {
  return value
    ?.trim()
    .toUpperCase()
    .replace(/\b(THE|LLC|INC|CO|COMPANY|CORP|CORPORATION)\b/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim() ?? "";
}

function similarityScore(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;

  const leftTokens = new Set(left.split(" "));
  const rightTokens = new Set(right.split(" "));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;

  return union === 0 ? 0 : intersection / union;
}

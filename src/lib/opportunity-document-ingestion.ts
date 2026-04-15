// mammoth, unpdf, and exceljs are loaded lazily inside their functions
// so a missing/broken package produces a JSON error, not an HTML 500.
import type ExcelJS from "exceljs";
import type {
  OpportunityEquipmentGroup,
  OpportunityEstimateSummary,
  OpportunityPricingItem,
  OpportunityScopeItem,
} from "@/types/database";

export type ProposalExtractionResult = {
  proposalDate: string | null;
  customerName: string | null;
  projectName: string | null;
  baseBidAmount: number | null;
  pricingItems: Omit<OpportunityPricingItem, "id">[];
  scopeItems: Omit<OpportunityScopeItem, "id">[];
  equipmentGroups: Omit<OpportunityEquipmentGroup, "id">[];
  extractedText: string;
};

export type EstimateExtractionResult = Omit<OpportunityEstimateSummary, "id" | "extracted_at"> & {
  extractedText?: string;
};

export async function extractProposalFromDocx(buffer: Buffer) {
  const mammoth = await import("mammoth").then((m) => m.default ?? m);
  const result = await mammoth.extractRawText({ buffer });
  return extractProposalFromText(result.value);
}

export async function extractCompanyNameFromDocx(buffer: Buffer): Promise<string | null> {
  try {
    const mammoth = await import("mammoth").then((m) => m.default ?? m);
    const result = await mammoth.extractRawText({ buffer });
    return extractNamedField(result.value, [
      "prepared for",
      "attention",
      "attn",
      "submitted to",
      "proposal to",
      "bid to",
      "owner",
      "customer",
      "recipient",
      "to",
    ]);
  } catch {
    return null;
  }
}

export async function extractProposalFromPdf(buffer: Buffer) {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(buffer));

  const pages = Array.isArray(result.text) ? result.text : [result.text as unknown as string];

  const headerPattern =
    /^HVAC CONTROLS INSTALLATION PROPOSAL\s*\nPage \d+ of \d+\s*\nThe Controls Company\s*\n[^\n]*\nTel:[^\n]*\n/im;

  const cleaned = pages
    .map((page) => page.replace(headerPattern, "").trim())
    .filter(Boolean)
    .join("\n");

  return extractProposalFromText(cleaned);
}

export async function extractEstimateFromWorkbook(buffer: Buffer): Promise<EstimateExtractionResult> {
  const ExcelJS = await import("exceljs").then((m) => m.default ?? m);
  const workbook = new ExcelJS.Workbook();
  const workbookBytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const workbookInput: any = Buffer.from(workbookBytes as ArrayBuffer);
  await workbook.xlsx.load(workbookInput);

  const worksheet =
    workbook.worksheets.find((sheet) => sheet.name.trim().toLowerCase() === "summary") ??
    workbook.worksheets[0];

  const labels = collectWorksheetLabels(worksheet);
  const valueOf = (col: "c" | "d", ...keys: string[]): number | null => {
    for (const key of keys) {
      const entry = labels.get(key);
      if (!entry) continue;
      return entry[col] ?? entry[col === "c" ? "d" : "c"] ?? null;
    }
    return null;
  };
  // Row 19 col C (index 3) is "Total labor hrs." on the EBT Summary sheet.
  const laborHoursC19 = worksheet ? coerceNumber(worksheet.getRow(19).getCell(3).value) : null;

  return {
    legacy_import_row_id: null,
    source_document_id: null,
    source_sheet_name: worksheet?.name ?? "Summary",

    labor_hours_total: laborHoursC19,
    labor_cost_total: valueOf("d", "total labor cost"),

    material_cost_total: valueOf("d", "total material"),

    direct_indirect_cost_total: valueOf("d", "total direct indirect costs", "total direct  indirect costs", "total direct / indirect costs"),

    total_cost: valueOf("c", "total"),

    overhead_rate: valueOf("c", "overhead"),
    overhead_value: valueOf("d", "overhead"),
    profit_rate: valueOf("c", "profit"),
    profit_value: valueOf("d", "profit"),
    vendor_fee_rate: valueOf("c", "vendor fee for quickpay", "vendor fee"),
    vendor_fee_value: valueOf("d", "vendor fee for quickpay", "vendor fee"),

    base_bid_amount: valueOf("d", "installation budget price", "base bid"),
    bond_amount: valueOf("d", "p p bond", "bond"),
    final_total_amount: valueOf("d", "total"),

    extracted_json: Object.fromEntries(
      Array.from(labels.entries()).map(([k, v]) => [k, v.d ?? v.c])
    ),
  };
}

export function extractProposalFromText(rawText: string): ProposalExtractionResult {
  const text = normalizeWhitespace(rawText);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const { items: pricingItems, baseBidAmount } = extractPricingItems(lines);

  return {
    proposalDate: extractDateValue(text),
    customerName: extractNamedField(text, [
      "prepared for",
      "attention",
      "attn",
      "submitted to",
      "proposal to",
      "bid to",
      "owner",
      "customer",
      "recipient",
      "to",
    ]),
    // "re" removed — too broad, matches "References:" before "Project:" in many docs
    projectName: extractNamedField(text, ["project", "job"]),
    baseBidAmount,
    pricingItems,
    scopeItems: extractScopeItems(lines),
    equipmentGroups: extractEquipmentGroups(lines),
    extractedText: text,
  };
}

export function buildLegacyImportFolderName(companyName: string | null, opportunityName: string | null, batchId: string, sourceRowNumber: number) {
  const company = sanitizePathSegment(companyName || "Unknown Company");
  const opportunity = sanitizePathSegment(opportunityName || "Legacy Opportunity");
  const legacyNumber = `QR-LEGACY-${batchId.slice(0, 6).toUpperCase()}-${String(sourceRowNumber).padStart(3, "0")}`;
  return `${legacyNumber} - ${company} - ${opportunity}`;
}

export const LEGACY_IMPORT_SUBFOLDERS = [
  "01 Customer Uploads",
  "02 Internal Review",
  "03 Estimate Working",
  "04 Submitted Quote",
  "99 Archive - Legacy Files",
];

export function getDocumentDestinationSubfolder(role: "proposal_docx" | "proposal_pdf" | "estimate_xlsm") {
  if (role === "proposal_pdf") return "04 Submitted Quote";
  return "03 Estimate Working";
}

function collectWorksheetLabels(worksheet: ExcelJS.Worksheet | undefined) {
  const labels = new Map<string, { c: number | null; d: number | null }>();
  if (!worksheet) return labels;

  worksheet.eachRow((row) => {
    const labelCell = row.getCell(2);
    if (typeof labelCell.value !== "string") return;
    const label = normalizeLabel(labelCell.value);
    if (!label) return;

    const c = coerceNumber(row.getCell(3).value);
    const d = coerceNumber(row.getCell(4).value);

    if (c !== null || d !== null) {
      labels.set(label, { c, d });
    }
  });

  return labels;
}

// Parses the PRICING SUMMARY table from a TCC proposal.
// Mammoth extracts Word tables as separate lines, so the format is:
//   Base Bid          ← label line
//   US $ 31,369       ← value line
// Both same-line ("Base Bid  US $ 31,369") and two-line formats are handled.
function extractPricingItems(lines: string[]): { items: Omit<OpportunityPricingItem, "id">[]; baseBidAmount: number | null } {
  const items: Omit<OpportunityPricingItem, "id">[] = [];
  let baseBidAmount: number | null = null;

  // Narrow to the PRICING SUMMARY section so we don't match dollar amounts in scope/clarifications.
  const pricingStart = lines.findIndex((l) =>
    /pricing\s*summary/i.test(l) ||
    /proposal\s*summary/i.test(l) ||
    /bid\s*summary/i.test(l) ||
    /price\s*summary/i.test(l)
  );
  const scopeStart = lines.findIndex((l) => /^for the following scope/i.test(l));
  const pricingLines =
    pricingStart >= 0
      ? lines.slice(pricingStart + 1, scopeStart > pricingStart ? scopeStart : undefined)
      : lines;

  // Regex that matches a US dollar value, with or without "US $" prefix.
  const dollarValue = /^(?:US\s*)?\$\s*([\d,\s]+(?:\.\d{2})?)\s*$|^([\d,]+\.\d{2})\s*$/i;
  // Skip column-header rows that mammoth emits from the table header.
  const isHeader = (l: string) => /^description$/i.test(l) || /^total\s+price$/i.test(l);

  for (let i = 0; i < pricingLines.length; i++) {
    const line = pricingLines[i];
    if (isHeader(line)) continue;

    // Matches both DOCX multi-space and PDF single-space formats.
    // Anchors on "US $" or standalone "$" to avoid splitting label mid-word.
    const sameLine =
      line.match(/^(.+?)\s+US\s*\$\s*([\d,\s]+(?:\.\d{2})?)\s*$/i) ??
      line.match(/^(.+?)\s{2,}\$\s*([\d,\s]+(?:\.\d{2})?)\s*$/i) ??
      line.match(/^(.+?)\s+\$([\d,]+(?:\.\d{2})?)\s*$/i);
    if (sameLine) {
      const label = sameLine[1].trim();
      const amount = coerceNumber(sameLine[2].replace(/\s/g, ""));
      if (label && amount !== null) {
        const entry = buildPricingEntry(label, amount, i);
        if (entry.item_type === "base_bid") baseBidAmount = amount;
        items.push(entry);
        continue;
      }
    }

    // Two-line: label on this line, "US $ X" on the next.
    const nextLine = (pricingLines[i + 1] ?? "").trim();
    const nextMatch = nextLine.match(dollarValue);
    if (nextMatch && line.length > 0 && !isHeader(line)) {
      const label = line.trim();
      const amount = coerceNumber((nextMatch[1] ?? nextMatch[2] ?? "").replace(/\s/g, ""));
      if (label && amount !== null) {
        const entry = buildPricingEntry(label, amount, i);
        if (entry.item_type === "base_bid") baseBidAmount = amount;
        items.push(entry);
        i++; // consume the value line
        continue;
      }
    }
  }

  // Last-resort: if no base bid found via section, scan all lines
  if (baseBidAmount === null) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/base\s*bid/i.test(line)) continue;

      const sameLineMatch =
        line.match(/base\s*bid.*?US\s*\$\s*([\d,\s]+(?:\.\d{2})?)/i) ??
        line.match(/base\s*bid.*?\$\s*([\d,]+(?:\.\d{2})?)/i);
      if (sameLineMatch) {
        baseBidAmount = coerceNumber((sameLineMatch[1] ?? "").replace(/\s/g, ""));
        if (baseBidAmount !== null) break;
      }

      const nextLine = (lines[i + 1] ?? "").trim();
      const nextMatch =
        nextLine.match(/^(?:US\s*)?\$\s*([\d,\s]+(?:\.\d{2})?)\s*$/) ??
        nextLine.match(/^([\d,]+\.\d{2})$/);
      if (nextMatch) {
        baseBidAmount = coerceNumber((nextMatch[1] ?? nextMatch[2] ?? "").replace(/\s/g, ""));
        if (baseBidAmount !== null) break;
      }
    }
  }

  return { items: dedupeByLabel(items), baseBidAmount };
}

function buildPricingEntry(label: string, amount: number, sortOrder: number): Omit<OpportunityPricingItem, "id"> {
  const lower = label.toLowerCase();
  const item_type =
    lower.includes("base bid") ? "base_bid" :
    lower.includes("bond")     ? "bond" :
    lower.includes("alternate")? "alternate" :
    lower.includes("deduct")   ? "deduct" :
    lower.includes("allowance")? "allowance" :
    lower.includes("vendor fee")? "vendor_fee" : "other";

  return {
    legacy_import_row_id: null,
    source_document_id: null,
    label,
    amount,
    item_type,
    is_conditional: lower.includes("alternate") || lower.includes("deduct") || lower.includes("if required"),
    included_in_base: item_type === "base_bid",
    notes: null,
    sort_order: sortOrder,
  };
}

// Extracts scope, clarification, exclusion, and warranty sections using
// section-boundary detection rather than keyword scatter.  Each section
// header marks the start; the next header (or end of document) marks the end.
function extractScopeItems(lines: string[]): Omit<OpportunityScopeItem, "id">[] {
  type SectionType = "scope" | "clarification" | "exclusion" | "warranty" | "reference";

  const SECTION_HEADERS: { pattern: RegExp; type: SectionType; heading: string }[] = [
    { pattern: /^for the following scope/i,  type: "scope",         heading: "SCOPE" },
    { pattern: /^scope of work/i,            type: "scope",         heading: "SCOPE" },
    { pattern: /^scope/i,                    type: "scope",         heading: "SCOPE" },
    { pattern: /^clarification/i,            type: "clarification", heading: "CLARIFICATIONS" },
    { pattern: /^exclusion/i,                type: "exclusion",     heading: "EXCLUSIONS" },
    { pattern: /^warranty/i,                 type: "warranty",      heading: "WARRANTY" },
    // "reference" section intentionally omitted - document citations are not useful.
  ];

  // Build a list of section start indices.
  const sections: { start: number; type: SectionType; heading: string }[] = [];
  lines.forEach((line, i) => {
    for (const def of SECTION_HEADERS) {
      if (def.pattern.test(line)) {
        sections.push({ start: i, type: def.type, heading: def.heading });
        break;
      }
    }
  });

  if (sections.length === 0) {
    return lines.length
      ? [{ legacy_import_row_id: null, source_document_id: null, section_type: "scope", heading: "SUMMARY", body: lines.slice(0, 5).join(" "), sort_order: 0 }]
      : [];
  }

  const items: Omit<OpportunityScopeItem, "id">[] = [];

  sections.forEach((section, sectionIndex) => {
    const end = sections[sectionIndex + 1]?.start ?? lines.length;
    // Skip the header line itself (start + 1), take up to 20 body lines.
    const bodyLines = lines
      .slice(section.start + 1, end)
      .filter((l) => l.length > 4) // skip trivial lines
      .slice(0, 20);

    bodyLines.forEach((body, lineIndex) => {
      items.push({
        legacy_import_row_id: null,
        source_document_id: null,
        section_type: section.type,
        heading: section.heading,
        body,
        sort_order: sectionIndex * 100 + lineIndex,
      });
    });
  });

  return items;
}

function extractEquipmentGroups(lines: string[]): Omit<OpportunityEquipmentGroup, "id">[] {
  const groups: Omit<OpportunityEquipmentGroup, "id">[] = [];

  lines.forEach((line, index) => {
    const quantityMatch = line.match(/\((\d+)\)\s+(.+?)(?:tag[:\s]+(.+))?$/i);
    if (!quantityMatch) return;

    groups.push({
      legacy_import_row_id: null,
      source_document_id: null,
      system_label: quantityMatch[2]?.trim() ?? line,
      quantity: Number(quantityMatch[1]),
      control_type: /non-ddc/i.test(line) ? "non-ddc" : /ddc/i.test(line) ? "ddc" : null,
      tag_text: quantityMatch[3]?.trim() ?? extractTagText(line),
      notes: null,
      sort_order: index,
    });
  });

  return groups;
}

function extractNamedField(text: string, labels: string[]) {
  for (const label of labels) {
    const inlinePattern = new RegExp(`${label}\\s*[:\\-]\\s*(.+)`, "i");
    const inlineMatch = text.match(inlinePattern);
    if (inlineMatch?.[1]?.trim()) {
      return inlineMatch[1].split("\n")[0]?.trim() ?? null;
    }

    const nextLinePattern = new RegExp(
      `^${label}\\s*[:\\-]?\\s*$\\n+^([^\\n]+)`,
      "im"
    );
    const nextLineMatch = text.match(nextLinePattern);
    if (nextLineMatch?.[1]?.trim()) {
      return nextLineMatch[1].trim();
    }
  }

  return null;
}

function extractDateValue(text: string) {
  const labeled = text.match(/(?:proposal date|date)\s*[:\-]\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (labeled?.[1]) {
    return normalizeDateString(labeled[1]);
  }

  const fallback = text.match(/\b([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
  return fallback?.[1] ? normalizeDateString(fallback[1]) : null;
}

function normalizeDateString(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function extractTagText(line: string) {
  const match = line.match(/tag[:\s]+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\r/g, "").replace(/\t/g, " ").replace(/[ ]{2,}/g, " ");
}

function normalizeLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[%:$]/g, "")
    .replace(/[^\w\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizePathSegment(value: string) {
  return value.replace(/[\\/:*?"<>|#%&{}~]+/g, "").replace(/\s+/g, " ").trim();
}

function coerceNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object" && value && "result" in value) {
    return coerceNumber((value as { result?: unknown }).result);
  }
  if (typeof value !== "string") return null;

  const cleaned = value.replace(/[$,%]/g, "").replace(/,/g, "").trim();
  if (!cleaned) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function dedupeByLabel(items: Omit<OpportunityPricingItem, "id">[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.label.toLowerCase()}-${item.amount ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

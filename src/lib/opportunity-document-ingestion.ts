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

export async function extractProposalFromPdf(buffer: Buffer) {
  const { extractText } = await import("unpdf");
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  return extractProposalFromText(text);
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
  const valueOf = (...keys: string[]) => {
    for (const key of keys) {
      const value = labels.get(key);
      if (value !== undefined) return value;
    }
    return null;
  };

  return {
    legacy_import_row_id: null,
    source_document_id: null,
    source_sheet_name: worksheet?.name ?? "Summary",
    labor_hours_total: valueOf("labor hours total", "labor hours"),
    labor_cost_total: valueOf("labor cost total", "labor cost"),
    material_cost_total: valueOf("material cost total", "material cost"),
    direct_indirect_cost_total: valueOf("direct indirect cost total", "direct / indirect cost", "direct and indirect cost"),
    total_cost: valueOf("total cost"),
    overhead_rate: valueOf("overhead rate"),
    overhead_value: valueOf("overhead value", "overhead"),
    profit_rate: valueOf("profit rate"),
    profit_value: valueOf("profit value", "profit"),
    vendor_fee_rate: valueOf("vendor fee rate"),
    vendor_fee_value: valueOf("vendor fee value", "vendor fee"),
    base_bid_amount: valueOf("base bid amount", "base bid", "marked up value"),
    bond_amount: valueOf("bond amount", "bond"),
    final_total_amount: valueOf("final total amount", "final total"),
    extracted_json: Object.fromEntries(labels.entries()),
  };
}

export function extractProposalFromText(rawText: string): ProposalExtractionResult {
  const text = normalizeWhitespace(rawText);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    proposalDate: extractDateValue(text),
    customerName: extractNamedField(text, ["customer", "recipient", "to"]),
    projectName: extractNamedField(text, ["project", "job", "re"]),
    pricingItems: extractPricingItems(lines),
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
  const labels = new Map<string, number>();
  if (!worksheet) return labels;

  worksheet.eachRow((row) => {
    row.eachCell((cell, colNumber) => {
      if (typeof cell.value !== "string") return;
      const label = normalizeLabel(cell.value);
      if (!label) return;

      const rightValue = row.getCell(colNumber + 1).value;
      const parsed = coerceNumber(rightValue);
      if (parsed !== null) {
        labels.set(label, parsed);
      }
    });
  });

  return labels;
}

function extractPricingItems(lines: string[]): Omit<OpportunityPricingItem, "id">[] {
  const items: Omit<OpportunityPricingItem, "id">[] = [];

  lines.forEach((line, index) => {
    const match = line.match(/^(.*?)(\$[\d,]+(?:\.\d{2})?|\d[\d,]*(?:\.\d{2})?)$/);
    if (!match) return;

    const label = match[1].trim().replace(/[:.-]+$/, "");
    const amount = coerceNumber(match[2]);
    if (!label || amount === null) return;

    const lower = label.toLowerCase();
    const item_type =
      lower.includes("base bid")
        ? "base_bid"
        : lower.includes("bond")
          ? "bond"
          : lower.includes("alternate")
            ? "alternate"
            : lower.includes("deduct")
              ? "deduct"
              : lower.includes("allowance")
                ? "allowance"
                : lower.includes("vendor fee")
                  ? "vendor_fee"
                  : "other";

    items.push({
      legacy_import_row_id: null,
      source_document_id: null,
      label,
      amount,
      item_type,
      is_conditional: lower.includes("alternate") || lower.includes("deduct"),
      included_in_base: item_type === "base_bid",
      notes: null,
      sort_order: index,
    });
  });

  return dedupeByLabel(items);
}

function extractScopeItems(lines: string[]): Omit<OpportunityScopeItem, "id">[] {
  const sections = [
    { section_type: "scope", heading: "scope" },
    { section_type: "clarification", heading: "clarification" },
    { section_type: "exclusion", heading: "exclusion" },
    { section_type: "warranty", heading: "warranty" },
    { section_type: "reference", heading: "reference" },
  ] as const;

  const items: Omit<OpportunityScopeItem, "id">[] = [];

  sections.forEach((section, sectionIndex) => {
    const matchingLines = lines
      .filter((line) => line.toLowerCase().includes(section.heading))
      .slice(0, 6);

    matchingLines.forEach((line, index) => {
      items.push({
        legacy_import_row_id: null,
        source_document_id: null,
        section_type: section.section_type,
        heading: section.heading.toUpperCase(),
        body: line,
        sort_order: sectionIndex * 10 + index,
      });
    });
  });

  if (items.length === 0 && lines.length) {
    items.push({
      legacy_import_row_id: null,
      source_document_id: null,
      section_type: "scope",
      heading: "SUMMARY",
      body: lines.slice(0, 5).join(" "),
      sort_order: 0,
    });
  }

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
    const pattern = new RegExp(`${label}\\s*[:\\-]\\s*(.+)`, "i");
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].split("\n")[0]?.trim() ?? null;
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

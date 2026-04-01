import ExcelJS from "exceljs";

export type ParsedPocImportRow = {
  category: string;
  weight: number;
  pctComplete: number;
  contribution: number;
  sourceRow: number;
  sourceFormula: string | null;
};

export type ParsedPocImportResult = {
  worksheetName: string;
  rows: ParsedPocImportRow[];
  totalWeight: number;
  overallPct: number;
};

function getCellText(value: ExcelJS.CellValue | undefined | null): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value && value.result != null) return getCellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
  }
  return String(value).trim();
}

function getCellNumber(value: ExcelJS.CellValue | undefined | null): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && "result" in value && value.result != null) {
    return getCellNumber(value.result as ExcelJS.CellValue);
  }
  return null;
}

function getCellFormula(value: ExcelJS.CellValue | undefined | null): string | null {
  if (value && typeof value === "object" && "formula" in value && typeof value.formula === "string") {
    return value.formula;
  }
  return null;
}

function extractWeightFromFormula(formula: string | null, categoryRow: number): number | null {
  if (!formula) return null;

  const normalized = formula.replace(/\s+/g, "").replace(/^=/, "");
  const directPattern = new RegExp(`D${categoryRow}\\*(\\d+(?:\\.\\d+)?)`, "i");
  const reversePattern = new RegExp(`(\\d+(?:\\.\\d+)?)\\*D${categoryRow}`, "i");

  const directMatch = normalized.match(directPattern);
  if (directMatch) {
    const weight = Number(directMatch[1]);
    return Number.isFinite(weight) ? weight : null;
  }

  const reverseMatch = normalized.match(reversePattern);
  if (reverseMatch) {
    const weight = Number(reverseMatch[1]);
    return Number.isFinite(weight) ? weight : null;
  }

  return null;
}

export async function parsePocWorkbook(buffer: Buffer): Promise<ParsedPocImportResult> {
  const workbook = new ExcelJS.Workbook();
  const loadedWorkbook = await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = loadedWorkbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Workbook has no worksheets.");
  }

  const rows: ParsedPocImportRow[] = [];

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const category = getCellText(worksheet.getRow(rowNumber).getCell(2).value);
    const pctComplete = getCellNumber(worksheet.getRow(rowNumber).getCell(4).value);

    if (!category || pctComplete === null || pctComplete < 0 || pctComplete > 1) {
      continue;
    }

    let weight: number | null = null;
    let contribution: number | null = null;
    let sourceFormula: string | null = null;

    for (let formulaRow = 1; formulaRow <= worksheet.rowCount; formulaRow += 1) {
      const formulaCell = worksheet.getRow(formulaRow).getCell(4);
      const formula = getCellFormula(formulaCell.value);
      const extractedWeight = extractWeightFromFormula(formula, rowNumber);

      if (extractedWeight === null) {
        continue;
      }

      weight = extractedWeight;
      contribution = getCellNumber(formulaCell.value) ?? pctComplete * extractedWeight;
      sourceFormula = formula;
      break;
    }

    if (weight === null) {
      continue;
    }

    rows.push({
      category,
      weight,
      pctComplete,
      contribution: contribution ?? pctComplete * weight,
      sourceRow: rowNumber,
      sourceFormula,
    });
  }

  if (rows.length === 0) {
    throw new Error("No recognizable POC categories were found in this workbook.");
  }

  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  const overallPct = totalWeight > 0
    ? rows.reduce((sum, row) => sum + row.weight * row.pctComplete, 0) / totalWeight
    : 0;

  return {
    worksheetName: worksheet.name,
    rows,
    totalWeight,
    overallPct,
  };
}

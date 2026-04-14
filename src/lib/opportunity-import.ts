export type InferredOpportunityField =
  | "opportunity_name"
  | "company_name"
  | "contact_name"
  | "job_number"
  | "project_location"
  | "bid_date"
  | "proposal_date"
  | "amount"
  | "status"
  | "estimator_name"
  | "notes";

export type ParsedImportPreview = {
  delimiter: "comma" | "tab";
  headers: string[];
  rows: string[][];
};

export type NormalizedImportPreviewRow = {
  row_number: number;
  opportunity_name: string;
  company_name: string;
  contact_name: string;
  job_number: string;
  project_location: string;
  bid_date: string;
  proposal_date: string;
  amount: string;
  status: string;
  estimator_name: string;
  notes: string;
  issues: string[];
};

export const OPPORTUNITY_IMPORT_FIELD_LABELS: Record<InferredOpportunityField, string> = {
  opportunity_name: "Opportunity / project name",
  company_name: "Company / customer",
  contact_name: "Contact",
  job_number: "Job number",
  project_location: "Location",
  bid_date: "Bid date",
  proposal_date: "Proposal date",
  amount: "Amount",
  status: "Status",
  estimator_name: "Estimator",
  notes: "Notes",
};

const FIELD_PATTERNS: Record<InferredOpportunityField, RegExp[]> = {
  opportunity_name: [/opportunity/i, /project/i, /description/i, /job name/i],
  company_name: [/company/i, /customer/i, /vendor/i, /contractor/i, /account/i],
  contact_name: [/contact/i, /attention/i],
  job_number: [/job number/i, /project number/i, /^job$/i, /^project no/i],
  project_location: [/location/i, /site/i, /address/i, /city/i],
  bid_date: [/bid date/i, /^bid$/i],
  proposal_date: [/proposal date/i, /quote date/i, /submitted/i],
  amount: [/amount/i, /value/i, /price/i, /bid amount/i, /contract/i],
  status: [/status/i, /outcome/i, /result/i],
  estimator_name: [/estimator/i, /sales/i, /assigned/i],
  notes: [/notes/i, /remarks/i, /comment/i],
};

export function parseDelimitedText(text: string): ParsedImportPreview {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (!lines.length) {
    return { delimiter: "comma", headers: [], rows: [] };
  }

  const tabCount = (lines[0].match(/\t/g) ?? []).length;
  const commaCount = (lines[0].match(/,/g) ?? []).length;
  const delimiter = tabCount > commaCount ? "tab" : "comma";
  const separator = delimiter === "tab" ? "\t" : ",";

  const parsed = lines.map((line) => parseCsvLine(line, separator));
  const headers = parsed[0]?.map((value) => value.trim()) ?? [];
  const rows = parsed.slice(1).filter((row) => row.some((value) => value.trim().length > 0));

  return { delimiter, headers, rows };
}

export function inferImportMapping(headers: string[]) {
  const inferred = new Map<InferredOpportunityField, string>();

  for (const header of headers) {
    for (const [field, patterns] of Object.entries(FIELD_PATTERNS) as Array<[InferredOpportunityField, RegExp[]]>) {
      if (inferred.has(field)) continue;
      if (patterns.some((pattern) => pattern.test(header))) {
        inferred.set(field, header);
      }
    }
  }

  return inferred;
}

export function buildNormalizedPreview(preview: ParsedImportPreview, maxRows = 8): NormalizedImportPreviewRow[] {
  const mapping = inferImportMapping(preview.headers);

  return preview.rows.slice(0, maxRows).map((row, index) => {
    const record = createMappedRecord(preview.headers, row, mapping);
    return {
      row_number: index + 2,
      ...record,
      issues: buildRowIssues(record),
    };
  });
}

export function createMappedRecord(
  headers: string[],
  row: string[],
  mapping: Map<InferredOpportunityField, string>
) {
  const record: Record<InferredOpportunityField, string> = {
    opportunity_name: "",
    company_name: "",
    contact_name: "",
    job_number: "",
    project_location: "",
    bid_date: "",
    proposal_date: "",
    amount: "",
    status: "",
    estimator_name: "",
    notes: "",
  };

  for (const [field, header] of mapping.entries()) {
    const columnIndex = headers.indexOf(header);
    record[field] = columnIndex >= 0 ? row[columnIndex]?.trim() ?? "" : "";
  }

  return record;
}

export function buildRowIssues(record: Record<InferredOpportunityField, string>) {
  const issues: string[] = [];

  if (!record.opportunity_name) issues.push("Missing opportunity name");
  if (!record.company_name) issues.push("Missing company");
  if (!record.amount) issues.push("No amount");

  return issues;
}

function parseCsvLine(line: string, separator: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === separator) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

"use client";

import { useMemo, useState } from "react";

type ParsedImportPreview = {
  delimiter: "comma" | "tab";
  headers: string[];
  rows: string[][];
};

type InferredField =
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

const FIELD_LABELS: Record<InferredField, string> = {
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

const FIELD_PATTERNS: Record<InferredField, RegExp[]> = {
  opportunity_name: [/opportunity/i, /project/i, /description/i, /job name/i],
  company_name: [/company/i, /customer/i, /vendor/i, /contractor/i, /account/i],
  contact_name: [/contact/i, /attention/i],
  job_number: [/job/i, /project number/i, /job number/i],
  project_location: [/location/i, /site/i, /address/i, /city/i],
  bid_date: [/bid date/i, /^bid$/i],
  proposal_date: [/proposal date/i, /quote date/i, /submitted/i],
  amount: [/amount/i, /value/i, /price/i, /bid/i, /contract/i],
  status: [/status/i, /outcome/i, /result/i],
  estimator_name: [/estimator/i, /sales/i, /assigned/i],
  notes: [/notes/i, /remarks/i, /comment/i],
};

export function LegacyOpportunityImportWorkspace() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mapping = useMemo(() => {
    if (!preview) return null;

    const inferred = new Map<InferredField, string>();

    for (const header of preview.headers) {
      for (const [field, patterns] of Object.entries(FIELD_PATTERNS) as Array<[InferredField, RegExp[]]>) {
        if (inferred.has(field)) continue;
        if (patterns.some((pattern) => pattern.test(header))) {
          inferred.set(field, header);
        }
      }
    }

    return inferred;
  }, [preview]);

  const normalizedPreview = useMemo(() => {
    if (!preview || !mapping) return [];

    return preview.rows.slice(0, 8).map((row, index) => {
      const record: Record<string, string> = { row_number: String(index + 2) };

      for (const [field, header] of mapping.entries()) {
        const columnIndex = preview.headers.indexOf(header);
        record[field] = columnIndex >= 0 ? row[columnIndex] ?? "" : "";
      }

      record.issues = buildRowIssues(record).join(", ") || "Looks good";
      return record;
    });
  }, [mapping, preview]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    try {
      const text = await file.text();
      const parsed = parseDelimitedText(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        throw new Error("The file needs a header row and at least one data row.");
      }

      setPreview(parsed);
    } catch (uploadError) {
      setPreview(null);
      setError(uploadError instanceof Error ? uploadError.message : "Unable to parse import file.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Opportunity Hub</p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">Legacy Import Workspace</h1>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          This workspace safely previews old opportunity exports before anything gets staged. It’s designed for the next slice of the roadmap where legacy rows flow into review tables and get matched to active projects or existing pursuits.
        </p>
      </div>

      <div className="rounded-2xl border border-border-default bg-surface-raised p-6">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border-default bg-surface-base px-6 py-10 text-center transition hover:border-brand-primary/50">
          <span className="text-sm font-semibold text-text-primary">Drop a legacy CSV here or click to browse</span>
          <span className="mt-2 text-sm text-text-secondary">The preview works with comma-separated or tab-separated exports.</span>
          <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFileChange} />
        </label>

        {fileName ? (
          <p className="mt-4 text-sm text-text-secondary">
            Loaded file: <span className="font-medium text-text-primary">{fileName}</span>
          </p>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
            {error}
          </div>
        ) : null}
      </div>

      {preview ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Headers found" value={String(preview.headers.length)} />
            <StatCard label="Rows parsed" value={String(preview.rows.length)} />
            <StatCard label="Delimiter" value={preview.delimiter === "tab" ? "Tab" : "Comma"} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="rounded-2xl border border-border-default bg-surface-raised p-6">
              <h2 className="text-lg font-semibold text-text-primary">Detected Mapping</h2>
              <p className="mt-1 text-sm text-text-secondary">
                These are the best guesses based on your header names. The next implementation slice can turn this into explicit import mapping before staging.
              </p>

              <div className="mt-5 space-y-3">
                {(Object.keys(FIELD_LABELS) as InferredField[]).map((field) => (
                  <div key={field} className="flex items-center justify-between rounded-xl border border-border-default bg-surface-base px-4 py-3">
                    <span className="text-sm text-text-secondary">{FIELD_LABELS[field]}</span>
                    <span className="text-sm font-medium text-text-primary">{mapping?.get(field) ?? "Not detected"}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border-default bg-surface-raised p-6">
              <h2 className="text-lg font-semibold text-text-primary">Normalized Preview</h2>
              <p className="mt-1 text-sm text-text-secondary">
                First few rows mapped into the fields we care about for matching and promotion.
              </p>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-border-default text-left text-xs uppercase tracking-wide text-text-tertiary">
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Opportunity</th>
                      <th className="px-3 py-2">Company</th>
                      <th className="px-3 py-2">Job #</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedPreview.map((row) => (
                      <tr key={row.row_number} className="border-b border-border-default last:border-b-0">
                        <td className="px-3 py-2 text-text-secondary">{row.row_number}</td>
                        <td className="px-3 py-2 text-text-primary">{row.opportunity_name || "-"}</td>
                        <td className="px-3 py-2 text-text-primary">{row.company_name || "-"}</td>
                        <td className="px-3 py-2 text-text-secondary">{row.job_number || "-"}</td>
                        <td className="px-3 py-2 text-text-secondary">{row.amount || "-"}</td>
                        <td className="px-3 py-2 text-text-secondary">{row.issues}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="rounded-2xl border border-border-default bg-surface-raised p-6">
            <h2 className="text-lg font-semibold text-text-primary">What happens next</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <StepCard
                title="1. Stage import rows"
                body="Migration 046 creates the batch and row tables needed to store legacy opportunities safely before they become live records."
              />
              <StepCard
                title="2. Score project matches"
                body="The review queue will compare job number, company, location, and naming similarity against active projects and existing pursuits."
              />
              <StepCard
                title="3. Promote approved rows"
                body="Only reviewed rows get promoted into the live Opportunity Hub so we keep history traceable and avoid duplicate project links."
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function parseDelimitedText(text: string): ParsedImportPreview {
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

function buildRowIssues(record: Record<string, string>) {
  const issues: string[] = [];

  if (!record.opportunity_name) issues.push("Missing opportunity name");
  if (!record.company_name) issues.push("Missing company");
  if (!record.amount) issues.push("No amount");

  return issues;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-raised p-4">
      <p className="text-sm text-text-secondary">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function StepCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border-default bg-surface-base p-4">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="mt-2 text-sm text-text-secondary">{body}</p>
    </div>
  );
}

# Task 080 — Fix PDF and XLSM extraction for legacy opportunity import

## Context

`src/lib/opportunity-document-ingestion.ts` contains three extractors.
The docx extractor was fixed in the previous commit. This task fixes the
remaining two: PDF and XLSM (the EBT electrical budgeting tool).

Both files have been analysed against real samples in `project-resources/`.
All changes are in `src/lib/opportunity-document-ingestion.ts` only unless
noted otherwise. Do not touch any other files.

---

## Part 1 — PDF extraction fix

### Problem

`extractProposalFromPdf` currently calls:

```typescript
const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
```

`mergePages: true` collapses all pages into one space-separated string,
destroying line structure. The pricing table becomes:
`"Base Bid US $ 31,369 Bond (if Required) US $ 1,098"` — all one line.

Without `mergePages`, `extractText` returns `{ text: string[], totalPages: number }`
where each element of `text` is the line-structured content of one page.

Pages 2 and 3 begin with a repeated TCC header block that must be stripped:

```
HVAC CONTROLS INSTALLATION PROPOSAL
Page N of 3
The Controls Company
info@TheControlsCompany.com
Tel: 850-490-1844
```

### Fix — replace `extractProposalFromPdf`

```typescript
export async function extractProposalFromPdf(buffer: Buffer) {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(buffer));

  // result.text is string[] — one element per page.
  const pages = Array.isArray(result.text) ? result.text : [result.text as unknown as string];

  // Strip the repeated TCC header that appears at the top of every page.
  const headerPattern =
    /^HVAC CONTROLS INSTALLATION PROPOSAL\s*\nPage \d+ of \d+\s*\nThe Controls Company\s*\n[^\n]*\nTel:[^\n]*\n/im;

  const cleaned = pages
    .map((page) => page.replace(headerPattern, "").trim())
    .filter(Boolean)
    .join("\n");

  return extractProposalFromText(cleaned);
}
```

### Fix — same-line pricing regex

In `extractPricingItems`, the same-line regex currently requires two or more
spaces before the dollar amount (`\s{2,}`). PDF lines use a single space:
`"Base Bid US $ 31,369"`. Change the same-line pattern from:

```typescript
const sameLine = line.match(/^(.+?)\s{2,}(?:US\s*)?\$\s*([\d,\s]+(?:\.\d{2})?)\s*$/i);
```

to:

```typescript
// Matches both DOCX multi-space and PDF single-space formats.
// Anchors on "US $" or standalone "$" to avoid splitting label mid-word.
const sameLine =
  line.match(/^(.+?)\s+US\s*\$\s*([\d,\s]+(?:\.\d{2})?)\s*$/i) ??
  line.match(/^(.+?)\s{2,}\$\s*([\d,\s]+(?:\.\d{2})?)\s*$/i);
```

The first pattern matches `"Base Bid US $ 31,369"` unambiguously.
The second retains the existing multi-space fallback for bare `$` amounts.

---

## Part 2 — XLSM extraction fix

### Problem

The EBT Summary sheet uses three columns:

| Column | Role |
|--------|------|
| B (col 2) | Label string |
| C (col 3) | Cost basis value (labor hours, rates, component costs) |
| D (col 4) | Sell / markup value (totals, final prices) |

The current `collectWorksheetLabels` only checks `colNumber + 1` (the
immediate next column to the label). For labels in col B, that is col C.
This misses every col D value — so `base_bid_amount`, `bond_amount`,
`final_total_amount`, `labor_cost_total`, `material_cost_total`, and
`direct_indirect_cost_total` all return null.

### Exact values from the sample file

These are the ground-truth values Codex must verify the extractor returns:

| Field | Label in col B | Column | Expected value |
|-------|---------------|--------|----------------|
| `base_bid_amount` | "Installation Budget Price" | D | 31,369 |
| `bond_amount` | "P&P Bond" | D | 1,098 |
| `final_total_amount` | "Total" (last occurrence, R48) | D | 32,467 |
| `labor_hours_total` | "Total labor hrs." | C | 286 |
| `labor_cost_total` | "Total Labor Cost" | D | 12,911 |
| `material_cost_total` | "Total Material" | D | 3,825 |
| `direct_indirect_cost_total` | "Total Direct / Indirect Costs " | D | 5,630 |
| `overhead_rate` | "Overhead" | C | 0.10 |
| `overhead_value` | "Overhead" | D | 2,237 |
| `profit_rate` | "Profit" | C | 0.25 |
| `profit_value` | "Profit" | D | 6,151 |
| `vendor_fee_rate` | "Vendor Fee for QuickPay" | C | 0.02 |
| `vendor_fee_value` | "Vendor Fee for QuickPay" | D | 615 |

Note: "TOTAL" (R40) and "Total" (R48) both normalize to `"total"`.
R48 is the last row so it overwrites R40 in the map — this is correct
because `final_total_amount` should be R48's col D (32,467 with bond included).

### Fix — rewrite `collectWorksheetLabels` and `extractEstimateFromWorkbook`

Replace `collectWorksheetLabels` with a version that captures both columns:

```typescript
function collectWorksheetLabels(worksheet: ExcelJS.Worksheet | undefined) {
  const labels = new Map<string, { c: number | null; d: number | null }>();
  if (!worksheet) return labels;

  worksheet.eachRow((row) => {
    const labelCell = row.getCell(2); // col B
    if (typeof labelCell.value !== "string") return;
    const label = normalizeLabel(labelCell.value);
    if (!label) return;

    const c = coerceNumber(row.getCell(3).value); // col C — cost basis
    const d = coerceNumber(row.getCell(4).value); // col D — sell/markup price

    if (c !== null || d !== null) {
      labels.set(label, { c, d });
    }
  });

  return labels;
}
```

Replace the `valueOf` helper and field mappings inside `extractEstimateFromWorkbook`:

```typescript
// col: which column to prefer; falls back to the other if preferred is null.
const valueOf = (col: "c" | "d", ...keys: string[]): number | null => {
  for (const key of keys) {
    const entry = labels.get(key);
    if (!entry) continue;
    return entry[col] ?? entry[col === "c" ? "d" : "c"] ?? null;
  }
  return null;
};

return {
  legacy_import_row_id: null,
  source_document_id: null,
  source_sheet_name: worksheet?.name ?? "Summary",

  // Labor
  labor_hours_total:          valueOf("c", "total labor hrs", "total labor hours"),
  labor_cost_total:           valueOf("d", "total labor cost"),

  // Material
  material_cost_total:        valueOf("d", "total material"),

  // Direct / indirect
  direct_indirect_cost_total: valueOf("d",
    "total direct indirect costs",
    "total direct  indirect costs",   // extra space variant
    "total direct / indirect costs",
  ),

  // Summary totals
  total_cost:                 valueOf("c", "total"),  // R40 TOTAL — pre-markup cost

  // Rates (small decimals in col C)
  overhead_rate:              valueOf("c", "overhead"),
  overhead_value:             valueOf("d", "overhead"),
  profit_rate:                valueOf("c", "profit"),
  profit_value:               valueOf("d", "profit"),
  vendor_fee_rate:            valueOf("c", "vendor fee for quickpay", "vendor fee"),
  vendor_fee_value:           valueOf("d", "vendor fee for quickpay", "vendor fee"),

  // Final amounts (col D sell prices)
  base_bid_amount:            valueOf("d", "installation budget price", "base bid"),
  bond_amount:                valueOf("d", "p p bond", "bond"),
  final_total_amount:         valueOf("d", "total"),  // R48 Total — with bond

  extracted_json: Object.fromEntries(
    Array.from(labels.entries()).map(([k, v]) => [k, v.d ?? v.c])
  ),
};
```

**Important:** `total_cost` and `final_total_amount` both look up `"total"`.
The map holds only the last occurrence (R48), so `total_cost` will return
the R48 col C value (null) and fall back to col D (32,467). That is
acceptable — `total_cost` is a best-effort field. `final_total_amount`
correctly resolves to 32,467. If this behaviour needs to change later,
store all occurrences; for now this is correct.

---

## Step-by-step instructions for Codex

1. Open `src/lib/opportunity-document-ingestion.ts`.

2. Apply the `extractProposalFromPdf` replacement from Part 1.

3. Apply the same-line pricing regex change from Part 1.

4. Apply the `collectWorksheetLabels` replacement from Part 2.

5. Apply the `valueOf` + field mapping replacement inside
   `extractEstimateFromWorkbook` from Part 2.

6. Run `npm run build` from `tcc-projecthub/`. Fix any TypeScript errors
   (the return type of `collectWorksheetLabels` changed — update the
   call-site type annotation for `labels` if the compiler complains).

7. Run a quick smoke-test to verify XLSM values using Node.js:

   ```
   node -e "
   const ExcelJS = require('./node_modules/exceljs');
   const fs = require('fs');
   const wb = new ExcelJS.Workbook();
   wb.xlsx.load(fs.readFileSync('project-resources/Electrical Budgeting Tool v15.xlsm')).then(() => {
     const s = wb.getWorksheet('Summary');
     [[44,'D',31369],[47,'D',1098],[48,'D',32467],[19,'C',286],[25,'D',12911]].forEach(([r,col,expect]) => {
       const colIdx = col === 'C' ? 3 : 4;
       const v = s.getRow(r).getCell(colIdx).value;
       const actual = (v && typeof v === 'object' && 'result' in v) ? v.result : v;
       console.log('R'+r+col, Math.round(actual), expect === Math.round(actual) ? 'OK' : 'FAIL expected '+expect);
     });
   });
   "
   ```

   All five lines should print `OK`.

8. Commit with message:
   `Fix PDF and XLSM extraction — unpdf page array, dual-column EBT mapping`

9. Push to origin main.

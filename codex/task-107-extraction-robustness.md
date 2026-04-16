# Task 107 — Broaden proposal document extraction

## Problem

`extractProposalFromText` in `src/lib/opportunity-document-ingestion.ts` uses
narrow patterns that miss common variations in TCC's proposal documents:

1. **Customer name** only matches `customer:`, `recipient:`, `to:` — misses
   `Prepared For:`, `Attention:`, `ATTN:`, `Submitted To:`, `Proposal To:`, `Owner:`
2. **Base bid** requires a `PRICING SUMMARY` section header and `US $ X,XXX`
   format — misses `PROPOSAL SUMMARY`, `BID SUMMARY`, plain `$31,369` format,
   and tables where "Base Bid" appears without the section header

---

## Fix 1 — Broaden customer name lookup

**File: `src/lib/opportunity-document-ingestion.ts`**

In `extractProposalFromText`, change:

```typescript
customerName: extractNamedField(text, ["customer", "recipient", "to"]),
```

To:

```typescript
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
```

Also update `extractCompanyNameFromDocx` to use the same expanded list:

```typescript
return extractNamedField(result.value, [
  "prepared for", "attention", "attn", "submitted to", "proposal to",
  "bid to", "owner", "customer", "recipient", "to",
]);
```

---

## Fix 2 — Broaden pricing section detection and dollar formats

**File: `src/lib/opportunity-document-ingestion.ts`**

In `extractPricingItems`, change the section-narrowing block:

```typescript
// Before:
const pricingStart = lines.findIndex((l) => /pricing\s*summary/i.test(l));

// After:
const pricingStart = lines.findIndex((l) =>
  /pricing\s*summary/i.test(l) ||
  /proposal\s*summary/i.test(l) ||
  /bid\s*summary/i.test(l) ||
  /price\s*summary/i.test(l)
);
```

Also add a third same-line dollar pattern that handles `$31,369` (no space, no
`US`):

```typescript
// After the two existing sameLine patterns, add:
const sameLine =
  line.match(/^(.+?)\s+US\s*\$\s*([\d,\s]+(?:\.\d{2})?)\s*$/i) ??
  line.match(/^(.+?)\s{2,}\$\s*([\d,\s]+(?:\.\d{2})?)\s*$/i) ??
  line.match(/^(.+?)\s+\$([\d,]+(?:\.\d{2})?)\s*$/i);
```

And broaden the `dollarValue` regex used in the two-line pattern to also match
plain `$ X,XXX` without requiring `US`:

```typescript
// Before:
const dollarValue = /^(?:US\s*)?\$\s*([\d,\s]+(?:\.\d{2})?)\s*$/i;

// After:
const dollarValue = /^(?:US\s*)?\$\s*([\d,\s]+(?:\.\d{2})?)\s*$|^([\d,]+\.\d{2})\s*$/i;
```

And update the match extraction to handle the second capture group:

```typescript
// In the two-line block, change:
const amount = coerceNumber(nextMatch[1].replace(/\s/g, ""));

// To:
const amount = coerceNumber((nextMatch[1] ?? nextMatch[2] ?? "").replace(/\s/g, ""));
```

---

## Fix 3 — Fallback: scan entire document for base bid if section not found

If the pricing section detection still returns no `baseBidAmount` after processing
`pricingLines`, add a last-resort scan of all lines for a "Base Bid" pattern:

At the end of `extractPricingItems`, before the `return` statement:

```typescript
// Last-resort: if no base bid found via section, scan all lines
if (baseBidAmount === null) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/base\s*bid/i.test(line)) continue;

    // Value on same line
    const sameLineMatch =
      line.match(/base\s*bid.*?US\s*\$\s*([\d,\s]+(?:\.\d{2})?)/i) ??
      line.match(/base\s*bid.*?\$\s*([\d,]+(?:\.\d{2})?)/i);
    if (sameLineMatch) {
      baseBidAmount = coerceNumber((sameLineMatch[1] ?? "").replace(/\s/g, ""));
      if (baseBidAmount !== null) break;
    }

    // Value on next line
    const nextLine = (lines[i + 1] ?? "").trim();
    const nextMatch = nextLine.match(/^(?:US\s*)?\$\s*([\d,\s]+(?:\.\d{2})?)\s*$/) ??
                      nextLine.match(/^([\d,]+\.\d{2})$/);
    if (nextMatch) {
      baseBidAmount = coerceNumber((nextMatch[1] ?? nextMatch[2] ?? "").replace(/\s/g, ""));
      if (baseBidAmount !== null) break;
    }
  }
}
```

---

## Step-by-step for Codex

1. Apply all three fixes to `src/lib/opportunity-document-ingestion.ts`.
2. Run `npm run build`. Fix any TypeScript errors.
3. Commit: `Broaden proposal extraction: more customer labels, flexible pricing formats`
4. Push to origin main.

# Task 069 — BOM report visibility in PM and customer portals

## Background

Each weekly update has an `include_bom_report` boolean flag. When true, the
printable weekly report at `/reports/weekly-update/[id]` appends the full BOM
table on a landscape page. Two problems exist:

1. **PM portal** — the "Include BOM report" checkbox only appears inside the
   editable form. In the read-only submitted view the field is completely absent,
   so the PM cannot tell whether BOM was included, and has no prompt to Edit if
   they want to change it.

2. **Customer portal** — `include_bom_report` is not fetched from the database
   in the customer data API, and `WeeklyUpdateCard` has no indication that a
   report includes BOM or a direct link to the printable report.

---

## Fix A — PM read-only submitted view

**File:** `src/app/pm/page.tsx`

In the read-only submitted block (the `isReadOnlySubmitted` branch, inside
`activeTab === "update"`), find the summary grid that contains `SummaryField`
elements. After the existing fields, add a BOM status row so the PM can see at
a glance whether BOM is included.

Locate this section (the grid of SummaryField inside the isReadOnlySubmitted block):

```tsx
<SummaryField label="Additional Notes" value={notes} />
```

After it, add:

```tsx
<div className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-overlay px-4 py-3">
  <span className={[
    "inline-flex h-4 w-4 rounded-sm border",
    includeBomReport ? "border-brand-primary bg-brand-primary" : "border-border-default bg-surface-base",
  ].join(" ")} />
  <span className="text-sm text-text-primary">
    {includeBomReport ? "BOM report included" : "BOM report not included"}
  </span>
</div>
```

---

## Fix B — Customer data API

**File:** `src/app/api/customer/data/route.ts`

In the weekly_updates select query, `include_bom_report` is missing. Add it:

Find:
```ts
          other_remarks
        `)
```

Replace with:
```ts
          other_remarks,
          include_bom_report
        `)
```

---

## Fix C — Customer WeeklyUpdateCard

**File:** `src/app/customer/page.tsx`

### C1 — Add ViewReportLink + BOM badge

`WeeklyUpdateCard` already calls `<ViewReportLink updateId={update.id} />` to
show a "View report" link. Beneath that link, when `include_bom_report` is true,
add a small badge:

Find the ViewReportLink block inside WeeklyUpdateCard:
```tsx
      <div className="mt-3">
        <ViewReportLink updateId={update.id} />
      </div>
```

Replace with:
```tsx
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ViewReportLink updateId={update.id} />
        {update.include_bom_report && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: "#e6f6f4", color: HEADER_BG }}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Includes BOM
          </span>
        )}
      </div>
```

### C2 — Ensure include_bom_report is on the WeeklyUpdate type used in customer page

The `WeeklyUpdate` interface in `src/types/database.ts` already has
`include_bom_report?: boolean` as an optional field (line ~124). No change needed
to the type file.

---

## Acceptance criteria

- PM read-only submitted view shows "BOM report included" / "BOM report not
  included" status alongside the other summary fields.
- Customer weekly update cards show an "Includes BOM" badge when
  `include_bom_report = true`.
- `ViewReportLink` on the customer card still works as before (clicking it opens
  the printable report, which already renders the BOM landscape page when the
  flag is set).
- No change to the PM edit form — the checkbox is already there and correct.
- No new files. No migrations needed.

## When done

Commit all changes and push to `main`.

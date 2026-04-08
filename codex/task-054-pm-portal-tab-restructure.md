# Task 054 — PM Portal: Tab Restructure

## Context

The PM project detail view (`src/app/pm/page.tsx`, `UpdateForm` component) currently
has 3 tabs: `Current Status`, `Weekly Reports`, `BOM`. The `Weekly Reports` tab is the
default and contains too much at once: the update form, POC category inputs, crew log,
narrative fields, change orders (also duplicated on Status tab), and update history
buried at the bottom.

The goal is to restructure into **4 clean tabs** so each screen has a clear, single
purpose. PMs should land on an Overview, see project health at a glance, then navigate
to exactly what they need.

---

## New tab structure

| Tab key | Label | Default? | Purpose |
|---------|-------|----------|---------|
| `overview` | Overview | **Yes** | Project health snapshot + quick actions |
| `update` | Weekly Update | No | The weekly report form |
| `poc` | POC & Progress | No | Category % inputs, weighted total |
| `bom` | BOM | No | Existing BOM tab component |

Change the `ProjectTab` type and `activeTab` state accordingly:

```ts
type ProjectTab = "overview" | "update" | "poc" | "bom";
```

Initial state: `useState<ProjectTab>("overview")`

---

## Tab 1: Overview (default)

Replace the current `status` tab content with a cleaner overview. Content:

### A. Key stats row

4-stat grid (already exists, keep as-is):
- % Complete (from `latestStatusUpdate` or `current_period`)
- Contract value (`project.estimated_income`)
- Prev. Billed (`current_period.prev_billed`)
- To Bill (`currentPeriodToBill`)

Include the status badge (On Track / Behind / Complete) next to the project header.

### B. Latest update summary

If there is a `latestSubmittedUpdate`, show a read-only card with just the fields that
have values (skip empty fields — `SummaryField` already handles this). Show:
- Material Delivered, Equipment Set, Safety Incidents, Inspections & Tests,
  Delays / Impacts, Other Remarks, Additional Notes

Label this card "Latest Submitted Report — Week of [date]". Include the
`ViewReportLink` button in this card header.

If no submitted update exists, show a muted empty state: "No submitted weekly report
yet." with a button "Submit This Week's Report →" that switches to the `update` tab.

### C. "Submit This Week's Report" call-to-action button

Always show a prominent button below the stats: "Submit This Week's Report →" (or
"Edit This Week's Report →" if `currentWeekUpdate` exists and is submitted) that
`setActiveTab("update")`.

If there is a draft in progress (`draftUpdateId`), show a warning pill next to the
button: "Draft in progress".

### D. Change orders

Move the change orders list here (remove it from the `update` tab entirely). Keep
the existing rendering logic unchanged — just relocate it to this tab.

### E. Recent update history

Show the last 5 weeks of `recentUpdates` as a compact list at the bottom of Overview.
For each entry show: week date, status badge (Draft / Submitted), % complete, and a
small "Open" button that calls `handleSelectExistingUpdate(update)` then
`setActiveTab("update")`.

Do **not** show the full crew log or narrative fields in this list — just the summary
line. The full history table already exists in the `update` tab; this is just a
quick-glance list.

---

## Tab 2: Weekly Update

Rename the `reports` tab to `update`. Simplify it to contain **only the form and edit
history**. Remove everything that moves elsewhere.

### Remove from this tab:
- Change orders section (moves to Overview)
- The "Recent update history" at the bottom with the full `recentUpdates.map(...)` block
  (the full history list is no longer needed here — the compact list is on Overview,
  and clicking "Open" there loads the right update into this tab)

### Keep in this tab:
- "Open Current Report" / "Create New Report" header button
- Draft warning banner
- Error / status message banners
- The read-only submitted view (when `isReadOnlySubmitted`)
- The edit form (`<form onSubmit={handleSubmit}>`) with:
  - Week selector + % complete widget (manual override display only — POC inputs
    move to the POC tab; the % complete widget here just shows the current calculated
    value from `pocPctDecimal` or `manualOverride`, non-editable unless no POC exists)
  - Crew log (Mon–Sat, existing table/card layout)
  - Narrative fields: Material Delivered, Equipment Set, Safety Incidents,
    Inspections & Tests, Delays / Impacts, Other Remarks
  - Blockers (internal)
  - Additional Notes
  - Reason for edit input (when `submittedUpdateId && isEditing`)
  - Save Draft / Submit buttons (or Save Edit / Cancel)
- Edit history (after the form)

### % complete widget change

When `pocItems.length > 0`, the widget in the form should display the current weighted
% read-only with a link: "Update POC →" (`setActiveTab("poc")`). The manual override
input should **only** show if `pocItems.length === 0` (no POC configured). This removes
the cluttered dual-mode display.

When `pocItems.length === 0`, keep the manual % input exactly as it is now.

### Remove the `pocUpdates` from submit payload? No.

Keep the `pocUpdates` in the submit payload — the POC tab saves poc_line_items
independently, but the weekly update submission still snapshots the current poc values.
The values come from `pocPcts` state which is shared. No change to the API or save logic.

---

## Tab 3: POC & Progress

New tab. Contains the POC category inputs and % complete calculator. This is the
content currently embedded inside the Weekly Reports form (the
`{pocItems.length > 0 ? <div className="rounded-2xl ...">` block around line 1072).

### Content:

**Header:**
```
POC & Progress
Update category completion percentages. Changes here drive the overall % complete
reported on your weekly update.
```

**If `pocItems.length > 0`:**

Show the existing POC inputs block (category rows with number inputs and progress bars,
live weighted total badge). Keep all the existing `pocPcts` state, `setPocPcts`, and
`totalWeight` / `pocPctDecimal` calculation logic — it is already shared state in
`UpdateForm`, so this tab just renders it.

Add a **"Save POC Changes"** button that calls the existing
`/api/pm/weekly-update` endpoint with `method: "PATCH"` using a minimal payload
(`pocUpdates` only, `projectId`, `weekOf`, `pctComplete: pctDecimal`,
`status: "draft"` if no active update exists, or patches the existing update).

Actually — simpler approach: add a standalone save that calls the API only for
`poc_line_items` updates. There is already a `pocUpdates` payload path in the API
(`PATCH /api/pm/weekly-update`). Use it the same way the form does: send a PATCH with
`updateId` (if exists) or POST to create a draft, passing `pocUpdates` and
`pctComplete`. Show a brief success/error message inline.

**If `pocItems.length === 0`:**

Show the manual % complete input (the same widget currently shown in the form for
no-POC projects). Show helper text:
"No POC categories are configured for this project. Enter % complete manually on the
Weekly Update tab, or ask admin to set up POC categories."

---

## Tab 4: BOM

Unchanged. Render `<BomTab projectId={project.id} readOnly />` exactly as it does
today. Only the tab key changes from `"bom"` (stays the same) — no code change
needed inside BomTab.

---

## Tab bar

The tab bar (the `<div className="flex flex-wrap gap-2 ...">` around line 579) should
render 4 tabs in this order:

```tsx
<PmTabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
  Overview
</PmTabButton>
<PmTabButton active={activeTab === "update"} onClick={() => setActiveTab("update")}>
  Weekly Update
  {draftUpdateId && (
    <span className="ml-1.5 inline-flex h-2 w-2 rounded-full bg-status-warning" />
  )}
</PmTabButton>
<PmTabButton active={activeTab === "poc"} onClick={() => setActiveTab("poc")}>
  POC & Progress
</PmTabButton>
<PmTabButton active={activeTab === "bom"} onClick={() => setActiveTab("bom")}>
  BOM
</PmTabButton>
```

The orange dot on "Weekly Update" when a draft exists is a subtle visual cue without
needing extra text.

---

## `handleSelectExistingUpdate` update

Currently this function calls `setActiveTab("reports")`. Change it to
`setActiveTab("update")`.

---

## State and logic notes

- All existing state (`pocPcts`, `setPocPcts`, `pocItems`, `recentUpdates`, etc.)
  stays in `UpdateForm` — tabs are just different render paths, not separate components.
- No new API routes needed.
- No database changes needed.
- `pocUpdates` are still sent with weekly update submissions — the POC tab's
  independent save is additive, not a replacement.
- The `false && (...)` dead-code blocks at the bottom of the `update` tab content
  (WIP and Materials/BOM details) should be deleted as part of this cleanup.

---

## Files to change

| File | What changes |
|------|-------------|
| `src/app/pm/page.tsx` | All tab restructuring — the only file that needs changes |

No new files. No new dependencies. No migration.

---

## Acceptance criteria

- [ ] Clicking a project on the PM list lands on **Overview** tab by default
- [ ] Overview shows: status badge, 4-stat grid (%, contract, prev billed, to bill),
      latest submitted report read-only summary (empty fields hidden), change orders,
      compact recent history (last 5 updates), "Submit This Week's Report →" CTA
- [ ] "Submit This Week's Report →" button on Overview switches to the Weekly Update tab
- [ ] Weekly Update tab contains: crew log, narrative fields, blockers, notes,
      draft/submit buttons — nothing else
- [ ] When POC is configured, the % complete widget on Weekly Update shows the
      calculated value read-only with an "Update POC →" link to the POC tab
- [ ] When no POC is configured, the manual % input appears on Weekly Update as before
- [ ] POC & Progress tab shows the category inputs with live weighted total and a
      Save POC Changes button
- [ ] BOM tab unchanged
- [ ] Orange dot appears on Weekly Update tab label when a draft is in progress
- [ ] Change orders appear only on Overview (not duplicated in Weekly Update)
- [ ] `handleSelectExistingUpdate` loads the report into Weekly Update tab and
      switches to it
- [ ] Dead-code `false && (...)` WIP/BOM detail blocks removed
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `PM portal: restructure project detail into Overview / Weekly Update / POC / BOM tabs`
Push to main.

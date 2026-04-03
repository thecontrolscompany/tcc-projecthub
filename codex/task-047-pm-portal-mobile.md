# Task 047 — PM Portal: Mobile-Friendly Layout

## Context

The PM portal (`src/app/pm/page.tsx`) is used by field PMs on their phones to submit
weekly construction reports. The current layout has several critical mobile issues:

1. **Sidebar permanently occupies screen width** — `AppShell` (`src/components/app-shell.tsx`)
   uses `ml-16` (collapsed) or `ml-56` (expanded) margin on all screen sizes. On mobile
   there is no way to collapse the sidebar to zero — it always eats screen width.
2. **Read view shows "None" for every empty field** — `SummaryField` renders a full card
   even when `value` is null/empty, creating 6–8 cards of dead scroll space on mobile.
3. **Crew log table (read view, lines 605–626) breaks on narrow screens** — 4-column table
   clips "Activities" column and truncates column headers.
4. **Crew log table (edit/form view, lines 700–746) breaks on narrow screens** — same
   4-column table with input fields; the Activities text input is unusably narrow.
5. **Update History (lines 986–1052) is unreadable on mobile** — the inner crew log table
   renders as a tiny sub-table, dates and labels wrap into multiple lines, and the Edit/
   Open Draft button is too small to tap.

---

## Changes required

### 1. `src/components/app-shell.tsx` — hide sidebar on mobile, show top bar only

The sidebar should be hidden entirely on small screens. The header should span full width
on mobile. Add a hamburger button to the header that opens the sidebar as an overlay drawer
on mobile only.

Replace the current layout with a responsive approach:

**Sidebar (`src/components/sidebar-nav.tsx`):**
- Add `hidden md:flex` (or `md:block`) to the sidebar's outermost element so it is hidden
  below the `md` breakpoint. No change to desktop behavior.

**AppShell header:**
- On mobile (`md:` breakpoint), the header should have `left-0` (full width) instead of
  `left-16` / `left-56`.
- Add a hamburger menu button that is **only visible on mobile** (`md:hidden`). Tapping it
  opens the sidebar as a fixed overlay (z-50, full-height, slides in from the left).
- The overlay sidebar should close when the user taps outside it or taps the hamburger again.

**AppShell main content area:**
- On mobile: `ml-0` (no left margin). On `md` and above: existing `ml-16` / `ml-56`
  behavior unchanged.

Concretely:

```tsx
// header className — replace the fixed left-16/left-56 with responsive version:
className={[
  "fixed top-0 right-0 z-20 flex h-14 items-center justify-between border-b border-border-default bg-surface-raised px-4 transition-[left] duration-200",
  "left-0 md:left-auto",
  collapsed ? "md:left-16" : "md:left-56",
].join(" ")}

// main content className:
className={[
  "min-h-screen bg-surface-base pt-14 transition-[margin-left] duration-200",
  "ml-0",
  collapsed ? "md:ml-16" : "md:ml-56",
].join(" ")}
```

Add mobile sidebar state:
```ts
const [mobileOpen, setMobileOpen] = useState(false);
```

Add hamburger button in header (before the page title, only on mobile):
```tsx
<button
  onClick={() => setMobileOpen((v) => !v)}
  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-default bg-surface-overlay text-text-secondary transition hover:text-text-primary md:hidden"
  aria-label="Open navigation"
>
  {/* Hamburger icon */}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
    <path d="M3 12h18M3 6h18M3 18h18" />
  </svg>
</button>
```

Wrap the `<SidebarNav>` in a responsive container:
```tsx
{/* Desktop sidebar — always visible */}
<div className="hidden md:block">
  <SidebarNav role={role} userEmail={userEmail} collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
</div>

{/* Mobile sidebar overlay */}
{mobileOpen && (
  <>
    <div
      className="fixed inset-0 z-40 bg-black/40 md:hidden"
      onClick={() => setMobileOpen(false)}
    />
    <div className="fixed inset-y-0 left-0 z-50 md:hidden">
      <SidebarNav role={role} userEmail={userEmail} collapsed={false} onToggle={() => setMobileOpen(false)} />
    </div>
  </>
)}
```

---

### 2. `src/app/pm/page.tsx` — `SummaryField`: suppress empty fields on mobile

The `SummaryField` component (line 1058) currently always renders even when value is empty.

Change it to skip rendering entirely when the value is blank:

```tsx
function SummaryField({ label, value }: { label: string; value: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div className="rounded-xl border border-border-default bg-surface-base p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-text-primary">{value}</p>
    </div>
  );
}
```

The 2-column grid wrapping the SummaryField calls (around line 592) should also get a
fallback empty state in case all fields are blank:

```tsx
<div className="grid gap-4 md:grid-cols-2">
  <SummaryField label="Overall % Complete" value={`${pctComplete.toFixed(1)}%`} />
  <SummaryField label="Blockers" value={blockers} />
  <SummaryField label="Material Delivered" value={materialDelivered} />
  <SummaryField label="Equipment Set" value={equipmentSet} />
  <SummaryField label="Safety Incidents" value={safetyIncidents} />
  <SummaryField label="Inspections & Tests" value={inspectionsTests} />
  <SummaryField label="Delays / Impacts" value={delaysImpacts} />
  <SummaryField label="Other Remarks" value={otherRemarks} />
</div>
{/* Additional Notes spans full width */}
<SummaryField label="Additional Notes" value={notes} />
```

Note: `Overall % Complete` always has a value so will always render. The rest will only
appear when filled in.

---

### 3. `src/app/pm/page.tsx` — Crew log: card layout on mobile (read view)

The crew log table in the read view (lines 605–626) should switch to a card-per-day
layout on mobile. Replace the `<div className="overflow-x-auto ..."><table>` block with:

```tsx
{/* Mobile: card per day */}
<div className="space-y-2 md:hidden">
  {crewLog
    .filter((row) => row.men > 0 || row.hours > 0 || row.activities)
    .map((row) => (
      <div key={row.day} className="rounded-xl border border-border-default bg-surface-base px-4 py-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">{row.day}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          {row.men > 0 && (
            <span><span className="text-text-tertiary">Men: </span><span className="font-medium text-text-primary">{row.men}</span></span>
          )}
          {row.hours > 0 && (
            <span><span className="text-text-tertiary">Hours: </span><span className="font-medium text-text-primary">{row.hours}</span></span>
          )}
        </div>
        {row.activities && <p className="mt-1.5 text-sm text-text-primary">{row.activities}</p>}
      </div>
    ))}
  {crewLog.every((row) => !row.men && !row.hours && !row.activities) && (
    <p className="text-sm text-text-tertiary">No crew log entries.</p>
  )}
</div>

{/* Desktop: table (existing) */}
<div className="hidden overflow-x-auto rounded-xl border border-border-default md:block">
  <table className="w-full text-sm">
    {/* ... existing thead/tbody unchanged ... */}
  </table>
</div>
```

---

### 4. `src/app/pm/page.tsx` — Crew log: card layout on mobile (edit/form view)

The crew log table in the edit form (lines 700–746) should also switch to a stacked
card-per-day layout on mobile so the Activities input is full-width and usable.

Replace the single `<div className="overflow-x-auto ..."><table>` with:

```tsx
{/* Mobile: card per day */}
<div className="space-y-3 md:hidden">
  {crewLog.map((row, i) => (
    <div key={row.day} className="rounded-xl border border-border-default bg-surface-base px-4 py-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{row.day}</p>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-text-tertiary"># of Men</label>
          <input
            type="number"
            min={0}
            value={row.men === 0 ? "" : row.men}
            onChange={(e) => updateCrewRow(i, "men", Number(e.target.value))}
            className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-center text-sm text-text-primary focus:border-status-success/50 focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-text-tertiary">Hours</label>
          <input
            type="number"
            min={0}
            value={row.hours === 0 ? "" : row.hours}
            onChange={(e) => updateCrewRow(i, "hours", Number(e.target.value))}
            className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-center text-sm text-text-primary focus:border-status-success/50 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-text-tertiary">Activities</label>
        <input
          type="text"
          value={row.activities}
          onChange={(e) => updateCrewRow(i, "activities", e.target.value)}
          placeholder="Work performed..."
          className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-status-success/50 focus:outline-none"
        />
      </div>
    </div>
  ))}
</div>

{/* Desktop: table (existing) */}
<div className="hidden overflow-x-auto rounded-xl border border-border-default md:block">
  <table className="w-full text-sm">
    {/* ... existing thead/tbody unchanged ... */}
  </table>
</div>
```

---

### 5. `src/app/pm/page.tsx` — Update History: mobile-friendly cards

The Update History section (lines 986–1052) renders a sub-table for the crew log that
is unreadable on mobile. Replace the inner crew log sub-table with an inline summary:

In the Update History map (the section inside `{recentUpdates.map((update) => (...)}`):

Replace the `<div className="mt-2 overflow-x-auto">...<table>` block (lines 1022–1045)
with a stacked text summary:

```tsx
{update.crew_log && update.crew_log.some((row) => row.men > 0 || row.hours > 0 || row.activities) && (
  <div className="mt-2 space-y-1">
    {update.crew_log
      .filter((row) => row.men > 0 || row.hours > 0 || row.activities)
      .map((row) => (
        <div key={row.day} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-text-secondary">
          <span className="w-20 font-medium text-text-primary">{row.day}</span>
          {row.men > 0 && <span>{row.men} men</span>}
          {row.hours > 0 && <span>{row.hours} hrs</span>}
          {row.activities && <span className="text-text-secondary">{row.activities}</span>}
        </div>
      ))}
  </div>
)}
```

Also make the Update History item header row stack better on mobile. The current layout
(lines 992–1017) has date + status badge + View Report + % + Edit button all in one flex
row. Change to a two-row layout on mobile:

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
  {/* Row 1: date + status + view report */}
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-sm font-medium text-text-primary">
      Week of {format(new Date(update.week_of), "MMM d, yyyy")}
    </span>
    <span className={[
      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
      update.status === "draft" ? "bg-status-warning/10 text-status-warning" : "bg-status-success/10 text-status-success",
    ].join(" ")}>
      {update.status === "draft" ? "Draft" : "Submitted"}
    </span>
    {update.status === "submitted" && <ViewReportLink updateId={update.id} />}
  </div>
  {/* Row 2: % complete + edit button */}
  <div className="flex items-center gap-3">
    {update.pct_complete !== null && (
      <span className="text-sm font-semibold text-status-success">
        {(update.pct_complete * 100).toFixed(1)}%
      </span>
    )}
    <button
      type="button"
      onClick={() => handleSelectExistingUpdate(update)}
      className="rounded-lg border border-border-default bg-surface-overlay px-4 py-2 text-sm font-medium text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
    >
      {update.status === "draft" ? "Open Draft" : "Edit"}
    </button>
  </div>
</div>
```

Note the date format change: `update.week_of` is currently rendered as a raw string
(e.g. `2026-04-04`). Wrap it in `format(new Date(update.week_of), "MMM d, yyyy")` so it
reads as `Apr 4, 2026`. Add the `format` import from `date-fns` if not already used at
the call site (it is already imported at the top of the file).

---

## Summary of files to change

| File | What changes |
|------|-------------|
| `src/components/app-shell.tsx` | Responsive sidebar: hidden on mobile, hamburger overlay |
| `src/components/sidebar-nav.tsx` | Add `hidden md:block` wrapper or adjust outer element |
| `src/app/pm/page.tsx` | SummaryField skip empty; crew log card layout; Update History cards |

No database changes. No new API routes. No new dependencies.

---

## Acceptance criteria

- [ ] On a 390px-wide viewport (iPhone 14), the sidebar is not visible by default
- [ ] A hamburger icon appears in the top-left header on mobile; tapping it opens the sidebar as an overlay; tapping outside closes it
- [ ] Desktop layout (≥768px) is completely unchanged
- [ ] In the read view, fields showing "None" do not render at all — only fields with real values appear
- [ ] The crew log in read view shows a card-per-day on mobile (≤768px) and the existing table on desktop
- [ ] The crew log in edit/form view shows stacked cards on mobile with full-width Activities input
- [ ] Update History cards show a clean inline crew log summary instead of a sub-table
- [ ] Update History date displays as "Apr 4, 2026" format (not raw ISO string)
- [ ] Edit/Open Draft buttons are large enough to tap comfortably (min 40px height)
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `PM portal: mobile-responsive layout, sidebar overlay, compact read view`
Push to main.

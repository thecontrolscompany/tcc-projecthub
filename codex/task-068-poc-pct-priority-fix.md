# Task 068 — Fix POC % complete priority in PM portal

## Problem

On projects with POC line items configured, the **Overall % Complete** displayed
in the Weekly Update tab always shows the billing period's `pct_complete` value
(often 0%) instead of the weighted POC calculation.

**Root cause:** In `src/app/pm/page.tsx`, the `pctComplete` derived value gives
`manualOverride` higher priority than `pocPctDecimal`. `manualOverride` is
auto-populated from `currentPeriod.pct_complete` in `resetForNewWeek()` — so
when a billing period exists with `pct_complete = 0`, `manualOverride` is set to
`"0.0"` (a non-empty string). The condition `manualOverride !== ""` is then always
`true`, so `pocPctDecimal` (the correct POC-weighted total) is never used.

The PM sees two different values:
- "Calculated from POC" box shows the correct weighted % (e.g. 42%)
- "Overall % Complete" shows 0.0% and **that's what gets submitted**

## Fix

### 1. Flip priority in `pctComplete` derivation

**File:** `src/app/pm/page.tsx`

Find this block (around the `totalWeight` / `pocPctDecimal` derivations):

```js
const pctComplete =
  manualOverride !== ""
    ? Number(manualOverride)
    : pocPctDecimal !== null
      ? pocPctDecimal * 100
      : currentPeriod
        ? currentPeriod.pct_complete * 100
        : 0;
```

Replace with:

```js
const pctComplete =
  pocPctDecimal !== null
    ? pocPctDecimal * 100
    : manualOverride !== ""
      ? Number(manualOverride)
      : currentPeriod
        ? currentPeriod.pct_complete * 100
        : 0;
```

**Why this is safe:**
- When POC items exist → `pocPctDecimal` is non-null → it wins. The manual override
  input is hidden anyway when POC items are configured.
- When no POC items → `pocPctDecimal` is null → `manualOverride` is used exactly
  as before (the visible manual input field on the update form).
- Final fallback to billing period value is unchanged.

### 2. Clear `manualOverride` in `resetForNewWeek` when irrelevant

**File:** `src/app/pm/page.tsx`, inside `resetForNewWeek()`

The current line:
```js
setManualOverride(currentPeriod ? (currentPeriod.pct_complete * 100).toFixed(1) : "");
```

Change to:
```js
setManualOverride("");
```

The billing period value is already a fallback in the `pctComplete` derivation
above, so there is no need to pre-populate the override field with it. This keeps
`manualOverride` as a true "PM typed this explicitly" flag rather than a
polluted-from-DB default.

> **Note:** `populateFromUpdate` also sets `manualOverride` from
> `update.pct_complete`. Leave that as-is — it correctly restores what the PM
> typed when they open an existing draft on a no-POC project.

## Acceptance criteria

- On a project with POC line items, the "Overall % Complete" in the Weekly Update
  tab matches the "Calculated from POC" value.
- Submitting the weekly report saves the POC-weighted `pct_complete` to the
  billing period, not 0.
- On a project with **no** POC items, the manual override input still works
  exactly as before.
- No other behaviour changes.

## Files to change

- `src/app/pm/page.tsx` — two small edits described above, no new files needed

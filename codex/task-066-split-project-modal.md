# Task 066 — Split project-modal.tsx into focused component files

## Context

`src/components/project-modal.tsx` is 2,568 lines. It contains the main `ProjectModal`
shell plus six large self-contained sub-components that have grown alongside it:

| Component | Approx lines | Lives in |
|-----------|-------------|----------|
| `WeeklyReportImportDialog` | ~280 | project-modal.tsx |
| `CustomerContactsSection` | ~190 | project-modal.tsx |
| `ChangeOrdersSection` | ~300 | project-modal.tsx |
| `EstimatorAndPocSection` | ~45 | project-modal.tsx |
| `PocSetupSection` | ~290 | project-modal.tsx |
| `WeeklyUpdatesSection` | ~80 | project-modal.tsx |
| `PocSheetImportDialog` | ~150 | project-modal.tsx |

The goal is to move each into its own file under `src/components/` with no logic
changes — pure file splits. The main `ProjectModal` export and all its props/types
remain in `project-modal.tsx`, just importing the extracted pieces.

No database changes, no API changes, no UI changes. `npm run build` must pass clean.

---

## Prerequisites

The following already exist and must NOT be changed:
- `src/lib/utils/format.ts` — exports `fmtCurrency`; `project-modal.tsx` already imports it
- `src/lib/project/roles.ts` — exports `ROLE_LABELS`, `ROLE_BADGE_STYLES`; `project-modal.tsx` already imports them
- `src/lib/supabase/client.ts` — `createClient` browser client
- `src/components/bom-tab.tsx` — `BomTab` component (already imported)
- `src/components/view-report-link.tsx` — `ViewReportLink` (already imported)

---

## Step 1 — Extract `WeeklyReportImportDialog`

Create `src/components/project-modal/weekly-report-import-dialog.tsx`.

Move the following from `project-modal.tsx`:
- The `ParsedWeeklyUpdate` type (currently at the top of project-modal.tsx)
- The `WeeklyReportImportDialog` function component and its `WeeklyReportImportDialogProps` type

Required imports in the new file:
```ts
"use client";
import { useState } from "react";
import type { ParsedPocImportRow } from "@/lib/poc/import"; // if referenced, else drop
```

Export: `export function WeeklyReportImportDialog(...)`

In `project-modal.tsx`: remove the moved code, add:
```ts
import { WeeklyReportImportDialog } from "@/components/project-modal/weekly-report-import-dialog";
```

---

## Step 2 — Extract `CustomerContactsSection`

Create `src/components/project-modal/customer-contacts-section.tsx`.

Move from `project-modal.tsx`:
- The `CustomerContactsSection` function component

Required imports:
```ts
"use client";
import { useEffect, useState } from "react";
import type { Profile, ProjectCustomerContact } from "@/types/database";
```

Export: `export function CustomerContactsSection(...)`

In `project-modal.tsx`: remove, add import.

---

## Step 3 — Extract `ChangeOrdersSection` and `StatusBadge`

Create `src/components/project-modal/change-orders-section.tsx`.

Move from `project-modal.tsx`:
- The `StatusBadge` function component (used only by `ChangeOrdersSection`)
- The `ChangeOrdersSection` function component

Required imports:
```ts
"use client";
import { useEffect, useMemo, useState } from "react";
import type { ChangeOrder, ChangeOrderStatus } from "@/types/database";
import { fmtCurrency } from "@/lib/utils/format";
```

Export both: `export function StatusBadge(...)` and `export function ChangeOrdersSection(...)`

In `project-modal.tsx`: remove both, add import for `ChangeOrdersSection` (and `StatusBadge` if referenced elsewhere — check first).

---

## Step 4 — Extract `PocSetupSection`, `EstimatorAndPocSection`, and `PocSheetImportDialog`

Create `src/components/project-modal/poc-setup-section.tsx`.

Move from `project-modal.tsx`:
- `PocSheetImportDialog` (used only by `PocSetupSection`)
- `PocSetupSection`
- `EstimatorAndPocSection`

Required imports:
```ts
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PocLineItem } from "@/types/database";
import type { ParsedPocImportRow } from "@/lib/poc/import";
```

Export: `export function EstimatorAndPocSection(...)` (PocSetupSection and PocSheetImportDialog can remain unexported/internal within the file)

In `project-modal.tsx`: remove, add import for `EstimatorAndPocSection`.

---

## Step 5 — Extract `WeeklyUpdatesSection`

Create `src/components/project-modal/weekly-updates-section.tsx`.

Move from `project-modal.tsx`:
- The `UpdateRow` type
- The `WeeklyUpdatesSection` function component

Required imports:
```ts
"use client";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ViewReportLink } from "@/components/view-report-link";
```

Export: `export function WeeklyUpdatesSection(...)`

In `project-modal.tsx`: remove, add import.

---

## Step 6 — Verify

After all extractions:

1. Run `npm run build` — must pass with no TypeScript errors.
2. Verify `project-modal.tsx` is under ~1,000 lines (it should be ~1,200–1,400 after extraction).
3. Do not rename any exported props types or component signatures — this is a file split only.

---

## What NOT to change

- Do not rename any components or their props
- Do not change any logic, state, or API calls
- Do not change any JSX structure or CSS classes
- Do not touch any other files except as noted above (the new files + the import additions to project-modal.tsx)
- Do not run migrations or modify the database

---

## Commit message

```
Refactor: split project-modal.tsx into focused component files

Extracted WeeklyReportImportDialog, CustomerContactsSection,
ChangeOrdersSection, PocSetupSection/EstimatorAndPocSection,
and WeeklyUpdatesSection into src/components/project-modal/.
No logic, UI, or API changes — pure file organization.
```

# Task 053 — Materials / BOM Tab

## Context

Per-project Bill of Materials tracking for GFE (Government/Customer Furnished Equipment) —
parts the *customer ships to TCC* to install. The BOM defines what's expected;
receipts track what has arrived. Reference: `SOF BOM 4-3-26.xlsx` for the column format:
Designation | Total Qty | Code Number | Description | Qty Received | Remain/Surplus

**IMPORTANT:** Migration 030 (`bom_items` + `material_receipts` tables) must be run
before this task. Check: `SELECT to_regclass('public.bom_items');`
If null, write `supabase/migrations/029_bom.sql` with the schema below and note it
needs manual execution.

### Tables (for reference)
```sql
-- bom_items: id, project_id, section, designation, code_number, description,
--            qty_required, notes, sort_order, created_at, updated_at
-- material_receipts: id, bom_item_id, qty_received, date_received,
--                    received_by, packing_slip, notes, created_at
```

---

## Where it lives

New tab in the admin Project Modal (`src/components/project-modal.tsx`).
Read-only summary in the PM portal.

---

## Changes required

### 1. TypeScript types

Add to `src/types/database.ts`:
```ts
export type BomStatus = "not_received" | "partial" | "received" | "surplus";

export interface BomItem {
  id: string;
  project_id: string;
  section: string;
  designation: string | null;
  code_number: string | null;
  description: string;
  qty_required: number;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // computed client-side from receipts:
  qty_received?: number;
  remain_surplus?: number;
  status?: BomStatus;
}

export interface MaterialReceipt {
  id: string;
  bom_item_id: string;
  qty_received: number;
  date_received: string;
  received_by: string | null;
  packing_slip: string | null;
  notes: string | null;
  created_at: string;
}
```

### 2. API route: `/api/admin/bom`

Create `src/app/api/admin/bom/route.ts`:

**GET** `?projectId=xxx` — returns:
```ts
{
  items: BomItem[],            // ordered by sort_order, section
  receipts: MaterialReceipt[]  // all receipts for this project's items
}
```
Join receipts to items via `bom_item_id`. Use service role client.
Auth: admin/ops_manager for write, pm/lead for GET.

**POST** — create bom_item. Body: `{ project_id, section, designation?, code_number?, description, qty_required, notes?, sort_order? }`

**PATCH** — update bom_item. Body: `{ id, ...fields }`

**DELETE** — delete bom_item. Body: `{ id }` — also cascades receipts.

**POST** `?action=receipt` — create a receipt:
```ts
{ bom_item_id, qty_received, date_received, packing_slip?, notes? }
```
Sets `received_by` = authenticated user id.

**DELETE** `?action=receipt` — delete a receipt. Body: `{ id }`

### 3. Client-side computed fields

After fetching, compute per item:
```ts
function computeBomStatus(item: BomItem, receipts: MaterialReceipt[]): BomItem {
  const itemReceipts = receipts.filter((r) => r.bom_item_id === item.id);
  const qty_received = itemReceipts.reduce((sum, r) => sum + r.qty_received, 0);
  const remain_surplus = qty_received - item.qty_required;
  let status: BomStatus;
  if (qty_received === 0) status = "not_received";
  else if (qty_received < item.qty_required) status = "partial";
  else if (qty_received === item.qty_required) status = "received";
  else status = "surplus";
  return { ...item, qty_received, remain_surplus, status };
}
```

### 4. New component: `src/components/bom-tab.tsx`

Props: `{ projectId: string; readOnly?: boolean }`

#### Summary cards (top)
- Total line items
- % Fully Received (received / total * 100)
- # Still Needed 🚨 (not_received + partial)
- # Surplus ⚠

#### Filter bar
- "Show Missing Only" toggle (hides received/surplus rows)
- Search input (designation, code_number, description)
- Section filter dropdown (all sections from data)

#### Main table

Grouped by `section` with a section header row (teal background, uppercase).
Columns match the SOF BOM Excel format exactly:

| Designation | Code Number | Description | Total Qty | Qty Rec'd | Remain/Surplus | Status |

Row color coding:
- Red background (subtle: `bg-status-danger/5`) = not_received
- Yellow (`bg-status-warning/5`) = partial
- Green (`bg-status-success/5`) = received
- Amber (`bg-[#fef3c7]/50`) = surplus

Remain/Surplus cell:
- Negative number → red text
- Zero → grey text "0"
- Positive → amber text "+N"

Status pill:
- Not Received → red "Missing"
- Partial → yellow "Partial"
- Received → green "✓"
- Surplus → amber "Surplus"

#### Receipt log (expandable per row)

Clicking a row expands it to show a receipt log sub-table:
```
Date | Qty | Packing Slip | Received By | Notes | [Delete]
```

And an "Add Receipt" inline form:
```
Date: [date, default today]  Qty: [number]  Packing Slip: [text]  Notes: [text]  [Add]
```

If `readOnly = true`, hide the Add Receipt form and Delete buttons.

#### Add BOM item (admin only, bottom of table)

A "+ Add Item" row at the bottom of each section, and an "+ Add Section" button.
The add form mirrors the table columns.

#### Excel import button (admin only)

A button "Import from Excel" above the table. Opens a file picker accepting `.xlsx`.
On file select, posts the file to `POST /api/admin/bom/import`.

The import route:
- Uses `exceljs` (already installed) to parse the file
- Expects the SOF BOM column format: col A=Designation, col B=Total Qty, col C=Code Number, col D=Description
- Detects section header rows (rows where col B and C are empty and col A has text)
- Skips rows where col B is 0 or empty AND col C is empty AND col D is empty
- Creates `bom_items` rows for the project
- Returns `{ imported: N, skipped: M, errors: [...] }`

After import, refresh the BOM data.

### 5. Add BOM tab to Project Modal

In `src/components/project-modal.tsx`, add a "Materials" tab alongside the WIP tab.
Only show when `project.id` exists (not for new project creation).
Render `<BomTab projectId={project.id} />`.

### 6. Read-only BOM summary in PM portal

In `src/app/pm/page.tsx`, add a "Materials" collapsible section below WIP:

```tsx
<details>
  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-text-secondary">
    Materials / BOM
  </summary>
  <div className="mt-3">
    <BomTab projectId={project.id} readOnly />
  </div>
</details>
```

---

## Files to create / change

- `src/types/database.ts` — add BomItem, MaterialReceipt, BomStatus
- `src/app/api/admin/bom/route.ts` — new CRUD + receipt API
- `src/app/api/admin/bom/import/route.ts` — new Excel import API
- `src/components/bom-tab.tsx` — new component
- `src/components/project-modal.tsx` — add Materials tab
- `src/app/pm/page.tsx` — add read-only BOM section
- `supabase/migrations/029_bom.sql` — migration file (needs manual run if not done)

---

## Acceptance criteria

- [ ] Admin opens project modal → Materials tab shows summary cards and BOM table
- [ ] Table is grouped by section with color-coded rows
- [ ] Admin can add/edit/delete BOM items manually
- [ ] Admin can log a receipt on any item (expands row, add form)
- [ ] Qty Rec'd and Remain/Surplus update immediately after logging receipt
- [ ] "Import from Excel" button accepts .xlsx and creates BOM items from SOF format
- [ ] "Show Missing Only" toggle hides fully received rows
- [ ] PM portal shows read-only Materials section
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `Add Materials/BOM tab with receipt tracking and Excel import`
Push to main. Create `codex/task-053-output.md`.

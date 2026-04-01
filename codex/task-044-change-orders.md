# Task 044 — Change Orders (PCO / CO Log)

## Guiding principle
Add change order tracking without touching any existing billing calculations,
billing table, or project save logic. The CO feature is additive — a new
table, new API routes, new UI sections. Nothing existing breaks.

---

## 1 — Database migration

Create `supabase/migrations/022_change_orders.sql`:

```sql
CREATE TYPE co_status AS ENUM ('pending', 'approved', 'rejected', 'void');

CREATE TABLE IF NOT EXISTS change_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  co_number         text NOT NULL,          -- e.g. "PCO-001", "CO-003"
  title             text NOT NULL,
  description       text,
  amount            numeric(12,2) NOT NULL DEFAULT 0,
  status            co_status NOT NULL DEFAULT 'pending',
  submitted_date    date,
  approved_date     date,
  submitted_by      uuid REFERENCES profiles(id),
  approved_by       uuid REFERENCES profiles(id),
  reference_doc     text,                   -- PO#, RFI#, drawing ref, etc.
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_orders_project_id ON change_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON change_orders(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_change_orders_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_change_orders_updated_at
  BEFORE UPDATE ON change_orders
  FOR EACH ROW EXECUTE FUNCTION update_change_orders_updated_at();
```

Run this in the Supabase SQL editor before testing.

---

## 2 — TypeScript type

Add to `src/types/database.ts`:

```ts
export type ChangeOrderStatus = "pending" | "approved" | "rejected" | "void";

export interface ChangeOrder {
  id: string;
  project_id: string;
  co_number: string;
  title: string;
  description: string | null;
  amount: number;
  status: ChangeOrderStatus;
  submitted_date: string | null;
  approved_date: string | null;
  submitted_by: string | null;
  approved_by: string | null;
  reference_doc: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

---

## 3 — API routes

### `src/app/api/admin/change-orders/route.ts`

All handlers use the service-role admin client. Auth check: must be
`admin` or `ops_manager` for write operations. Read operations also
require at minimum a signed-in user (PM can view their project's COs).

#### GET
Query params: `projectId` (required)

```ts
const { data, error } = await adminClient
  .from("change_orders")
  .select("*")
  .eq("project_id", projectId)
  .order("co_number");
```

Return `{ changeOrders: ChangeOrder[] }`.

Also return a summary:
```ts
const approvedTotal = data.filter(co => co.status === "approved")
  .reduce((sum, co) => sum + co.amount, 0);
const pendingTotal = data.filter(co => co.status === "pending")
  .reduce((sum, co) => sum + co.amount, 0);
return { changeOrders: data, approvedTotal, pendingTotal };
```

#### POST — create new CO
Body:
```ts
{
  projectId: string;
  coNumber: string;
  title: string;
  description?: string;
  amount: number;
  status: ChangeOrderStatus;
  submittedDate?: string;
  approvedDate?: string;
  referenceDoc?: string;
  notes?: string;
}
```

Insert and return the new row: `{ changeOrder: ChangeOrder }`.

Auto-generate `co_number` if not provided: query the max existing
co_number for this project and increment. Pattern: `PCO-001`, `PCO-002`,
etc. If status is `approved`, use `CO-` prefix instead.

#### PATCH — update existing CO
Body: `{ id: string; [field]: value }` — any fields from the CO except
`project_id` and `created_at`.

If `status` is being set to `approved` and `approved_date` is not
provided, set `approved_date` to today's date.

Return `{ changeOrder: ChangeOrder }`.

#### DELETE — soft delete (set status to void)
Body: `{ id: string }`

Update `status = 'void'`. Return `{ ok: true }`.

---

## 4 — Change Orders section in project modal

File: `src/components/project-modal.tsx`

Add a new collapsible section **"Change Orders"** to the edit project
modal, below the Customer Portal Access section.

### 4a — New state (add to ProjectModal component)
```ts
const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
const [coLoading, setCoLoading] = useState(false);
const [showCoForm, setShowCoForm] = useState(false);
const [coForm, setCoForm] = useState({
  coNumber: "",
  title: "",
  description: "",
  amount: "",
  status: "pending" as ChangeOrderStatus,
  submittedDate: "",
  approvedDate: "",
  referenceDoc: "",
  notes: "",
});
const [coSaving, setCoSaving] = useState(false);
const [coError, setCoError] = useState<string | null>(null);
```

### 4b — Load change orders when modal opens
When `editingProject` is set (edit mode only), fetch:
```ts
const res = await fetch(`/api/admin/change-orders?projectId=${editingProject.id}`, {
  credentials: "include",
});
const json = await res.json();
setChangeOrders(json.changeOrders ?? []);
```

### 4c — UI section

Place this section between the Customer Portal Access section and the
Save/Cancel buttons.

```tsx
<section className="space-y-3">
  <div className="flex items-center justify-between">
    <h3 className="text-sm font-semibold text-text-primary">Change Orders</h3>
    <button
      type="button"
      onClick={() => setShowCoForm((v) => !v)}
      className="rounded-lg bg-brand-primary/10 px-3 py-1.5 text-xs font-medium text-brand-primary hover:bg-brand-primary/20"
    >
      + Add CO
    </button>
  </div>

  {/* Summary badges */}
  {changeOrders.length > 0 && (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="rounded-full bg-status-success/10 px-2.5 py-1 text-status-success font-medium">
        Approved: {formatCurrency(approvedTotal)}
      </span>
      <span className="rounded-full bg-status-warning/10 px-2.5 py-1 text-status-warning font-medium">
        Pending: {formatCurrency(pendingTotal)}
      </span>
    </div>
  )}

  {/* CO list */}
  {changeOrders.filter(co => co.status !== "void").map(co => (
    <div key={co.id} className="flex items-center justify-between rounded-xl border border-border-default bg-surface-raised px-4 py-2.5 text-sm">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary">{co.co_number}</span>
          <span className="text-text-secondary">—</span>
          <span className="text-text-primary">{co.title}</span>
          <StatusBadge status={co.status} />
        </div>
        {co.reference_doc && (
          <p className="text-xs text-text-tertiary">Ref: {co.reference_doc}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={["font-semibold", co.amount >= 0 ? "text-status-success" : "text-status-danger"].join(" ")}>
          {co.amount >= 0 ? "+" : ""}{formatCurrency(co.amount)}
        </span>
        <button
          type="button"
          onClick={() => void handleVoidCo(co.id)}
          className="text-xs text-text-tertiary hover:text-status-danger"
        >
          Void
        </button>
      </div>
    </div>
  ))}

  {/* Add CO form */}
  {showCoForm && (
    <div className="rounded-xl border border-border-default bg-surface-overlay p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">CO Number</label>
          <input
            type="text"
            value={coForm.coNumber}
            onChange={e => setCoForm(f => ({ ...f, coNumber: e.target.value }))}
            placeholder="PCO-001"
            className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">Status</label>
          <select
            value={coForm.status}
            onChange={e => setCoForm(f => ({ ...f, status: e.target.value as ChangeOrderStatus }))}
            className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">Title</label>
        <input
          type="text"
          value={coForm.title}
          onChange={e => setCoForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Brief description of the change"
          className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">Amount ($)</label>
          <input
            type="number"
            value={coForm.amount}
            onChange={e => setCoForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="0.00"
            className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">Reference (RFI#, PO#, etc.)</label>
          <input
            type="text"
            value={coForm.referenceDoc}
            onChange={e => setCoForm(f => ({ ...f, referenceDoc: e.target.value }))}
            placeholder="Optional"
            className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">Submitted Date</label>
          <input type="date" value={coForm.submittedDate}
            onChange={e => setCoForm(f => ({ ...f, submittedDate: e.target.value }))}
            className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-secondary">Approved Date</label>
          <input type="date" value={coForm.approvedDate}
            onChange={e => setCoForm(f => ({ ...f, approvedDate: e.target.value }))}
            className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-text-secondary">Notes</label>
        <textarea
          value={coForm.notes}
          onChange={e => setCoForm(f => ({ ...f, notes: e.target.value }))}
          rows={2}
          className="w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none"
        />
      </div>
      {coError && <p className="text-xs text-status-danger">{coError}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setShowCoForm(false)}
          className="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-raised">
          Cancel
        </button>
        <button type="button" onClick={() => void handleAddCo()} disabled={coSaving}
          className="rounded-lg bg-brand-primary px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {coSaving ? "Saving..." : "Save CO"}
        </button>
      </div>
    </div>
  )}
</section>
```

### 4d — Handlers

`handleAddCo`:
```ts
async function handleAddCo() {
  if (!editingProject || !coForm.title.trim()) { setCoError("Title is required."); return; }
  setCoSaving(true); setCoError(null);
  const res = await fetch("/api/admin/change-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      projectId: editingProject.id,
      coNumber: coForm.coNumber.trim() || undefined,
      title: coForm.title.trim(),
      description: coForm.description.trim() || undefined,
      amount: Number(coForm.amount) || 0,
      status: coForm.status,
      submittedDate: coForm.submittedDate || undefined,
      approvedDate: coForm.approvedDate || undefined,
      referenceDoc: coForm.referenceDoc.trim() || undefined,
      notes: coForm.notes.trim() || undefined,
    }),
  });
  const json = await res.json();
  setCoSaving(false);
  if (!res.ok) { setCoError(json.error ?? "Failed to save."); return; }
  setChangeOrders(prev => [...prev, json.changeOrder]);
  setShowCoForm(false);
  setCoForm({ coNumber: "", title: "", description: "", amount: "", status: "pending",
    submittedDate: "", approvedDate: "", referenceDoc: "", notes: "" });
}
```

`handleVoidCo`:
```ts
async function handleVoidCo(id: string) {
  const res = await fetch("/api/admin/change-orders", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id }),
  });
  if (res.ok) setChangeOrders(prev => prev.map(co => co.id === id ? { ...co, status: "void" } : co));
}
```

### 4e — Helper components (add locally in project-modal.tsx)

```tsx
function StatusBadge({ status }: { status: ChangeOrderStatus }) {
  const styles: Record<ChangeOrderStatus, string> = {
    pending:  "bg-status-warning/10 text-status-warning",
    approved: "bg-status-success/10 text-status-success",
    rejected: "bg-status-danger/10 text-status-danger",
    void:     "bg-surface-overlay text-text-tertiary",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}
```

`formatCurrency` — check if one already exists in the file. If yes, reuse it.
If not, add:
```ts
function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
```

---

## 5 — Show CO exposure on billing table (read-only, additive)

In `src/app/admin/page.tsx`, in the billing table section, add a
"Pending CO" column to `BillingRow` display only — do NOT modify
`BillingRow` type or any calculation. This is purely a display addition.

Skip this for now if it creates complexity. The CO section in the project
modal is sufficient for task 044. Mark as optional.

---

## 6 — Show CO summary on customer portal (read-only)

In `src/app/customer/page.tsx`, optionally show approved change orders
for a project as a read-only line in the project summary card:

```tsx
{approvedCOs.length > 0 && (
  <p className="text-xs text-text-secondary">
    {approvedCOs.length} approved change order{approvedCOs.length !== 1 ? "s" : ""}
    {" "}(+{formatCurrency(approvedCOTotal)})
  </p>
)}
```

Skip this if it requires significant refactoring of the customer data
fetch. Mark as optional for task 044.

---

## 7 — DO NOT TOUCH

- `src/lib/billing/calculations.ts` — no changes
- `src/app/api/admin/save-project/route.ts` — no changes
- Any existing `billing_periods` logic
- Any existing `contract_price` / `estimated_income` update logic
- RLS policies (the `change_orders` table has no RLS — access controlled
  in application code via the admin client)

---

## 8 — Build + commit

- Run `npm run build` — must pass clean.
- Commit: `"Add change order (PCO/CO) log per project"` and push to `origin/main`.
- Create `codex/task-044-output.md` with what was changed and build status.
- Note any optional sections that were skipped.

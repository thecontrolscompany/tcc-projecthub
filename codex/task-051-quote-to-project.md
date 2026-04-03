# Task 051 — Quote → Project Lifecycle

## Context

The quotes page (`src/app/quotes/page.tsx` + `src/components/quotes-page-client.tsx`)
already has a status pipeline (new → reviewing → quoted → won → lost) and a `project_id`
field on `quote_requests`. When a quote is marked "won", admin should be able to
convert it into a project with one click — pre-filling the New Project modal from the
quote data.

The `quote_requests` table has:
- `company_name`, `contact_name`, `contact_email`, `contact_phone`
- `project_description`, `project_address`
- `estimated_value` (nullable)
- `project_id uuid` (nullable FK to projects — set after conversion)

---

## Changes required

### 1. "Convert to Project" button on won quotes

In `src/components/quotes-page-client.tsx`, in the `AdminQuotesView` component,
when `selectedQuote.status === "won"` and `selectedQuote.project_id === null`,
show a prominent button:

```tsx
{selectedQuote.status === "won" && !selectedQuote.project_id && (
  <button
    type="button"
    onClick={() => setShowConvertModal(true)}
    className="w-full rounded-xl bg-status-success px-4 py-3 text-sm font-semibold text-text-inverse transition hover:opacity-90"
  >
    Convert to Project →
  </button>
)}
{selectedQuote.project_id && (
  <p className="text-sm text-status-success font-medium">
    ✓ Converted to project
  </p>
)}
```

### 2. Convert modal

Add state:
```ts
const [showConvertModal, setShowConvertModal] = useState(false);
```

The modal pre-fills a project creation form from the quote data:

```tsx
{showConvertModal && selectedQuote && (
  <ConvertToProjectModal
    quote={selectedQuote}
    onClose={() => setShowConvertModal(false)}
    onConverted={(projectId) => {
      setShowConvertModal(false);
      // update local quotes state to show project_id linked
      setQuotes((qs) => qs.map((q) =>
        q.id === selectedQuote.id ? { ...q, project_id: projectId } : q
      ));
      setSelectedQuote((q) => q ? { ...q, project_id: projectId } : q);
    }}
  />
)}
```

### 3. `ConvertToProjectModal` component

Create inline in `quotes-page-client.tsx` (no separate file needed).

Pre-fill fields from quote:
- `name` ← `quote.project_description` (editable)
- `site_address` ← `quote.project_address` (editable)
- `estimated_income` ← `quote.estimated_value ?? 0` (editable)
- `customer_name` ← `quote.company_name` (display only, used to find/create customer)
- `pm_email` ← blank (dropdown of existing PM directory, optional)

Form fields:
```
Project Name:      [text input, required, pre-filled from description]
Site Address:      [text input, pre-filled from quote address]
Estimated Income:  [number input, pre-filled from estimated_value]
Customer:          [text — shows quote.company_name, read-only note: "Customer will be created if new"]
Job Number:        [auto-generated YYYY-NNN — label only, not editable]
```

Submit calls `POST /api/admin/convert-quote-to-project`.

### 4. New API route: `POST /api/admin/convert-quote-to-project`

Create `src/app/api/admin/convert-quote-to-project/route.ts`.

Request body:
```ts
{
  quote_id: string;
  name: string;
  site_address?: string;
  estimated_income: number;
}
```

Logic:
1. Auth check — admin only
2. Fetch the quote to get `company_name`, `contact_name`, `contact_email`
3. Find or create customer: look up `customers` by `name = company_name` (case-insensitive).
   If not found, insert a new customer row with `name = company_name`.
4. Generate job number: query `MAX(job_number)` from projects for current year,
   increment, format as `YYYY-NNN` (same logic as in `admin-projects-tab.tsx`).
5. Insert new project:
   ```ts
   {
     name: `${jobNumber} - ${body.name}`,
     job_number: jobNumber,
     customer_id: customerId,
     site_address: body.site_address,
     estimated_income: body.estimated_income,
     source_estimate_id: null,
     is_active: true,
   }
   ```
6. Update `quote_requests` set `project_id = newProject.id` where `id = quote_id`.
7. Return `{ project_id: newProject.id, job_number: jobNumber }`.

### 5. Linked project display

When `quote.project_id` is not null, in the quote detail panel show:
```tsx
<div className="rounded-xl border border-status-success/20 bg-status-success/5 px-4 py-3">
  <p className="text-xs font-semibold uppercase tracking-wide text-status-success">Linked Project</p>
  <p className="mt-1 text-sm text-text-primary">{linkedProjectName}</p>
</div>
```

To get the project name, add it to the quote fetch — join `project:projects(name, job_number)`
in the quotes data query in `src/app/quotes/page.tsx`.

### 6. Quotes list — show "Linked" badge

In the quotes list, when `quote.project_id` is not null, show a small "Linked" badge
next to the status pill:
```tsx
{quote.project_id && (
  <span className="rounded-full bg-status-success/10 px-2 py-0.5 text-xs font-medium text-status-success">
    Linked
  </span>
)}
```

---

## Files to change / create

- `src/components/quotes-page-client.tsx` — Convert button, modal, linked display
- `src/app/quotes/page.tsx` — add project join to data fetch
- `src/app/api/admin/convert-quote-to-project/route.ts` — new API route

No migration needed — uses existing `projects` and `quote_requests` tables.
`projects.source_estimate_id` column from migration 027 is needed — confirm it exists
before running (`SELECT column_name FROM information_schema.columns WHERE table_name='projects' AND column_name='source_estimate_id'`).
If it doesn't exist, include the ALTER TABLE in the route setup or note it.

---

## Acceptance criteria

- [ ] Won quote with no project_id shows "Convert to Project" button
- [ ] Modal pre-fills name, address, and estimated income from quote data
- [ ] Submitting creates a new project with correct job number and customer
- [ ] Quote detail shows "Linked Project" card after conversion
- [ ] Quote list shows "Linked" badge on converted quotes
- [ ] Won quote with existing project_id shows linked state instead of convert button
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `Quote → Project lifecycle: convert won quotes to projects`
Push to main. Create `codex/task-051-output.md`.

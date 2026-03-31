# Task 014 — Project Management: New Project, Edit Project, Billed/Paid Status

## Context

Admins need to create new projects, edit existing project details, and mark projects
as "Billed in Full" and "Paid in Full" — which moves them from Active to Completed.

The New Project form is based on the company's Project Turnover Checklist document,
which captures all fields needed at project kickoff.

## Read before starting

- `src/app/admin/page.tsx` (Projects tab — where New Project button goes)
- `src/app/projects/page.tsx` and `src/app/projects/projects-list.tsx`
- `src/types/database.ts` (Project type)
- `supabase/migrations/001_initial_schema.sql` (current schema)
- `src/app/api/admin/migrate-sharepoint/route.ts` (has PROJECT_SUBFOLDERS list and Graph API helpers)
- `src/lib/graph/client.ts` (createSharePointFolder, getSharePointSiteId, getSharePointDriveId)

---

## Part A — Database migration

Create `supabase/migrations/004_project_fields.sql`:

```sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS billed_in_full BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_in_full BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_poc TEXT,
  ADD COLUMN IF NOT EXISTS customer_po_number TEXT,
  ADD COLUMN IF NOT EXISTS site_address TEXT,
  ADD COLUMN IF NOT EXISTS contract_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS general_contractor TEXT,
  ADD COLUMN IF NOT EXISTS mechanical_contractor TEXT,
  ADD COLUMN IF NOT EXISTS electrical_contractor TEXT,
  ADD COLUMN IF NOT EXISTS all_conduit_plenum BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS certified_payroll BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS buy_american BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bond_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_requirements TEXT,
  ADD COLUMN IF NOT EXISTS special_access TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS pm_directory_id UUID REFERENCES pm_directory(id);
```

**Timothy must run this migration manually in Supabase SQL editor.**
Codex should create the file but not run it.

---

## Part B — Update TypeScript types

In `src/types/database.ts`, add to the `Project` interface:

```ts
billed_in_full: boolean;
paid_in_full: boolean;
completed_at: string | null;
customer_poc: string | null;
customer_po_number: string | null;
site_address: string | null;
contract_price: number | null;
general_contractor: string | null;
mechanical_contractor: string | null;
electrical_contractor: string | null;
all_conduit_plenum: boolean;
certified_payroll: boolean;
buy_american: boolean;
bond_required: boolean;
special_requirements: string | null;
special_access: string | null;
notes: string | null;
pm_directory_id: string | null;
// joined
pm_directory?: PmDirectory;
```

---

## Part C — New Project button and form (Admin Projects tab)

In `src/app/admin/page.tsx`, on the Projects tab, add a **New Project** button
in the top-right. Clicking opens a modal form.

### Form layout — two sections:

#### Section 1: Project Info (required fields marked *)
| Field | Type | Required |
|-------|------|----------|
| Project Name | text | Yes |
| Customer | dropdown (from `customers` table) + "Add new" option | Yes |
| Contract Price | currency number input | Yes |
| Customer POC | text | No |
| Customer PO Number | text | No |
| Site Address | text | No |
| General Contractor | text | No |
| Mechanical Contractor | text | No |
| Electrical Contractor | text | No |
| Assigned PM | dropdown (from `pm_directory` table, display `first_name + email`) | No |
| Notes | textarea | No |
| Special Requirements | textarea (conduit fill, 270 rule, below 10' rigid, etc.) | No |
| Special Access | text (DBIDS, site-specific safety orientation, etc.) | No |

#### Section 2: Compliance checkboxes
- All Conduit/Plenum
- Certified Payroll
- Buy American
- Bond Required

#### Job number
- Auto-assign next sequential `YYYY-NNN` for current year
- Display as read-only in the form header so admin sees it before saving
- Query: `SELECT job_number FROM projects WHERE job_number LIKE '{year}-%' ORDER BY job_number DESC LIMIT 1`
  then parse the NNN and increment by 1, zero-padded to 3 digits

#### On submit
- Insert into `projects` with `is_active = true`, `estimated_income = contract_price`,
  `pm_directory_id = selected pm id (or null)`
- Insert a `billing_periods` row for current month with `estimated_income_snapshot = contract_price`
- If "Add new customer" was used, insert into `customers` table first
- After project is inserted, call `POST /api/admin/provision-project-folder` with
  `{ projectId, jobNumber, projectName }` to create the SharePoint folder structure.
  This call is fire-and-forget — do NOT block the modal close on it. If it fails,
  log to console and continue.
- Close modal, refresh projects list

---

## Part D — Edit Project modal

Each project row in the Projects tab gets an **Edit** button (pencil icon or text link).
Opens the same modal pre-populated with all current values.

All fields from Part C are editable.

**Additional fields only in Edit (not New):**
- Billed in Full (checkbox)
- Paid in Full (checkbox)

**Billed in Full / Paid in Full logic:**
- When BOTH are checked → set `is_active = false`, `completed_at = now()`
- If either is unchecked → set `is_active = true`, clear `completed_at`

On save:
- Update `projects` row
- If `contract_price` changed, also set `estimated_income = contract_price` and
  update `billing_periods.estimated_income_snapshot` for all periods of this project
  where `actual_billed IS NULL`

---

## Part E — Projects list display updates

Update `src/app/projects/projects-list.tsx`:

- Fetch and display the new fields in an expanded row or detail panel
- Add "Billed in Full" and "Paid in Full" badge columns:
  - Billed: `bg-status-success/10 text-status-success`
  - Paid: `bg-brand-primary/10 text-brand-primary`
- Active/Completed split already exists — keep it

Update `src/app/projects/page.tsx` select to include new fields:
```ts
.select("id, name, job_number, is_active, migration_status, sharepoint_folder, created_at, billed_in_full, paid_in_full, completed_at, contract_price, customer_poc, site_address")
```

---

## Part F — SharePoint folder provisioning API route

Create `src/app/api/admin/provision-project-folder/route.ts`:

```ts
POST body: { projectId: string, jobNumber: string, projectName: string }
```

- Require admin role + Microsoft provider token (same pattern as migrate-sharepoint route)
- Get SharePoint siteId and driveId using `getSharePointSiteId` / `getSharePointDriveId`
- Full folder name: `{jobNumber} - {projectName}` (same format as migrated projects)
- Create top-level folder under `"Active Projects"` library
- Create these subfolders inside it:
  ```
  "01 Contract"
  "02 Estimate"
  "03 Submittals"
  "04 Drawings"
  "05 Change Orders"
  "06 Closeout"
  "07 Billing"
  "99 Archive - Legacy Files"
  ```
- On success, update `projects.sharepoint_folder` and `projects.sharepoint_item_id` for `projectId`
- Return `{ ok: true, sharepoint_folder }` or `{ ok: false, error }` — non-fatal either way
- If provider token is missing or Graph API call fails, return `{ ok: false, error }` gracefully
  (do not throw a 500 — the project already exists in the DB)

---

## Part G — PM assignment and Microsoft link (design notes)

The `pm_directory` table stores PM email + first_name + optional `profile_id`.
The `projects.pm_directory_id` (added in migration) references `pm_directory.id`.

**Dropdown behavior:**
- New/Edit project form shows PMs from `pm_directory` as `"FirstName (email@domain.com)"`
- Saves `pm_directory.id` as `pm_directory_id` on the project

**Microsoft link (auto-link on sign-in):**
In `src/app/auth/callback/route.ts`, after creating/finding the profile, add:
```ts
// If PM signs in via Microsoft SSO and their email matches a pm_directory entry,
// set pm_directory.profile_id = profile.id (if not already set)
await supabase
  .from("pm_directory")
  .update({ profile_id: profile.id })
  .eq("email", profile.email)
  .is("profile_id", null);
```
This silently links external PMs to their Supabase profile on first Microsoft login.
No UI needed — it happens automatically.

**Adding PMs manually:**
For now, PMs are added directly to `pm_directory` in the Admin → PM Directory tab
(existing functionality). A "Import from Microsoft" button can be added in a future task.

---

## Constraints

- Do not modify `.env.local`
- Do not run any SQL — create migration file only, Timothy runs it manually
- Run `npm run build` after changes, fix only new errors
- Modal should use semantic token classes throughout (no hardcoded colors)
- SharePoint folder creation is fire-and-forget — never block project creation on it

---

## Output

Create `codex/task-014-output.md`:

```
## Files modified
- list each

## Migration file created
- filename and column list

## New Project form
- list required and optional fields implemented

## Edit Project
- yes/no + what fields

## Billed/Paid logic
- describe behavior

## SharePoint provisioning
- describe what the API route does and whether it was wired into the form

## PM auto-link
- describe where the auth callback change was made

## Build result
- "clean" or paste new errors

## Blockers or questions
- any ambiguity, or "none"
```

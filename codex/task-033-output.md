# Task 033 Output

## Completed tasks

### Task 1 - PM portal % complete override
- Made the manual override input usable when no POC items exist.
- Kept the override available when POC items do exist, with a separate calculated reference.
- Preloaded the override field from the current billing period.

### Task 2 - Customer portal rebrand
- Rebuilt `src/app/customer/page.tsx` with a light branded customer-only theme.
- Added the branded header, SDVOSB badge, richer project cards, charts, print styles, and improved weekly update presentation.
- Copied `Logos etc/SDVOSB.jpg` to `public/sdvosb.jpg`.

### Task 3 - Estimator hook
- Added `source_estimate_id` to app types and project editors.
- Added the estimator reference field to the shared project modal.
- Created stub route `POST /api/estimator/sync-poc` with admin/ops manager auth and future implementation notes.

### Task 4 - Schema cleanup in app code
- Removed app-code dependence on deprecated `projects.customer_portal_access` and `projects.customer_email_digest`.
- Verified the customer portal auth flow is using `project_customer_contacts`, not `customers.contact_email`.

### Task 5 - POC UX polish
- Added reorder controls and immediate `sort_order` persistence in `PocSetupSection`.
- Added completion pill styling and weighted-contribution visuals in the project modal.
- Improved PM portal category editing with decimal inputs, dual progress bars, and a live weighted total.

### Task 6 - Admin portal polish
- Added `EST` badge in the admin projects list when `source_estimate_id` is present.
- Added billing indicators for recent weekly updates and whether `% Complete` is POC-calculated or manual.

### Task 7 - Customer feedback
- Added a floating `Leave Feedback` button and inline slide-up panel in the customer project detail page.
- Added an admin `Feedback` tab with unreviewed filtering and `Mark Reviewed`.

### Task 8 - Final verification
- Ran `npm run build` successfully after each task and again at the end.
- Committed and pushed each task incrementally.

## Files modified
- `src/app/pm/page.tsx`
- `src/app/customer/page.tsx`
- `public/sdvosb.jpg`
- `src/types/database.ts`
- `src/components/project-modal.tsx`
- `src/components/admin-projects-tab.tsx`
- `src/components/ops-project-list.tsx`
- `src/app/api/estimator/sync-poc/route.ts`
- `src/app/admin/page.tsx`
- `src/components/billing-table.tsx`
- `codex/task-033-output.md`

## Known issues or limitations
- Migration 020 has not been run yet. Until `projects.source_estimate_id` exists in Supabase, project list/editor queries that select it can fail at runtime.
- Migration 022 has not been run yet. Customer feedback submission and the admin feedback inbox depend on `customer_feedback`.
- The estimator sync endpoint is intentionally a stub. It authenticates and accepts payloads, but it does not yet transform estimate items into `poc_line_items`.
- Migration 021 is destructive and should only be run after backing up the existing `projects.customer_portal_access` and `projects.customer_email_digest` data.

## SQL to run

### Backup first
Run a backup before any destructive schema cleanup:

```sql
-- Backup before Migration 021
CREATE TABLE IF NOT EXISTS projects_customer_settings_backup AS
SELECT id, job_number, name, customer_portal_access, customer_email_digest
FROM projects;
```

### Migration 019 - customer read policies
Run if not already applied:

```sql
CREATE POLICY "Customer reads updates for accessible projects"
  ON weekly_updates FOR SELECT
  USING (
    current_user_role() = 'customer' AND
    EXISTS (
      SELECT 1 FROM project_customer_contacts pcc
      WHERE pcc.project_id = weekly_updates.project_id
        AND pcc.profile_id = auth.uid()
        AND pcc.portal_access = true
    )
  );

CREATE POLICY "Customer reads billing for accessible projects"
  ON billing_periods FOR SELECT
  USING (
    current_user_role() = 'customer' AND
    EXISTS (
      SELECT 1 FROM project_customer_contacts pcc
      WHERE pcc.project_id = billing_periods.project_id
        AND pcc.profile_id = auth.uid()
        AND pcc.portal_access = true
    )
  );
```

### Migration 020 - add estimator reference
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_estimate_id text;
```

### Migration 021 - remove deprecated project customer settings
Destructive. Run only after backing up:

```sql
ALTER TABLE projects DROP COLUMN IF EXISTS customer_portal_access;
ALTER TABLE projects DROP COLUMN IF EXISTS customer_email_digest;
```

### Migration 022 - customer feedback table
```sql
CREATE TABLE customer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  reviewed boolean NOT NULL DEFAULT false
);

ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer inserts own feedback"
  ON customer_feedback FOR INSERT
  WITH CHECK (profile_id = auth.uid() AND current_user_role() = 'customer');

CREATE POLICY "Customer reads own feedback"
  ON customer_feedback FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Admin full access to customer_feedback"
  ON customer_feedback FOR ALL
  USING (current_user_role() IN ('admin', 'ops_manager'));
```

## Testing checklist
- Run migrations 020 and 022 in Supabase. Run 021 only after backup and when ready to remove the deprecated columns.
- Open `/pm` on a project with no POC items and confirm manual `% Complete` entry is available and saves.
- Open `/pm` on a project with POC items and confirm the calculated value, override field, decimal inputs, and live weighted total all work.
- Open `/customer` and verify the branded light theme, logo, SDVOSB badge, charts, weekly update cards, and print layout.
- In Admin > Projects, open a project and confirm the `Estimator Reference ID` field loads and saves.
- In Admin > Projects, verify the `EST` badge appears for projects with `source_estimate_id`.
- In Admin > Billing, verify recent weekly updates show the badge and `% Complete` shows `POC calculated` or `Manual`.
- In the customer project detail page, submit feedback and confirm it appears in Admin > Feedback.
- In Admin > Feedback, toggle `Unreviewed only` and mark a message reviewed.
- Call `POST /api/estimator/sync-poc` with an admin or ops manager session and confirm it returns the stub response.

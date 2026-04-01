# Codex Task 034 — Sprint
**Unattended execution. Commit and push after every numbered task.**
**Do not stop for confirmation. Complete all tasks in order. Fix build errors before moving on.**

---

## Permissions and Authorizations

You are authorized to:
- Read and modify any file in `c:\Users\TimothyCollins\dev\tcc-projecthub\`
- Run `npm run build` after each task to verify compilation
- Run `git add`, `git commit`, `git push` after each task
- Add npm packages **only if essential** — prefer what is already installed
- Create new files, API routes, pages, and migrations
- Write SQL to the appendix — do NOT execute SQL yourself

Already installed packages available to use:
- `exceljs` — Excel generation
- `recharts` — charts
- `date-fns` — date formatting
- `react-hook-form`, `zod` — forms/validation
- `@supabase/supabase-js`, `@supabase/ssr` — Supabase client/server

**No PDF library is installed.** Use the browser print API approach described in Task 2.

**Commit cadence:** One commit per numbered task. Push to `origin/main` immediately after each commit.

---

## Context

Read these files before starting:
- `CLAUDE.md` — project overview and stack
- `src/types/database.ts` — all DB types (recently updated by Codex task 033)
- `src/app/customer/page.tsx` — customer portal (rebranded in task 033)
- `src/app/pm/page.tsx` — PM portal
- `src/components/project-modal.tsx` — project edit modal
- `supabase/migrations/001_initial_schema.sql` — base schema
- `codex/task-033-output.md` — what task 033 completed

**Current schema knowledge:**
- `pm_directory` table: `id, profile_id, first_name, last_name, email, intended_role`
- `project_assignments` table: `id, project_id, profile_id, pm_directory_id, role_on_project`
- `profiles` table: `id, full_name, role, email`
- `projects` table includes: `general_contractor, mechanical_contractor, site_address, customer_poc, job_number`
- `weekly_updates` table includes: `week_of, pct_complete, notes, blockers, crew_log (jsonb), material_delivered, equipment_set, safety_incidents, inspections_tests, delays_impacts, other_remarks, poc_snapshot (jsonb), submitted_at`
- `poc_line_items` table: `id, project_id, category, weight, pct_complete, sort_order`
- Customer portal uses `project_customer_contacts` for access control (not `customers.contact_email`)

---

## Task 1 — Project Contacts on Customer Portal

The customer portal should show who the customer can contact for this project — PM name, lead name, and phone/email if available.

### 1a — Add phone number to pm_directory

The `pm_directory` table has `first_name, last_name, email` but no phone. Add to SQL appendix (migration 023):

```sql
ALTER TABLE pm_directory ADD COLUMN IF NOT EXISTS phone text;
```

Also add `phone: string | null` to the `PmDirectory` interface in `src/types/database.ts`.

### 1b — Add phone to pm_directory admin UI

In the PM Directory tab of the admin page (`src/app/admin/page.tsx`), find where PM directory entries are displayed/edited. Add a phone field input that saves to `pm_directory.phone`. If the PM directory tab renders a list with edit capability, add phone inline. If it renders a static table only, add an edit modal or inline edit. Make it consistent with existing patterns in that file.

### 1c — Customer portal: Project Team section

In `src/app/customer/page.tsx`, in the `ProjectDetail` component, add a **"Your Project Team"** section that appears above the tabs (between the progress header and the chart area).

**Data to fetch:** When loading project detail, also fetch:
```
project_assignments
  .select("role_on_project, profile:profiles(full_name, email), pm_directory:pm_directory(first_name, last_name, email, phone)")
  .eq("project_id", project.id)
  .in("role_on_project", ["pm", "lead"])
```

**Display as a row of contact cards:**
Each card shows:
- Role badge (PM / Lead) in teal
- Full name (from `profile.full_name` or `pm_directory.first_name + last_name`)
- Email as a `mailto:` link (small, gray)
- Phone as a `tel:` link if present (small, gray)
- Card style: white background, teal left border, subtle shadow — matches the customer portal light theme

If no assignments exist, show nothing (do not show an empty section).

**RLS note:** Customers currently have no SELECT policy on `project_assignments`. Add to SQL appendix (migration 023 continued):

```sql
CREATE POLICY "Customer reads assignments for accessible projects"
  ON project_assignments FOR SELECT
  USING (
    current_user_role() = 'customer' AND
    EXISTS (
      SELECT 1 FROM project_customer_contacts pcc
      WHERE pcc.project_id = project_assignments.project_id
        AND pcc.profile_id = auth.uid()
        AND pcc.portal_access = true
    )
  );

CREATE POLICY "Customer reads pm_directory for assigned projects"
  ON pm_directory FOR SELECT
  USING (
    current_user_role() = 'customer' AND
    EXISTS (
      SELECT 1 FROM project_assignments pa
      JOIN project_customer_contacts pcc ON pcc.project_id = pa.project_id
      WHERE pa.pm_directory_id = pm_directory.id
        AND pcc.profile_id = auth.uid()
        AND pcc.portal_access = true
    )
  );
```

Also add a SELECT policy on `profiles` for customers (they currently can't read other users' profiles):

```sql
CREATE POLICY "Customer reads assigned team profiles"
  ON profiles FOR SELECT
  USING (
    current_user_role() = 'customer' AND
    EXISTS (
      SELECT 1 FROM project_assignments pa
      JOIN project_customer_contacts pcc ON pcc.project_id = pa.project_id
      WHERE pa.profile_id = profiles.id
        AND pcc.profile_id = auth.uid()
        AND pcc.portal_access = true
    )
  );
```

### 1d — Also show site address and GC on customer portal

In the same project detail header area (the teal card at the top), add below the project name:
- Site address (if set): shown with a small location pin inline SVG icon
- General contractor (if set): shown as "GC: [name]"

These are already on the `projects` table. Add them to the customer portal's project query select fields.

---

## Task 2 — PDF Export of Weekly Updates

**Approach:** No PDF library is installed. Instead of adding jsPDF or puppeteer (both add significant bundle size / server complexity), use a **dedicated print page** approach:

- Create a Next.js route at `/reports/weekly-update/[id]` that renders a single weekly update as a full-page, print-optimized HTML page
- The page has a `@media print` stylesheet that hides everything except the report content
- A "Print / Save as PDF" button calls `window.print()` — the browser handles PDF generation
- This produces clean, brandable output that matches the proposal template style

This is the same approach used by many professional web apps (GitHub, Linear, Notion) for PDF output.

### 2a — Report page route

Create `src/app/reports/weekly-update/[id]/page.tsx` as a **server component** (no `"use client"` at the top level — use server-side Supabase to fetch data).

The page fetches:
- The weekly update by `id` from `weekly_updates`
- The associated project (name, job_number, site_address, general_contractor, customer_poc)
- The associated customer name (via projects.customer_id → customers.name)
- The PM name (via weekly_updates.pm_id → profiles.full_name or pm_directory joined via project_assignments)

Render a full branded report matching the structure of the daily construction report Excel template the user shared (Mobile Arena Weekly Report.xlsm pattern):

**Report layout:**

```
[TCC Logo]                    [SDVOSB Badge]
THE CONTROLS COMPANY, LLC
Service Disabled Veteran Owned Small Business

──────────────────────────────────────────────────
WEEKLY CONSTRUCTION REPORT
──────────────────────────────────────────────────

Company Name:    The Controls Company, LLC
Project Name:    [project name]
Job Number:      [job_number]
Site Address:    [site_address]
Customer:        [customer name]
Project Manager: [PM name]
Report Date:     [week_of formatted as Month D, YYYY]

──────────────────────────────────────────────────
CREW LOG
──────────────────────────────────────────────────

| Day       | # of Men | Hours | Activities                    |
|-----------|----------|-------|-------------------------------|
| Monday    |    4     |  10   | Put up pipe for panel...      |
| ...       |          |       |                               |

Total Man-Hours: [sum of men * hours across all days]

──────────────────────────────────────────────────
NOTES
──────────────────────────────────────────────────

Material Delivered:    [material_delivered or "None"]
Equipment Set:         [equipment_set or "None"]
Safety Incidents:      [safety_incidents or "None"]
Inspections & Tests:   [inspections_tests or "None"]
Delays / Impacts:      [delays_impacts or "None"]
Other Remarks:         [other_remarks or blank]

──────────────────────────────────────────────────
PROGRESS
──────────────────────────────────────────────────

Overall % Complete: [pct_complete * 100]%

[If poc_snapshot exists, show a table:]
| Category        | Weight | % Complete | Contribution |
|-----------------|--------|------------|--------------|
| AHU's           |  20    |    40%     |    12.6%     |
| ...             |        |            |              |

Blockers / Items Requiring Attention:
[blockers or "None"]

──────────────────────────────────────────────────

General Notes:
[notes or blank]

──────────────────────────────────────────────────
[Footer]
The Controls Company, LLC | thecontrolsco.com
Service Disabled Veteran Owned Small Business
Submitted: [submitted_at formatted]
──────────────────────────────────────────────────
```

**Styling:**
- White background, black text — print-friendly
- Use inline styles or a `<style>` block in the page (not Tailwind utility classes — they may not render correctly in print context without purging)
- TCC brand colors for headers and dividers: `#017a6f`
- Logo: `<img src="/logo.png">` — already in public/
- SDVOSB: `<img src="/sdvosb.jpg">` — copied there by task 033
- Font: system sans-serif stack for print compatibility
- Page size: Letter (8.5" x 11") — use `@page { size: letter; margin: 0.75in; }`

### 2b — Print button and navigation

At the top of the report page (visible on screen, hidden in print):
- "← Back" link that goes to the previous page (use `history.back()` via a client component button)
- "Print / Save as PDF" button that calls `window.print()`
- Both hidden via `@media print { .no-print { display: none; } }`

Create a minimal `src/app/reports/weekly-update/[id]/PrintButton.tsx` client component just for the button (so the parent page can remain a server component).

### 2c — Access control

The report page should be accessible to:
- admin, ops_manager — always
- pm, lead — if they are assigned to the project
- customer — if they have `portal_access = true` in `project_customer_contacts` for the project

Use the server-side Supabase client. If the user is not authorized, redirect to `/login`.

### 2d — Link from PM portal

In `src/app/pm/page.tsx`, in the update history section (the list of past updates at the bottom of `UpdateForm`), add a small "View Report" link next to each historical entry that links to `/reports/weekly-update/[update.id]`. Open in a new tab (`target="_blank"`).

### 2e — Link from customer portal

In `src/app/customer/page.tsx`, in the weekly updates list, add a "View Report" link on each update card that links to `/reports/weekly-update/[update.id]`. Open in a new tab.

### 2f — Link from project modal

In `src/components/project-modal.tsx`, in `WeeklyUpdatesSection`, add a "View Report" link on each update card.

### 2g — Link from ops portal

In `src/components/ops-project-list.tsx`, wherever weekly updates are shown (the `WeeklyUpdatesSection` rendered in the modal), add the same "View Report" link.

---

## Task 3 — Weekly Update History: Admin View

Currently admin can see weekly updates per project in the project modal. Add a dedicated admin view:

### 3a — Weekly Updates tab in admin

In `src/app/admin/page.tsx`, add a "Weekly Updates" tab alongside Billing, Projects, PM Directory, User Management, Feedback.

The tab shows a filterable table of all recent weekly updates across all projects:
- Columns: Project, Customer, PM, Week Of, % Complete, Has Blockers (boolean badge), Submitted At
- Default sort: submitted_at descending (newest first)
- Filter: project name search input (client-side filter)
- Filter: "Blockers only" toggle — shows only updates where blockers is non-null/non-empty
- Each row has a "View Report" link → `/reports/weekly-update/[id]` in new tab
- Fetch last 200 updates ordered by submitted_at desc, join project name and customer name

This gives admin a single place to see all activity across all projects.

### 3b — RLS check

Admin already has full access to weekly_updates. No new policies needed.

---

## Task 4 — PM Portal: Load Last Update on Open

Currently when a PM opens a project's update form, all fields start blank. This is confusing — the PM has to remember what they wrote last time.

When the PM opens the update form for a project:
1. Fetch the most recent weekly update for that project
2. Pre-populate `notes`, `material_delivered`, `equipment_set`, `safety_incidents`, `inspections_tests`, `delays_impacts`, `other_remarks` with the values from the last update as placeholder text (not as value — use `placeholder` attribute so the PM can see what was there last time but types fresh content)
3. Pre-populate `crew_log` men counts only (not hours or activities — hours/activities should be blank each week)
4. The `weekOf` stays as the current Saturday (correct behavior)
5. The % complete fields stay at their current DB values (already correct)

File: `src/app/pm/page.tsx` — in the `loadData` useEffect inside `UpdateForm`

---

## Task 5 — Installer Portal Stub

The installer role exists in the DB and sidebar nav but `/installer` just shows a placeholder. Build a minimal useful page:

### 5a — Read current installer page

Read `src/app/installer/page.tsx` first to understand current state.

### 5b — Build installer dashboard

Replace the placeholder with a real page at `src/app/installer/page.tsx`:

- Header: same dark theme as PM portal
- Show projects assigned to this installer (via `project_assignments` where `role_on_project = 'installer'` and `profile_id = auth.uid()`)
- For each project show:
  - Project name, customer, site address
  - Current % complete (from latest billing period)
  - SharePoint link if `sharepoint_folder` is set
  - Job number
- No weekly update form — installers submit through the lead/PM
- Simple, mobile-friendly card layout (installers are in the field)
- Sort by project name

### 5c — RLS for installer

Installer currently cannot read projects. Add to SQL appendix (migration 024):

```sql
CREATE POLICY "Installer reads assigned projects"
  ON projects FOR SELECT
  USING (
    current_user_role() = 'installer' AND
    EXISTS (
      SELECT 1 FROM project_assignments pa
      WHERE pa.project_id = projects.id
        AND pa.profile_id = auth.uid()
        AND pa.role_on_project = 'installer'
    )
  );

CREATE POLICY "Installer reads billing for assigned projects"
  ON billing_periods FOR SELECT
  USING (
    current_user_role() = 'installer' AND
    EXISTS (
      SELECT 1 FROM project_assignments pa
      WHERE pa.project_id = billing_periods.project_id
        AND pa.profile_id = auth.uid()
        AND pa.role_on_project = 'installer'
    )
  );

CREATE POLICY "Installer reads assignments for own projects"
  ON project_assignments FOR SELECT
  USING (
    current_user_role() = 'installer' AND
    project_id IN (
      SELECT project_id FROM project_assignments
      WHERE profile_id = auth.uid() AND role_on_project = 'installer'
    )
  );
```

---

## Task 6 — Project Status Page (Public-Facing Stub)

Create a public (no auth required) project status page at `/status/[job_number]`. This is a future feature for customers to check project status without logging in — build a clean stub now.

### 6a — Route

Create `src/app/status/[job_number]/page.tsx` as a server component.

- If a project with that `job_number` exists AND has any customer contact with `portal_access = true`:
  - Show: project name, current % complete (from latest billing period), last update date, "Contact us" link (mailto:info@thecontrolsco.com)
  - Do NOT show financial data, crew log details, or internal notes
  - Simple branded page matching customer portal light theme
- If no project found or no portal access configured: show a generic "Project not found" message
- No auth required — use the service role key to read this data (the data shown is intentionally minimal/public)

### 6b — Add job_number to middleware public paths

In `src/lib/supabase/middleware.ts`, add `/status` to the `publicPaths` array so it bypasses auth redirect.

### 6c — Link from customer portal

In the customer portal project detail header, add a small "Public Status Link" that shows the URL `/status/[job_number]` (copy-to-clipboard button) so customers can share their project status with others without giving them portal login.

Only show this if `job_number` is set.

---

## Task 7 — Cleanup and Polish

### 7a — Consistent "View Report" link style

Ensure all "View Report" links added in Task 2 use the same style: small teal text link with an external link icon (inline SVG `↗` or a simple box-arrow SVG). Define a reusable component `src/components/view-report-link.tsx`:

```tsx
export function ViewReportLink({ updateId }: { updateId: string }) {
  return (
    <a
      href={`/reports/weekly-update/${updateId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline"
    >
      View Report
      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 10L10 2M6 2h4v4" />
      </svg>
    </a>
  );
}
```

Import and use this component everywhere a "View Report" link appears.

### 7b — Loading skeletons

Add simple loading skeleton placeholders (gray animated pulse divs) to:
- Customer portal project list (while fetching)
- Customer portal project detail (while fetching team and updates)
- PM portal project list (while fetching)

Use Tailwind `animate-pulse bg-gray-200 rounded` pattern. Keep it simple — just 3-4 skeleton rows.

### 7c — Empty state illustrations

For the customer portal when no projects are accessible, replace the plain text with a more polished empty state:
- Centered layout
- TCC logo (small)
- "No projects found" heading
- "Your project access hasn't been set up yet. Contact The Controls Company to get started."
- "Contact Us" button as a `mailto:` link

### 7d — Error boundaries

Wrap the customer portal and PM portal main content in a simple React error boundary. If an unhandled error occurs, show a friendly message instead of a blank page. Create `src/components/error-boundary.tsx` as a class component (required for React error boundaries) with a simple "Something went wrong. Please refresh." UI matching each portal's theme.

---

## Task 8 — Final Build + Report

1. Run `npm run build` — fix all TypeScript errors
2. Push all remaining changes
3. Write report to `codex/task-034-output.md` with:
   - Completed tasks (what was done)
   - Files modified
   - Known issues or limitations
   - **SQL appendix** — all migrations consolidated and labeled:
     - Migration 023: phone column + customer RLS for assignments/pm_directory/profiles
     - Migration 024: installer RLS policies
     - Any other SQL generated
   - Testing checklist

---

## Execution Rules

- **Read files before editing them**
- **Commit and push after each numbered task** — do not batch
- **Fix TypeScript errors immediately** — do not leave the build broken
- **Do not add npm packages** unless truly unavoidable (and document it if you do)
- **Do not modify Timothy's admin account or any credentials**
- **Do not run SQL** — collect all in the appendix
- **If a task is blocked**, skip it, note it, continue to next
- **Server components vs client components**: The report page (Task 2) must be a server component for data fetching. Use a minimal client component only for `window.print()` interactivity. All other new pages follow existing patterns in the codebase.

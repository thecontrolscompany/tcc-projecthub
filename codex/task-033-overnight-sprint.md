# Codex Task 033 — Overnight Sprint
**Unattended execution. Commit and push after every logical unit of work.**
**Do not wait for user confirmation between tasks. Complete all tasks in order.**

---

## Permissions and Authorizations — Read This First

You are authorized to:
- Read and modify any file in `c:\Users\TimothyCollins\dev\tcc-projecthub\`
- Read (but not modify) files in `c:\Users\TimothyCollins\dev\hvac-estimator\` for reference only
- Run `npm run build` to verify each change compiles
- Run `git add`, `git commit`, `git push` — push after every task section
- Create new files and migrations
- Refactor, rename, and restructure code
- Drop unused DB columns (list them in the SQL appendix at the end — do NOT run them yourself)
- Install no new npm packages unless absolutely necessary

You are NOT authorized to:
- Run Supabase SQL directly — collect all migration SQL into the appendix at the end
- Modify anything in the hvac-estimator repo
- Change Timothy Collins's admin role or credentials
- Delete git history

**Commit cadence:** Commit and push at the end of each numbered task below. Use descriptive commit messages. Do not batch all work into one commit.

---

## Context

**App:** TCC ProjectHub — `c:\Users\TimothyCollins\dev\tcc-projecthub\`
**Stack:** Next.js 16 App Router, TypeScript, Supabase, Tailwind CSS, Vercel
**CLAUDE.md** and all files in `codex/` are your reference documents.

**Key files to read before starting:**
- `src/types/database.ts` — all DB types
- `src/app/customer/page.tsx` — customer portal (primary focus for branding)
- `src/app/pm/page.tsx` — PM portal (% complete fix)
- `src/components/project-modal.tsx` — project edit modal
- `src/components/sidebar-nav.tsx` — nav + roles
- `tailwind.config.ts` — current design tokens
- `supabase/migrations/` — read all to understand current schema (migrations 001–019)

**Brand assets (read-only reference):**
- Logo: `C:/Users/TimothyCollins/dev/tcc-projecthub/Logos etc/TCC_v6.png`
- SDVOSB badge: `C:/Users/TimothyCollins/dev/tcc-projecthub/Logos etc/SDVOSB.jpg`
- Proposal template: `C:/Users/TimothyCollins/dev/tcc-projecthub/Logos etc/HVAC Control Installation Proposal-Template.docx`

**TCC Brand Colors (extracted from TCC_v6.png and Colors.png):**
- Primary teal: `#017a6f` (dark teal, dominant in logo)
- Bright teal/cyan: `#20b2aa`
- Brand green: `#3cb54a`
- Light green: `#8dc63f`
- Charcoal: `#2d3748`
- Light background: `#f0faf9` (teal-tinted white for customer portal)

**Company identity:** The Controls Company, LLC — Service Disabled Veteran Owned Small Business (SDVOSB). HVAC/controls contractor.

---

## Task 1 — Fix % Complete Manual Override in PM Portal

**Problem:** When no POC line items are configured for a project, the PM sees a message saying "Ask admin to set up POC categories" and cannot enter a manual % complete. The override input exists but the display value is read-only looking and confusing.

**Fix:**
1. When no POC items exist, show the manual override input prominently with clear label "Enter % Complete"
2. When POC items exist, show the calculated value AND the override input below it labeled "Override calculated value"
3. The override input should always be functional — clear it to revert to POC calculation
4. The override number input should allow decimal (0.0–100.0), step 0.1
5. Pre-populate the override field with the current period's pct_complete when opening the form so the PM always sees the current value

File: `src/app/pm/page.tsx`

---

## Task 2 — Customer Portal: Full Rebrand + Charts

The customer portal (`src/app/customer/page.tsx`) is the most client-facing part of the app. It needs to look professional, branded, and print-ready. This is what customers see when they log in to track their project.

### 2a — Light theme for customer portal only

The main app uses a dark theme. The customer portal should use a **light theme** — white/teal-tinted background, dark text, TCC brand colors as accents. Do NOT change the dark theme for any other route.

Apply inline or scoped CSS — do not alter `tailwind.config.ts` global tokens. Use Tailwind's `bg-white`, `text-gray-900`, and custom hex colors via inline style or Tailwind arbitrary values where needed.

Brand palette to use in customer portal:
- Page background: `#f0faf9`
- Header/footer background: `#017a6f`
- Header text: white
- Accent / progress bars: `#20b2aa`
- Section borders: `#b2dfdb`
- Card backgrounds: white with subtle shadow
- Chart colors: `#017a6f`, `#20b2aa`, `#3cb54a`, `#8dc63f`

### 2b — Branded header

Replace the plain header with:
- Dark teal (`#017a6f`) full-width header bar
- TCC logo: use `/logo.png` (already in public/) — white text next to it
- Subtitle: "Project Portal" in smaller weight
- Right side: user email + sign out button (white outlined)
- Below logo on left: small SDVOSB badge image — copy `SDVOSB.jpg` from `Logos etc/` into `public/sdvosb.jpg` and reference it as `<img src="/sdvosb.jpg">` with height 32px

### 2c — Project list cards

Redesign project cards to be richer:
- White card with subtle drop shadow and teal left border (4px, `#017a6f`)
- Project name in bold charcoal
- Customer company name below in gray
- Large circular progress indicator (SVG donut or simple arc) showing % complete in teal
- Last update date
- "View Details →" link in teal

### 2d — Project detail page — add Recharts charts

Install recharts is already installed. Import from `recharts`.

Add two charts to the project detail view:

**Chart 1: Progress Over Time** (LineChart)
- X axis: week_of dates from weekly_updates, formatted as "MMM d"
- Y axis: 0–100%
- One line: pct_complete * 100
- Color: `#017a6f`
- Clean, minimal — no gridlines except horizontal, no legend needed
- Show a dot on each data point
- Tooltip showing date + %

**Chart 2: Billing Summary** (BarChart, only if billing_periods exist)
- X axis: period_month formatted as "MMM 'yy"
- Two bars per period: "Billed" (actual_billed) and "Contract Value" (estimated_income_snapshot) — but only show if actual_billed is non-null
- Colors: `#017a6f` for billed, `#b2dfdb` for background/target
- Currency formatted tooltips

Place charts between the progress header and the tabs.

### 2e — Weekly updates view

Make each update card look like a mini report entry:
- Date as prominent header (e.g., "Week of April 5, 2026")
- Progress % badge (teal pill)
- Notes in readable body text
- If crew_log exists and has non-zero entries: show a compact crew summary table (Day | Men | Hours | Activities)
- If material_delivered, equipment_set, delays_impacts, safety_incidents are present: show as labeled rows with small icons (use inline SVG, no icon library needed)
- If blockers: show in amber/warning style

### 2f — Print styles

Add a `@media print` CSS block (in a `<style>` tag or a `globals.css` addition scoped to the customer route) that:
- Hides the sign out button and navigation
- Forces white background
- Expands all collapsed sections
- Shows TCC header and SDVOSB badge
- Keeps the Recharts charts (they render as SVG, which prints fine)
- Adds a footer with "The Controls Company, LLC | Service Disabled Veteran Owned Small Business | thecontrolsco.com"

---

## Task 3 — HVAC Estimator Integration Hook

The hvac-estimator app lives at `c:\Users\TimothyCollins\dev\hvac-estimator\` and is a separate React/Vite SPA (read the ARCHITECTURE.md there for full context). It currently uses localStorage. The long-term plan is for POC line items in ProjectHub to be seeded from estimates built in that tool.

**Do not modify the estimator repo.** Build the hook in ProjectHub only.

### 3a — Add `source_estimate_id` to projects table

Add this to the SQL appendix (migration 020):
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_estimate_id text;
```
This stores a reference to the estimate ID from the hvac-estimator localStorage schema. When the estimator migrates to a real backend, this becomes a foreign key.

### 3b — Add field to Project type and project modal

- Add `source_estimate_id: string | null` to the `Project` interface in `src/types/database.ts`
- Add a text input field in the project modal under the "Notes" section, labeled "Estimator Reference ID" with helper text "Paste the estimate ID from estimates.thecontrolscompany.com — used to link POC categories to the original estimate"
- Save/load it like other project fields in `admin-projects-tab.tsx` and `ops-project-list.tsx`

### 3c — Stub API endpoint

Create `src/app/api/estimator/sync-poc/route.ts`:

```
POST /api/estimator/sync-poc
Body: { project_id: string, estimate_payload: EstimatePayload }
```

This endpoint receives an estimate payload (future: posted by the estimator when it gains a backend) and would:
1. Validate the caller is authenticated with admin or ops_manager role
2. Parse the estimate payload's line items
3. (STUB) Log the payload and return `{ message: "Stub — POC sync not yet implemented", project_id, received_items: number }`

The stub should be well-commented explaining what the full implementation will do:
- Map estimate assemblies (VAV, AHU, FCU etc.) to poc_line_items categories
- Set weights proportional to assembly labor hours
- Set initial pct_complete to 0
- Delete and recreate poc_line_items for the project

Add a `EstimatePayload` interface to `src/types/database.ts` with:
```ts
export interface EstimatePayload {
  estimate_id: string;
  project_name: string;
  items: Array<{
    id: string;
    type: string; // "VAV", "AHU", "FCU", etc.
    quantity: number;
    labor_hours: number;
    description: string;
  }>;
}
```

---

## Task 4 — Schema Cleanup (Additive + Deprecations)

### 4a — Dead columns

Add to SQL appendix (migration 021 — destructive, run manually):
```sql
-- These columns are no longer the source of truth; project_customer_contacts is used instead
ALTER TABLE projects DROP COLUMN IF EXISTS customer_portal_access;
ALTER TABLE projects DROP COLUMN IF EXISTS customer_email_digest;
```

Also remove references to these columns from:
- `src/types/database.ts` — remove from `Project` interface
- `src/components/admin-projects-tab.tsx` — remove from select fields, save payload, form load
- `src/components/ops-project-list.tsx` — remove from select fields
- `src/components/project-modal.tsx` — remove from `ProjectFormValues` type and `EMPTY_PROJECT_FORM`
- Any other file that references `customer_portal_access` or `customer_email_digest`

Use grep to find all references before removing.

### 4b — customers table vs profiles

The `customers` table stores company names. The `profiles` table stores individual users. These serve different purposes — do NOT consolidate them. However:

- The old customer portal code used to look up by `customers.contact_email` matching a user's email — this is now replaced by `project_customer_contacts`. Remove any remaining dead code paths that still reference `customers.contact_email` for auth purposes.
- `projects.pm_id` is partially redundant with `project_assignments` but is used in some billing queries and as a quick lookup. Leave it in place.

### 4c — DB snapshot helper comment

At the top of the SQL appendix, add instructions for Timothy to take a manual snapshot before running migration 021:
```
-- BEFORE running migration 021, take a snapshot:
-- In Supabase dashboard: Database → Backups → Create backup
-- Or run: pg_dump -h <host> -U postgres <db> > snapshot_$(date +%Y%m%d).sql
```

---

## Task 5 — POC Line Items UX Polish

The `PocSetupSection` in the project modal and the POC editor in the PM portal need polish:

### 5a — Reorder support in PocSetupSection

Add up/down arrow buttons next to each line item to change `sort_order`. When clicked:
- Swap the `sort_order` values of the item and its neighbor
- Update both rows in Supabase immediately
- Re-sort the local state

### 5b — Show current % in PocSetupSection

Each line item row already shows its `pct_complete` from the DB. Make it a readable pill badge (e.g., green if > 50%, yellow 20–50%, gray < 20%).

### 5c — Weighted contribution display

For each item show: `(weight / totalWeight * 100).toFixed(0)% of total` — this is already there but make it clearer, shown as a small progress bar segment showing their relative contribution.

### 5d — PM portal POC editor improvement

When POC items exist in the PM portal form:
- Show each category's current value as a number input (not a range slider — sliders were removed but confirm they are gone)
- Show a mini progress bar below each input showing current value visually
- Show the running weighted total updating live as values change
- Group under heading "% Complete by Category"

---

## Task 6 — Admin Portal Polish

Small improvements to the admin experience:

### 6a — Show source_estimate_id badge on projects tab

In `admin-projects-tab.tsx`, in the project list table row, if `source_estimate_id` is set, show a small "EST" badge in teal next to the project name, similar to how the SP (SharePoint) badge works.

### 6b — Weekly updates visible in admin billing table

In the admin billing table (`src/components/billing-table.tsx`), add a small indicator in the project row if there are recent weekly updates (submitted in the last 14 days). A simple dot or "Updated" badge is sufficient. Fetch update timestamps in the billing data load.

### 6c — POC % shown in billing table

The billing table already shows pct_complete from billing_periods. If poc_line_items exist for the project, add a tooltip or sub-label showing "POC calculated" vs "Manual" so admin knows whether the % came from the POC system or was manually set.

This is display only — no new queries needed beyond what's already loaded. Add a boolean `poc_driven` to the billing row by checking if the project has any poc_line_items (this can be a join in the existing query or a separate fetch).

---

## Task 7 — Customer Portal: Feedback Button

Add a simple feedback mechanism to the customer portal:

### 7a — "Leave Feedback" button on each project detail page

Floating button (fixed bottom-right, teal) that opens an inline panel (not a modal) sliding up from the bottom:
- Text area: "Your feedback or questions"
- Submit button
- On submit: INSERT into a new `customer_feedback` table (see SQL appendix migration 022)
- Show success message, close panel

### 7b — Migration 022 SQL (appendix only — do not run)

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

### 7c — Admin feedback inbox

Add a "Feedback" tab to the admin page (alongside Billing, Projects, PM Directory, User Management). Show a simple table of all unreviewed feedback with:
- Project name, customer email, message, timestamp
- "Mark Reviewed" button that sets `reviewed = true`
- Filter: "Unreviewed only" toggle

---

## Task 8 — Final Build Verification + Report

1. Run `npm run build` — fix any TypeScript or compilation errors before committing
2. Run `git add -A` for any uncommitted changes and push
3. Write a report as `codex/task-033-output.md` containing:

### Report sections:
- **Completed tasks** — what was done in each task
- **Files modified** — list every file changed
- **Known issues or limitations** — anything that couldn't be completed or needs attention
- **SQL to run** — ALL migrations in order, consolidated and clearly labeled:
  - Migration 019: (if not already run — customer RLS policies)
  - Migration 020: source_estimate_id column
  - Migration 021: DROP customer_portal_access, customer_email_digest (DESTRUCTIVE — take backup first)
  - Migration 022: customer_feedback table
  - Any other SQL discovered during implementation
- **Testing checklist** — step-by-step for Timothy to verify each feature after running the SQL

---

## Execution Notes

- **Do not ask for clarification** — make reasonable decisions and document them in the output report
- **Commit after each task** — push to main (Vercel auto-deploys from main)
- **If a task is blocked**, skip it, note it in the report, and continue
- **Prefer editing existing files** over creating new ones
- **Do not add new npm packages** — recharts, date-fns, and all needed libraries are already installed
- **TypeScript strictness** — the build must pass clean with zero errors
- **Do not change Timothy's admin role** or any auth credentials
- **The SDVOSB.jpg file** must be copied from `Logos etc/SDVOSB.jpg` to `public/sdvosb.jpg` as part of task 2b

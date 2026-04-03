# Task 050 — Portal Feedback Page

## Context

Two feedback surfaces:
1. **Customer feedback** — customers can submit feedback from the customer portal on any project.
   Already built in task-033 as a floating button + slide-up panel, but the `customer_feedback`
   table may not have been migrated yet. Verify it works end-to-end.
2. **Internal /feedback page** — a new page in the portal for any authenticated user
   (PM, ops_manager, admin) to submit ideas, bugs, or suggestions that land in GitHub Issues
   via the existing portal, or at minimum into a `portal_feedback` Supabase table.

**IMPORTANT:** Migration 028 (`customer_feedback` table) must be run in Supabase before
this task will work. Confirm the table exists before writing code that depends on it.
Check by running: `SELECT to_regclass('public.customer_feedback');`
If it returns null, the table doesn't exist — write the migration SQL file
`supabase/migrations/026_customer_feedback.sql` with the schema below and note it
needs to be run manually.

---

## Part 1 — Verify and fix customer feedback (customer portal)

Check `src/app/customer/page.tsx` for the existing feedback panel.
Verify:
- The "Leave Feedback" button is present
- The slide-up panel has a textarea and submit button
- The submit calls `POST /api/customer/feedback` or similar
- The admin page has a Feedback tab

If any of these are missing or broken, implement them fully.

### Customer feedback API route (if missing)
`POST /api/customer/feedback`
- Auth: customer role only
- Body: `{ project_id: string, message: string }`
- Inserts into `customer_feedback`

### Admin feedback tab (if missing or incomplete)
In `src/app/admin/page.tsx`, add a "Feedback" tab to the Tab type and tab bar.
Tab content: table of all `customer_feedback` rows with:
- Project name, customer name, message, submitted_at
- "Unreviewed only" toggle
- "Mark Reviewed" button per row (PATCH `reviewed = true`)

---

## Part 2 — New /feedback page (internal team)

Create `src/app/feedback/page.tsx` — authenticated (admin, pm, ops_manager, lead).
This is where your team submits ideas and bug reports while using the portal.

### Page layout

```
Header: "Submit Feedback"
Subtext: "Report a bug, suggest a feature, or share an idea."

Form:
  Type:        [Bug Report] [Feature Idea] [UX Issue] [Other]  ← pill toggle
  Title:       [text input, required]
  Description: [textarea, 4 rows, required]
  Priority:    [Low] [Medium] [High]  ← pill toggle, default Medium
  Page/Area:   [text input, optional] — e.g. "PM Portal", "Billing Table"
  
  [Submit Feedback]
```

### Data model — `portal_feedback` table

Write migration file `supabase/migrations/027_portal_feedback.sql`:
```sql
CREATE TABLE IF NOT EXISTS portal_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL REFERENCES profiles(id),
  type         text NOT NULL CHECK (type IN ('bug', 'feature', 'ux', 'other')),
  title        text NOT NULL,
  description  text NOT NULL,
  priority     text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  page_area    text,
  status       text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'planned', 'done', 'wont_fix')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portal_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users insert feedback"
  ON portal_feedback FOR INSERT
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Admin reads all feedback"
  ON portal_feedback FOR ALL
  USING (current_user_role() IN ('admin', 'ops_manager'));

CREATE POLICY "User reads own feedback"
  ON portal_feedback FOR SELECT
  USING (submitted_by = auth.uid());
```

### API route

`POST /api/feedback` — inserts into `portal_feedback`.
`GET /api/feedback` — admin/ops_manager only, returns all rows ordered by created_at desc.
`PATCH /api/feedback` — admin/ops_manager only, updates status field.

### Admin inbox

Add a "Team Feedback" section to the admin Feedback tab (or a sub-tab within it):
- Table: Type badge | Title | Description | Priority | Page/Area | Submitted By | Date | Status
- Status dropdown per row (new → reviewing → planned → done → wont_fix)
- Filter by type and status

### Sidebar nav

Add "Feedback" link to the sidebar for roles: admin, pm, ops_manager, lead.
Icon: a speech bubble SVG.
Path: `/feedback`

Add to `src/lib/supabase/middleware.ts` allowed paths: `/feedback` is authenticated
(already handled by middleware for any logged-in user, but confirm).

---

## Files to change / create

- `src/app/feedback/page.tsx` — new page
- `src/app/api/feedback/route.ts` — new API route (GET + POST + PATCH)
- `src/app/admin/page.tsx` — add/verify Feedback tab with both customer + team feedback
- `src/app/customer/page.tsx` — verify customer feedback button/panel works
- `src/components/sidebar-nav.tsx` — add Feedback nav link
- `supabase/migrations/027_portal_feedback.sql` — new migration file (needs manual run)

---

## Acceptance criteria

- [ ] Authenticated PM/admin can open `/feedback`, fill out form, and submit
- [ ] Submission appears in Admin → Feedback tab under "Team Feedback"
- [ ] Admin can change status of a feedback item
- [ ] Customer feedback button visible on customer portal project cards
- [ ] Customer feedback submissions appear in Admin → Feedback tab under "Customer Feedback"
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `Add /feedback page and admin feedback inbox (customer + team)`
Push to main. Create `codex/task-050-output.md`.

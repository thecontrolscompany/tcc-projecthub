# Task 031 — Quote Requests Workflow

## Context
TCC ProjectHub is a Next.js 16 / Supabase / Tailwind app for The Controls Company LLC.
The `/quotes` route currently renders a stub page. This task builds it into a full workflow.

## Goal
Expand `/quotes` into a working quote request pipeline with status tracking, admin management, and a public intake form.

## Database migration — `supabase/migrations/010_quote_requests.sql`

Create this file:

```sql
CREATE TABLE IF NOT EXISTS quote_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- Contact info
  company_name  text NOT NULL,
  contact_name  text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,

  -- Project info
  project_description text NOT NULL,
  site_address        text,
  estimated_value     numeric(12,2),

  -- Workflow
  status  text NOT NULL DEFAULT 'new'
            CHECK (status IN ('new','reviewing','quoted','won','lost')),
  notes   text,

  -- Link to project once won
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL
);

ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- Public insert (intake form — no auth required)
CREATE POLICY "Public submits quotes" ON quote_requests FOR INSERT WITH CHECK (true);

-- Admin reads/manages all
CREATE POLICY "Admin manages quotes" ON quote_requests FOR ALL USING (
  current_user_role() = 'admin'
) WITH CHECK (current_user_role() = 'admin');
```

**Do not run this migration** — Timothy runs it manually in Supabase SQL editor.

## TypeScript types — `src/types/database.ts`

Add to the existing exports:

```ts
export type QuoteRequestStatus = 'new' | 'reviewing' | 'quoted' | 'won' | 'lost';

export type QuoteRequest = {
  id: string;
  created_at: string;
  updated_at: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  project_description: string;
  site_address: string | null;
  estimated_value: number | null;
  status: QuoteRequestStatus;
  notes: string | null;
  project_id: string | null;
};
```

## Files to create / modify

### 1. Public intake form — `src/app/quotes/page.tsx`
Replace the stub. This page has two modes:
- **Unauthenticated / customer**: Show the intake form (company, contact name, email, phone, description, site address, estimated value). On submit, POST to `/api/quotes/submit`. Show a success message after submit. No login required.
- **Admin**: Show the admin quote management table (see below) instead of the intake form. Detect role server-side via Supabase session.

For admin, fetch all quote_requests ordered by created_at DESC. Display in a table: Date, Company, Contact, Email, Estimated Value, Status (colored badge), Actions.

Status badge colors:
- `new` → amber
- `reviewing` → blue
- `quoted` → purple
- `won` → green
- `lost` → slate/muted

### 2. Public submit API — `src/app/api/quotes/submit/route.ts`
```
POST /api/quotes/submit
Body: { company_name, contact_name, contact_email, contact_phone?, project_description, site_address?, estimated_value? }
```
- Validate required fields with Zod (company_name, contact_name, contact_email, project_description)
- Insert into quote_requests using the Supabase anon client (no auth required — RLS allows public insert)
- Return `{ id }` on success

### 3. Admin update API — `src/app/api/quotes/update/route.ts`
```
PATCH /api/quotes/update
Body: { id, status?, notes?, project_id? }
```
- Require admin role (check profiles.role)
- Update quote_requests row
- Return updated row

### 4. Quote detail / edit modal — inline on `/quotes` page for admin
When admin clicks a row, open a slide-over or modal showing:
- All submitted fields (read-only)
- Editable: Status dropdown, Notes textarea
- If status is `won`: show a "Convert to Project" button (just sets project_id linking — actual pre-fill is a future task)
- Save calls PATCH `/api/quotes/update`

### 5. Update sidebar nav — `src/components/sidebar-nav.tsx`
The Quotes nav item should only be visible to `admin` and `customer` roles (not pm/lead/installer/ops_manager unless they also need it — keep it admin + customer for now).

## Behavior notes
- The intake form at `/quotes` is the same URL for everyone. Admins see the management table; everyone else sees the form.
- No authentication gate on the intake form — customers and prospects can submit without an account.
- Status workflow: new → reviewing → quoted → won / lost. Admin can set any status directly.
- Do not implement "Convert to Project" functionality yet (future Task 032) — just show a disabled button with tooltip "Coming soon" when status is won.

## Output checklist
- [ ] `supabase/migrations/010_quote_requests.sql` created (not run)
- [ ] `src/types/database.ts` updated with QuoteRequest type
- [ ] `src/app/quotes/page.tsx` — intake form (public) + admin table (admin)
- [ ] `src/app/api/quotes/submit/route.ts` — public insert
- [ ] `src/app/api/quotes/update/route.ts` — admin PATCH
- [ ] Admin edit modal/panel inline in quotes page
- [ ] `npm run build` passes clean
- [ ] Commit as `Add quote requests workflow (task-031)` and push to origin main

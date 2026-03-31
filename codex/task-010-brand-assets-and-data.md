# Task 010 — Brand Assets, Font Installation, Middleware Fix + Billing Seed

## Context

Tasks 001–009 are complete. The app is running on localhost:3000 with:
- Supabase connected (real project at vzjjkssngkoedikbggbb.supabase.co)
- Azure AD configured (tenant: controlsco.net, app: TCC ProjectHub)
- SharePoint migration running/complete (TCCProjects site)
- Semantic token system live, sidebar shell working, ThemeProvider in place

The following are broken/missing and need fixing in this task:
- `logo.png` returns 404 — sidebar shows text fallback
- All Raleway font files return 404 — app is using system-ui fallback
- Next.js warns: "middleware file convention is deprecated, use proxy instead"
- Projects table has migration data but no billing periods, PMs, or customers

## Read before starting

- `src/app/globals.css` (existing @font-face declarations)
- `src/components/sidebar-nav.tsx` (logo usage)
- `src/app/layout.tsx` (font-body class)
- `src/middleware.ts`
- `supabase/seed.sql`
- `supabase/migrations/001_initial_schema.sql` (schema reference)

## Read these asset directories (they exist in the repo)

List the contents of `Logos etc/` to find available logo files.
List the contents of `Logos etc/Raleway-FontZillion/Fonts/` to find TTF files.

---

## Part A — Copy Logo to public/

1. Read `Logos etc/` directory listing
2. Copy `Logos etc/Logo_Horizontal.png` → `public/logo.png`
3. Copy `Logos etc/Logo_Horizontal.png` → `public/logo-light.png` (same file, used on dark bg)
4. If a file named `New Logo.png` or `New Logo_2.png` exists, copy the largest/clearest one
   to `public/logo-new.png` for Timothy to review later — do not replace `public/logo.png` with it

---

## Part B — Copy Raleway Fonts to public/fonts/

1. List all `.ttf` files in `Logos etc/Raleway-FontZillion/Fonts/`
2. Copy these specific weights to `public/fonts/` with normalized names:
   - Regular (400): → `public/fonts/raleway-regular.ttf`
   - Medium (500): → `public/fonts/raleway-medium.ttf`
   - SemiBold (600): → `public/fonts/raleway-semibold.ttf`
   - Bold (700): → `public/fonts/raleway-bold.ttf`

   Match by filename keywords: "Regular", "Medium", "SemiBold", "Bold"
   If a file has "Italic" in the name, skip it.

3. Verify `src/app/globals.css` already has @font-face declarations pointing to
   `/fonts/raleway-regular.woff2`, `/fonts/raleway-medium.woff2`, etc.
   Update the declarations to also include the `.ttf` fallback paths pointing to the copied files.
   The woff2 files don't exist yet — that's fine, the ttf fallback will be used.

---

## Part C — Fix Middleware Deprecation

Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts`.

1. Read `src/middleware.ts`
2. Create `src/proxy.ts` with identical contents
3. Delete `src/middleware.ts`

This eliminates the build warning: "The middleware file convention is deprecated. Please use proxy instead."

---

## Part D — Billing Seed Script

The `projects` table has migration records but they're missing: `customer_id`, `pm_id`,
`estimated_income`. Billing periods don't exist for any project.

Create `supabase/seed-billing.sql` — a script Timothy can run to:

1. Insert a sample customer:
```sql
INSERT INTO customers (id, name, contact_email)
VALUES ('00000000-0000-0000-0000-000000000001', 'Sample Customer', 'customer@example.com')
ON CONFLICT DO NOTHING;
```

2. Insert a sample PM (profile must already exist — this just adds to pm_directory):
```sql
-- After Timothy creates a PM user in Supabase Auth dashboard,
-- run this to add them to pm_directory:
-- INSERT INTO pm_directory (profile_id, first_name, email)
-- VALUES ('<pm-user-id>', 'First', 'pm@controlsco.net');
```

3. Create billing periods for the current month for all active projects that lack one:
```sql
INSERT INTO billing_periods (project_id, period_month, estimated_income_snapshot, pct_complete, prev_billed)
SELECT
  p.id,
  date_trunc('month', CURRENT_DATE)::date,
  COALESCE(p.estimated_income, 0),
  0,
  0
FROM projects p
WHERE p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM billing_periods bp
    WHERE bp.project_id = p.id
      AND bp.period_month = date_trunc('month', CURRENT_DATE)::date
  )
ON CONFLICT (project_id, period_month) DO NOTHING;
```

Add a comment at the top of the file:
```sql
-- TCC ProjectHub — Billing Seed
-- Run this after the SharePoint migration to create initial billing periods
-- for all active projects. Run in Supabase SQL Editor.
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING).
```

---

## Part E — Update Sidebar Logo

In `src/components/sidebar-nav.tsx`, the logo `onError` handler currently replaces the
image with text when it fails to load. Update the img tag to also try the correct path:

```tsx
<img
  src="/logo.png"
  alt="TCC ProjectHub"
  className="h-8 w-auto"
  onError={(e) => {
    e.currentTarget.style.display = 'none'
    e.currentTarget.nextElementSibling?.removeAttribute('hidden')
  }}
/>
<span hidden className="text-text-primary font-heading font-semibold text-lg">
  TCC ProjectHub
</span>
```

---

## Constraints

- Do not modify `.env.local`
- Run `npm run build` after all changes — fix only new errors
- Note in output that Timothy must run `supabase/seed-billing.sql` manually in Supabase SQL editor

---

## Output

Create `codex/task-010-output.md`:

```
## Files created or modified
- list each

## Logo files copied
- list source → destination

## Font files copied
- list source → destination for each weight

## Middleware fix
- confirmed proxy.ts created and middleware.ts deleted

## Build result
- "clean" or paste new errors

## Follow-up for Timothy
- Run supabase/seed-billing.sql in Supabase SQL editor to create initial billing periods

## Blockers or questions
- any ambiguity, or "none"
```

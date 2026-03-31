# Task 006 — Localhost Preview + Remaining Token Cleanup

## Goals

1. Make the app render visibly on `http://localhost:3000` without a live Supabase project
2. Clean up the remaining unmapped color classes from task-005
3. Confirm `npm run dev` starts without crashing

---

## Part A — Environment Placeholder

Create `.env.local` in the project root (copy from `.env.local.example`) with these placeholder values.
These are fake but structurally valid — they allow the Supabase client to initialize without throwing on import.

```
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkwMDAwMDAwMH0.placeholder
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxOTAwMDAwMDAwfQ.placeholder
NEXT_PUBLIC_AZURE_CLIENT_ID=00000000-0000-0000-0000-000000000000
NEXT_PUBLIC_AZURE_TENANT_ID=00000000-0000-0000-0000-000000000000
NEXT_PUBLIC_POWERBI_WORKSPACE_ID=
NEXT_PUBLIC_POWERBI_REPORT_ID=
POWERBI_CLIENT_SECRET=placeholder
NEXT_PUBLIC_APP_URL=http://localhost:3000
SHAREPOINT_SITE_ID=
```

---

## Part B — Graceful Null Handling in Layouts and Pages

The layouts fetch the current user from Supabase. With placeholder credentials, this returns null
instead of throwing. Pages must render an empty/loading state rather than crashing.

### `src/app/admin/layout.tsx`

Wrap the Supabase calls in a try/catch:
```ts
let profile = null
try {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data } = await supabase.from("profiles").select("role, email").eq("id", user.id).single()
    profile = data
  }
} catch {
  // Supabase not configured — render shell with defaults
}
```
Pass `profile?.role ?? "admin"` and `profile?.email ?? "dev@localhost"` to AppShell.

### `src/app/pm/layout.tsx`

Same try/catch pattern. Pass `profile?.role ?? "pm"` and `profile?.email ?? "dev@localhost"`.

### `src/app/admin/page.tsx`

The page fetches billing data from Supabase. Wrap all data-fetching `await` calls in try/catch blocks.
On catch, return empty arrays (`[]`) so the table renders with an empty state rather than a 500 error.
The empty state message "No billing data for this period" (or similar) should already exist — just
make sure a fetch failure hits that path rather than throwing.

### `src/app/pm/page.tsx`

Same: wrap all Supabase fetches in try/catch, return `[]` on failure.

### `src/app/customer/page.tsx`

Same: wrap all Supabase fetches in try/catch, return `[]` on failure.

---

## Part C — Remaining Unmapped Color Classes

Task-005 left these classes unchanged. Migrate them now using the semantic token system.

The emerald classes in this app represent the **success/active/on-track** state — map them to `status-success`.
The violet classes represent a **secondary accent** (used for customer role or secondary actions) — map them to `brand-primary` (closest semantic equivalent until a secondary accent token is added).

### Emerald → Success mapping:
| Replace | With |
|---|---|
| `text-emerald-300` | `text-status-success` |
| `text-emerald-400` | `text-status-success` |
| `bg-emerald-500/10` | `bg-status-success/10` |
| `bg-emerald-500/5` | `bg-status-success/5` |
| `bg-emerald-400` | `bg-status-success` |
| `bg-emerald-500` | `bg-status-success` |
| `hover:bg-emerald-400` | `hover:bg-status-success` |
| `hover:bg-emerald-500/20` | `hover:bg-status-success/20` |
| `hover:text-emerald-200` | `hover:text-status-success` |
| `border-emerald-500/40` | `border-status-success/40` |
| `border-emerald-500/20` | `border-status-success/20` |
| `hover:border-emerald-400/30` | `hover:border-status-success/30` |
| `focus:border-emerald-500/50` | `focus:border-status-success/50` |
| `accent-emerald-400` | `accent-status-success` |
| `bg-red-500/60` | `bg-status-danger/60` |

### Violet → Brand mapping:
| Replace | With |
|---|---|
| `text-violet-300` | `text-brand-primary` |
| `bg-violet-500/10` | `bg-brand-primary/10` |
| `bg-violet-500/5` | `bg-brand-primary/5` |
| `bg-violet-400` | `bg-brand-primary` |
| `hover:text-violet-200` | `hover:text-brand-primary` |
| `border-violet-500/40` | `border-brand-primary/40` |
| `border-violet-500/20` | `border-brand-primary/20` |
| `hover:border-violet-400/30` | `hover:border-brand-primary/30` |
| `border-violet-400` | `border-brand-primary` |

Apply these replacements across all five files from task-005:
- `src/app/admin/page.tsx`
- `src/components/billing-table.tsx`
- `src/app/pm/page.tsx`
- `src/app/customer/page.tsx`
- `src/app/login/page.tsx`

---

## Part D — Quick Visual Check Route

Create `src/app/preview/page.tsx` — a simple static page that requires no auth and no Supabase,
so Timothy can immediately see the shell and token system working:

```tsx
// No "use client" needed — pure server component
export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-surface-base p-8 space-y-8">
      <h1 className="font-heading text-3xl font-bold text-text-primary">TCC ProjectHub — Preview</h1>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-text-secondary">Surfaces</h2>
        <div className="flex gap-4">
          <div className="h-16 w-32 rounded-lg bg-surface-base border border-border-default flex items-center justify-center text-text-tertiary text-sm">base</div>
          <div className="h-16 w-32 rounded-lg bg-surface-raised border border-border-default flex items-center justify-center text-text-secondary text-sm">raised</div>
          <div className="h-16 w-32 rounded-lg bg-surface-overlay border border-border-default flex items-center justify-center text-text-primary text-sm">overlay</div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-text-secondary">Brand</h2>
        <div className="flex gap-4">
          <button className="px-4 py-2 rounded-lg bg-brand-primary text-text-inverse font-medium">Primary Button</button>
          <button className="px-4 py-2 rounded-lg border border-brand-primary text-brand-primary font-medium">Outline Button</button>
          <span className="px-4 py-2 text-brand-primary font-medium">Brand Link</span>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-text-secondary">Status</h2>
        <div className="flex gap-4">
          <span className="px-3 py-1 rounded-full bg-status-success/10 text-status-success text-sm font-medium">Active</span>
          <span className="px-3 py-1 rounded-full bg-status-warning/10 text-status-warning text-sm font-medium">At Risk</span>
          <span className="px-3 py-1 rounded-full bg-status-danger/10 text-status-danger text-sm font-medium">Critical</span>
          <span className="px-3 py-1 rounded-full bg-status-info/10 text-status-info text-sm font-medium">In Review</span>
          <span className="px-3 py-1 rounded-full bg-surface-overlay text-text-tertiary text-sm font-medium">Complete</span>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-text-secondary">Typography</h2>
        <p className="font-heading text-2xl font-bold text-text-primary">Heading Bold — Raleway</p>
        <p className="font-heading text-xl font-semibold text-text-primary">Heading SemiBold</p>
        <p className="font-body text-base text-text-primary">Body regular — The Controls Company, LLC</p>
        <p className="font-body text-sm text-text-secondary">Secondary label text</p>
        <p className="font-body text-xs text-text-tertiary">Tertiary / caption text</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-text-secondary">Borders</h2>
        <div className="flex gap-4">
          <div className="h-16 w-40 rounded-lg border border-border-default flex items-center justify-center text-text-tertiary text-sm">default border</div>
          <div className="h-16 w-40 rounded-lg border border-border-strong flex items-center justify-center text-text-secondary text-sm">strong border</div>
        </div>
      </section>
    </div>
  )
}
```

This page lives at `http://localhost:3000/preview` — no auth required, no Supabase calls.

---

## Verification steps (Codex runs these)

1. `npm run dev` — confirm it starts without throwing
2. Visit `http://localhost:3000/preview` — confirm page loads (Codex cannot visit URLs, just confirm no build/runtime errors in terminal)
3. `npm run build` — confirm clean build

---

## Output

Create `codex/task-006-output.md`:

```
## Files created or modified
- list each

## Part A — .env.local created?
- yes / no + any notes

## Part B — null handling added to which layouts/pages?
- list with one-line description of what changed

## Part C — remaining token replacements
- count per file

## Part D — /preview page created?
- yes / no

## Build result
- "clean" or paste new errors

## Dev server start result
- "started cleanly" or errors

## Blockers or questions
- any ambiguity, or "none"
```

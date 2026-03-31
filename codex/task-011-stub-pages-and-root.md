# Task 011 — Root Page Redirect + Stub Pages for All Sidebar Routes

## Context

Tasks 001–010 are complete. The sidebar nav has links to routes that don't have pages yet,
causing 404s. The root page (`/`) is a leftover Copilot placeholder that doesn't match the
app shell and doesn't redirect authenticated users.

## Read before starting

- `src/app/page.tsx` (root page — needs replacing)
- `src/app/auth/callback/route.ts` (role-based redirect already works post-login)
- `src/components/sidebar-nav.tsx` (to see all links that need pages)
- `src/app/admin/layout.tsx` (pattern for authenticated layouts)
- `src/lib/supabase/server.ts`
- `src/types/database.ts`

---

## Part A — Root Page

Replace `src/app/page.tsx` entirely with a server component that:

1. Checks if the user is authenticated via Supabase
2. If authenticated: redirect to their role's home page
   - admin → `/admin`
   - pm → `/pm`
   - estimator → `/estimating`
   - billing → `/billing`
   - accounting → `/admin/analytics`
   - executive → `/admin/analytics`
   - customer → `/customer`
   - unknown/null → `/login`
3. If not authenticated: redirect to `/login`

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role ?? "customer";
    const destinations: Record<string, string> = {
      admin: "/admin",
      pm: "/pm",
      estimator: "/estimating",
      billing: "/billing",
      accounting: "/admin/analytics",
      executive: "/admin/analytics",
      customer: "/customer",
    };

    return redirect(destinations[role] ?? "/login");
  } catch {
    return redirect("/login");
  }
}
```

---

## Part B — Stub Pages for All Missing Routes

Create a stub layout and page for each missing route. Each stub:
- Has `export const dynamic = "force-dynamic"`
- Uses the same AppShell pattern as admin/pm layouts (fetch user + profile, wrap with AppShell)
- Shows a "Coming Soon" placeholder with the section name and description
- Uses semantic token classes throughout

Create a reusable stub page component pattern — each page imports AppShell via its layout.

### Routes to create:

#### `/quotes`
- Layout: `src/app/quotes/layout.tsx`
- Page: `src/app/quotes/page.tsx`
- Description: "Quote Requests — Manage incoming quote requests, assign estimators, and track status through the bid lifecycle."
- Allowed roles: admin, estimator

#### `/estimating`
- Layout: `src/app/estimating/layout.tsx`
- Page: `src/app/estimating/page.tsx`
- Description: "Estimating — Create and manage estimates. The full estimating module is coming soon."
- Allowed roles: admin, estimator

#### `/projects`
- Layout: `src/app/projects/layout.tsx`
- Page: `src/app/projects/page.tsx`
- Description: "Projects — View all active and completed projects with job numbers, PMs, and billing status."
- Allowed roles: admin, pm, estimator, billing, accounting, executive

#### `/billing`
- Layout: `src/app/billing/layout.tsx`
- Page: `src/app/billing/page.tsx`
- Description: "Billing — Monthly billing management, roll-forward, and financial reporting."
- Allowed roles: admin, billing, accounting, executive
- Note: Link to `/admin` for now — "Billing management is currently available in the Admin portal."
  Add a button: `<a href="/admin" className="...">Go to Admin Billing Portal →</a>`

### Layout pattern for each (copy this exactly, changing the role fallback):

```tsx
// src/app/quotes/layout.tsx
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function QuotesLayout({ children }: { children: React.ReactNode }) {
  let role = "admin";
  let email = "";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, email")
        .eq("id", user.id)
        .single();
      role = profile?.role ?? "admin";
      email = profile?.email ?? "";
    }
  } catch {}
  return <AppShell role={role} userEmail={email}>{children}</AppShell>;
}
```

### Page pattern for each:

```tsx
// src/app/quotes/page.tsx
export const dynamic = "force-dynamic";

export default function QuotesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Quote Requests</h1>
        <p className="mt-1 text-text-secondary">
          Manage incoming quote requests, assign estimators, and track status through the bid lifecycle.
        </p>
      </div>
      <div className="rounded-xl border border-border-default bg-surface-raised p-8 text-center">
        <p className="text-4xl mb-4">📋</p>
        <h2 className="font-heading text-lg font-semibold text-text-primary">Coming Soon</h2>
        <p className="mt-2 text-text-secondary text-sm max-w-md mx-auto">
          The Quote Requests module is under active development. It will allow customers to submit
          requests, estimators to manage the queue, and admins to track win rates and turnaround time.
        </p>
      </div>
    </div>
  );
}
```

Apply this pattern for each route, customizing the title, description, and coming-soon text.
For `/billing`, add the redirect button instead of just the coming-soon box.

---

## Part C — Projects Page with Real Data

The `/projects` page should show real data since projects were imported by the migration tool.
Instead of a stub, build a real read-only projects list:

`src/app/projects/page.tsx` — server component:

1. Fetch all projects from Supabase ordered by `job_number`:
```ts
const supabase = await createClient()
const { data: projects } = await supabase
  .from("projects")
  .select("id, name, job_number, is_active, migration_status, sharepoint_folder, created_at")
  .order("job_number", { ascending: true })
```

2. Render a table with columns:
   - Job Number (`job_number`)
   - Project Name (`name`)
   - Status badge: Active (success) / Completed (tertiary)
   - Legacy badge: if `migration_status === "legacy"` show `⚠ Legacy` warning badge
   - SharePoint link: if `sharepoint_folder` exists, show a link icon that opens
     `https://controlsco.sharepoint.com/sites/TCCProjects/Shared%20Documents/{encoded sharepoint_folder}`

3. Add a search/filter input at the top (client component with `useState`) — filter by project name or job number

4. Show count: "Showing X of Y projects"

5. Separate into two sections with headings: "Active Projects" and "Completed Projects"

The layout for `/projects` uses the same AppShell pattern as the other layouts.

---

## Part D — Estimating Page with hvac-estimator Link

`src/app/estimating/page.tsx` — instead of just "coming soon", show:

```tsx
<div className="space-y-6">
  <div>
    <h1 className="font-heading text-2xl font-bold text-text-primary">Estimating</h1>
    <p className="mt-1 text-text-secondary">
      Create and manage HVAC controls estimates.
    </p>
  </div>

  {/* Current tool card */}
  <div className="rounded-xl border border-border-default bg-surface-raised p-6">
    <div className="flex items-start justify-between">
      <div>
        <h2 className="font-heading text-lg font-semibold text-text-primary">
          Current Estimating Tool
        </h2>
        <p className="mt-1 text-text-secondary text-sm">
          The estimating tool is currently running as a separate application.
        </p>
      </div>
      <a
        href="http://localhost:5173"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-hover"
      >
        Open Estimating Tool →
      </a>
    </div>
    <p className="mt-4 text-xs text-text-tertiary">
      The estimating module will be integrated into this portal in a future phase.
      Until then, use the link above to access the current tool.
    </p>
  </div>

  {/* Coming soon card */}
  <div className="rounded-xl border border-border-default bg-surface-raised p-6">
    <h2 className="font-heading text-lg font-semibold text-text-primary">Integrated Estimating — Coming Soon</h2>
    <p className="mt-2 text-text-secondary text-sm">
      Phase 5 will bring the full estimating module into this portal, including the
      445-assembly price book, HVAC system editors, and proposal generation.
    </p>
  </div>
</div>
```

---

## Constraints

- Do not modify `.env.local`
- Do not modify any existing working pages (admin, pm, customer, login, analytics, users, migrate-sharepoint)
- The `/projects` page is the only one with real data — all others are stubs except `/billing` which redirects
- Run `npm run build` after all changes, fix only new errors

---

## Output

Create `codex/task-011-output.md`:

```
## Files created or modified
- list each

## Root page behavior
- describe what it does for authenticated vs unauthenticated users

## Routes created
- list each with "stub" or "real data"

## Build result
- "clean" or paste new errors

## Blockers or questions
- any ambiguity, or "none"
```

# Task 003 — Sidebar Navigation + App Shell

## Context

Tasks 001 and 002 are complete:
- Semantic token classes are available in Tailwind (`bg-surface-base`, `text-text-primary`, etc.)
- `ThemeProvider` wraps the root layout
- `ThemeToggle` component exists at `src/components/theme-toggle.tsx`

## Read before starting

- `docs/route-role-ui-plan.md` (nav links per role, route list)
- `src/components/theme-toggle.tsx` (to import it)
- `src/lib/supabase/server.ts` (server client pattern)
- `src/types/database.ts` (Profile type — has `role` and `email` fields)

## Work to do

### 1. Create `src/components/sidebar-nav.tsx`

- `"use client"`
- Props: `role: string`, `userEmail: string`
- Define a `NAV_LINKS` array of `{ label: string; href: string; roles: string[] }`:

  ```
  { label: "Dashboard",   href: "/",               roles: ["admin","pm","estimator","billing","accounting","executive"] },
  { label: "Quotes",      href: "/quotes",          roles: ["admin","estimator"] },
  { label: "Estimating",  href: "/estimating",      roles: ["admin","estimator"] },
  { label: "Projects",    href: "/projects",        roles: ["admin","pm","estimator","billing","accounting","executive"] },
  { label: "PM Updates",  href: "/pm",              roles: ["admin","pm"] },
  { label: "Billing",     href: "/billing",         roles: ["admin","billing","accounting","executive"] },
  { label: "Analytics",   href: "/admin/analytics", roles: ["admin","accounting","executive"] },
  { label: "Users",       href: "/admin/users",     roles: ["admin"] },
  { label: "My Portal",   href: "/customer",        roles: ["customer"] },
  ```

- Filter `NAV_LINKS` to only those where `roles.includes(role)`
- Use `usePathname()` from `next/navigation` for active state
- Active link style: `bg-surface-overlay text-text-primary font-medium`
- Inactive link style: `text-text-secondary hover:bg-surface-overlay hover:text-text-primary`
- All links: `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors`
- Logo area (top of sidebar):
  - `<img src="/logo.png" alt="TCC ProjectHub" className="h-8 w-auto" />`
  - Wrap in `onError` handler: if image fails to load, replace with `<span className="text-text-primary font-heading font-semibold text-lg">TCC ProjectHub</span>`
- Bottom section (above footer): show `userEmail` truncated, and a Sign Out button
  - Sign out: import `createBrowserClient` from `src/lib/supabase/client.ts`, call `supabase.auth.signOut()` then `router.push("/login")` using `useRouter` from `next/navigation`
- Sidebar container: `fixed left-0 top-0 h-screen w-56 bg-surface-raised border-r border-border-default flex flex-col z-30`
- Nav section: `flex-1 overflow-y-auto px-3 py-4 space-y-1`
- Bottom section: `px-3 py-4 border-t border-border-default`

### 2. Create `src/components/app-shell.tsx`

- `"use client"`
- Props: `children: React.ReactNode`, `role: string`, `userEmail: string`
- Renders:
  - `<SidebarNav role={role} userEmail={userEmail} />` (import from `./sidebar-nav`)
  - A top header bar: `fixed top-0 left-56 right-0 h-14 bg-surface-raised border-b border-border-default flex items-center justify-end px-6 z-20`
    - Header content: `<ThemeToggle />` on the right (import from `./theme-toggle`)
  - Main content wrapper: `ml-56 pt-14 min-h-screen bg-surface-base`
    - Inner: `<main className="p-6">{children}</main>`

### 3. Update `src/app/admin/layout.tsx`

- Keep `export const dynamic = "force-dynamic"`
- Make the function `async`
- Fetch the current user and their profile:
  ```ts
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user?.id ?? "")
    .single()
  ```
- Wrap `{children}` with:
  ```tsx
  <AppShell role={profile?.role ?? "admin"} userEmail={profile?.email ?? ""}>
    {children}
  </AppShell>
  ```
- If `user` is null, do not crash — AppShell will just render with defaults

### 4. Update `src/app/pm/layout.tsx`

Same pattern as admin layout. Role will resolve to `"pm"` from the profile.

## Constraints

- Do not apply AppShell to `src/app/customer/layout.tsx` or `src/app/login/layout.tsx`
- Do not modify any page files
- Run `npm run build` after changes and fix any new errors only

## Output

Create `codex/task-003-output.md`:

```
## Files created or modified
- list each

## Changes made
- brief description per file

## Build result
- "clean" or paste new errors

## Blockers or questions
- any ambiguity, or "none"
```

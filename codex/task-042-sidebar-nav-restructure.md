# Task 042 — Move Admin Tabs to Sidebar Pages

## Overview

Several tabs on the admin page should be top-level sidebar routes instead.
The goal is:

| Where | What |
|---|---|
| `/admin` (Billing page) | Billing Table + Billing History as sub-tabs. Also keep Projects, Weekly Updates, Feedback as sub-tabs. |
| `/admin/ops` (new page) | Ops View — what ops managers see |
| `/admin/contacts` (new page) | PM Directory / Contacts |
| `/admin/users` (existing page) | User Management — already exists, just needs sidebar link |

---

## 1 — sidebar-nav.tsx: add three new admin nav links

File: `src/components/sidebar-nav.tsx`

Add these three items to `NAV_LINKS`, all with `roles: ["admin"]`.
Insert them after the existing `"Billing"` entry for admin:

```ts
{ label: "Ops View",        href: "/admin/ops",      roles: ["admin"], icon: GridIcon },
{ label: "Contacts",        href: "/admin/contacts",  roles: ["admin"], icon: UserIcon },
{ label: "User Management", href: "/admin/users",     roles: ["admin"], icon: UserIcon },
```

Add these to `PAGE_TITLE_OVERRIDES`:
```ts
"/admin/ops":      "Ops View",
"/admin/contacts": "Contacts",
```

Also update `isActivePath` — the existing guard for `/admin` returns `pathname === "/admin"` exactly, which is correct and prevents sub-pages from highlighting the wrong link. No change needed there.

---

## 2 — Create `/admin/ops/page.tsx`

This page renders the same ops project list the ops managers see.

```tsx
export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";
import { OpsProjectList } from "@/components/ops-project-list";

export default async function AdminOpsPage() {
  const identity = await getShellIdentity("admin");

  return (
    <AppShell role={identity.role} userEmail={identity.email}>
      <OpsProjectList />
    </AppShell>
  );
}
```

Check `src/components/ops-project-list.tsx` for the component's props signature.
If it takes no props (fetches its own data), render it as shown above.
If it requires props, pass them as needed.

---

## 3 — Create `/admin/contacts/page.tsx`

Move the `PmDirectoryTab` component out of `admin/page.tsx` and into this new page.

### 3a — New page file

```tsx
export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";
import { AdminContactsPage } from "@/components/admin-contacts";

export default async function ContactsPage() {
  const identity = await getShellIdentity("admin");

  return (
    <AppShell role={identity.role} userEmail={identity.email}>
      <AdminContactsPage />
    </AppShell>
  );
}
```

### 3b — New component file: `src/components/admin-contacts.tsx`

Cut the entire `PmDirectoryTab` function and all its local types/helpers out
of `src/app/admin/page.tsx` and paste them into this new file.

Rename `PmDirectoryTab` to `AdminContactsPage` and export it:

```tsx
"use client";
// ... all the existing PmDirectoryTab code, renamed to AdminContactsPage
export function AdminContactsPage() { ... }
```

The component already fetches its own data via `/api/admin/data?section=contacts`
so it is self-contained. No props needed.

---

## 4 — Update `/admin/users/page.tsx`

This page already exists. It may render its own layout or use AppShell —
check the file. If it does NOT already use `AppShell`, wrap it:

```tsx
export const dynamic = "force-dynamic";
import { AppShell } from "@/components/app-shell";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";
// existing UsersTab or page content

export default async function UsersPage() {
  const identity = await getShellIdentity("admin");
  return (
    <AppShell role={identity.role} userEmail={identity.email}>
      {/* existing content */}
    </AppShell>
  );
}
```

If it already uses AppShell, leave it unchanged.

---

## 5 — Update `src/app/admin/page.tsx`

### 5a — Remove ops, contacts, users tabs

Remove `"ops"`, `"contacts"`, and `"users"` from the `Tab` type:

```ts
type Tab = "billing" | "projects" | "backfill" | "weekly-updates" | "feedback";
```

Remove the corresponding entries from the tab list array in JSX.

Remove the tab render blocks:
```tsx
{tab === "ops" && <OpsViewTab />}
{tab === "contacts" && <PmDirectoryTab />}
{tab === "users" && <UsersTab />}
```

Remove the `OpsViewTab`, `PmDirectoryTab`, and `UsersTab` component
definitions from the file (PmDirectoryTab moves to admin-contacts.tsx per step 3b).

Remove any imports that are no longer used after these removals.

### 5b — Rename "Billing Table" sub-tab and "Billing History" label

The remaining tabs are: billing, projects, backfill, weekly-updates, feedback.

Update the tab label map:
```ts
{ id: "billing",        label: "Billing Table" },
{ id: "projects",       label: "Projects" },
{ id: "backfill",       label: "Billing History" },
{ id: "weekly-updates", label: "Weekly Updates" },
{ id: "feedback",       label: "Feedback" },
```

No admin-only conditional needed now since users/contacts are gone.

---

## 6 — Build + commit

- Run `npm run build` — must pass clean.
- Commit: `"Move ops view, contacts, user management to dedicated sidebar pages"`
- Push to `origin/main`.
- Create `codex/task-042-output.md` with what was changed and build status.

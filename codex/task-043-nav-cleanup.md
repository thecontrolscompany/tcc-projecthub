# Task 043 — Nav Cleanup: Move Tabs, Merge Contacts/Users

## Overview

Two changes:
1. Move "Weekly Updates" and "Feedback" tabs off the main billing admin page and onto the Ops View page as sub-tabs.
2. Merge Contacts and User Management into a single sidebar page with two tabs.

---

## 1 — Remove Weekly Updates and Feedback from `/admin` billing page

File: `src/app/admin/page.tsx`

### 1a — Remove from Tab type
```ts
// Before
type Tab = "billing" | "projects" | "backfill" | "weekly-updates" | "feedback";

// After
type Tab = "billing" | "projects" | "backfill";
```

### 1b — Remove from tab list in JSX
Remove entries: `{ id: "weekly-updates", label: "Weekly Updates" }` and `{ id: "feedback", label: "Feedback" }`

### 1c — Remove render blocks
Remove:
```tsx
{tab === "weekly-updates" && <WeeklyUpdatesTab />}
{tab === "feedback" && <FeedbackTab />}
```

### 1d — Remove component definitions
Remove the `WeeklyUpdatesTab` and `FeedbackTab` component definitions from
`src/app/admin/page.tsx`. Move them (see step 2 below).

Remove any imports that become unused after these removals.

---

## 2 — Add Weekly Updates and Feedback to Ops View page

The Ops View page is `src/app/admin/ops/page.tsx` and its client component is
`src/components/admin-ops-view.tsx`.

### 2a — Create a new shared file for the moved components

Create `src/components/admin-weekly-feedback.tsx` and move the full
`WeeklyUpdatesTab` and `FeedbackTab` component definitions into it.
Export both. Copy any types they depend on (e.g. `WeeklyUpdatesAdminRow`,
`CustomerFeedback`, `ViewReportLink` usage, etc.) into this file.
Keep all existing logic and UI identical — do not change behavior.

### 2b — Update `src/components/admin-ops-view.tsx`

Add sub-tab state at the top of the component:
```ts
type OpsTab = "projects" | "weekly-updates" | "feedback";
const [opsTab, setOpsTab] = useState<OpsTab>("projects");
```

Add a tab bar (same style as the billing page tab bar) with three tabs:
- `{ id: "projects", label: "Projects" }`
- `{ id: "weekly-updates", label: "Weekly Updates" }`
- `{ id: "feedback", label: "Feedback" }`

Render content based on `opsTab`:
```tsx
{opsTab === "projects" && <OpsProjectList />}
{opsTab === "weekly-updates" && <WeeklyUpdatesTab />}
{opsTab === "feedback" && <FeedbackTab />}
```

Import `WeeklyUpdatesTab` and `FeedbackTab` from `@/components/admin-weekly-feedback`.

---

## 3 — Merge Contacts and User Management into one sidebar page

### 3a — Update sidebar nav

File: `src/components/sidebar-nav.tsx`

Remove the separate `User Management` entry from `NAV_LINKS`:
```ts
// Remove this line:
{ label: "User Management", href: "/admin/users", roles: ["admin"], icon: UserIcon },
```

Keep the `Contacts` entry as-is — it becomes the combined page.

Update `PAGE_TITLE_OVERRIDES`:
```ts
"/admin/contacts": "Contacts & Users",
```

### 3b — Update `/admin/contacts/page.tsx`

Change the page title override or just leave the AppShell as-is — the
component handles the UI.

### 3c — Update `src/components/admin-contacts.tsx`

Add sub-tab state:
```ts
type ContactTab = "contacts" | "users";
const [contactTab, setContactTab] = useState<ContactTab>("contacts");
```

Add a tab bar at the top of the component's JSX:
```tsx
<div className="flex gap-2 border-b border-border-default pb-3 mb-4">
  {(["contacts", "users"] as ContactTab[]).map((id) => (
    <button
      key={id}
      onClick={() => setContactTab(id)}
      className={[
        "rounded-lg px-4 py-2 text-sm font-medium transition",
        contactTab === id
          ? "bg-surface-overlay text-text-primary shadow-sm"
          : "text-text-secondary hover:text-text-primary",
      ].join(" ")}
    >
      {id === "contacts" ? "Contacts" : "User Management"}
    </button>
  ))}
</div>
```

Render:
```tsx
{contactTab === "contacts" && <ContactsPanel />}
{contactTab === "users" && <UsersPanel />}
```

Where `ContactsPanel` is the existing contacts/PM directory UI (currently the
full body of `AdminContactsPage`) and `UsersPanel` is the existing users UI
(currently in `src/components/admin-users-page.tsx`).

Refactor the existing `AdminContactsPage` body into a local `ContactsPanel`
function, and import + render `AdminUsersPage` (from `admin-users-page.tsx`)
as the `UsersPanel`.

### 3d — `/admin/users/page.tsx`

This page can now redirect to `/admin/contacts`:
```tsx
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
export default function UsersRedirect() {
  redirect("/admin/contacts");
}
```

---

## 4 — Build + commit

- Run `npm run build` — must pass clean.
- Commit: `"Move weekly updates/feedback to ops view; merge contacts and user management"`
- Push to `origin/main`.
- Create `codex/task-043-output.md` with what was changed and build status.

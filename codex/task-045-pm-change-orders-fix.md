# Task 045 — Fix PM Portal Change Orders Access

## Context

The PM portal (`src/app/pm/page.tsx`) fetches change orders from `/api/admin/change-orders`
and displays them in a read-only section. The section only renders when
`changeOrders.filter(co => co.status !== "void").length > 0`.

PMs currently do not see the Change Orders section because the fetch silently fails —
`canReadProject()` in the route is returning false for PM users, so the API returns 403,
the `setChangeOrders` call is skipped, and the empty state hides the entire section.

## Root cause

`canReadProject()` in `src/app/api/admin/change-orders/route.ts` uses a Supabase
join query that may not resolve correctly for PMs assigned via `pm_directory_id`:

```ts
.select("profile_id, pm_directory:pm_directory(profile_id)")
.eq("project_id", projectId)
```

If the FK relationship name doesn't resolve the join, `directory?.profile_id` is
undefined, `hasAssignment` becomes false, and the function falls through to the
customer contact check which also fails.

## Changes required

### 1. Fix `canReadProject()` in `src/app/api/admin/change-orders/route.ts`

Replace the single join query with two separate queries so there are no ambiguous
relationship hints:

```ts
async function canReadProject(
  admin: ReturnType<typeof adminClient>,
  projectId: string,
  userId: string,
  role: UserRole
) {
  if (role === "admin" || role === "ops_manager") return true;

  // Step 1: check direct profile_id assignment
  const { data: directRows } = await admin
    .from("project_assignments")
    .select("profile_id")
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .limit(1);

  if ((directRows?.length ?? 0) > 0) return true;

  // Step 2: check via pm_directory — get all pm_directory_ids for this project,
  // then check if any of those directory entries has profile_id === userId
  const { data: assignmentRows } = await admin
    .from("project_assignments")
    .select("pm_directory_id")
    .eq("project_id", projectId)
    .not("pm_directory_id", "is", null);

  const directoryIds = (assignmentRows ?? [])
    .map((r) => r.pm_directory_id)
    .filter(Boolean) as string[];

  if (directoryIds.length > 0) {
    const { data: dirRows } = await admin
      .from("pm_directory")
      .select("id")
      .in("id", directoryIds)
      .eq("profile_id", userId)
      .limit(1);

    if ((dirRows?.length ?? 0) > 0) return true;
  }

  // Step 3: check customer portal access
  const { data: customerContactRows, error: customerContactError } = await admin
    .from("project_customer_contacts")
    .select("id")
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .eq("portal_access", true)
    .limit(1);

  if (customerContactError) throw customerContactError;

  return (customerContactRows?.length ?? 0) > 0;
}
```

### 2. Update `src/app/pm/page.tsx` — always show Change Orders section

Currently the section is wrapped in a condition:
```ts
{changeOrders.filter((co) => co.status !== "void").length > 0 && (
```

Change this so the section **always shows** (with an empty state) when a project is
selected. This prevents the section from disappearing silently when there are no COs.

Replace the existing CO section block (lines ~940–966, around `{changeOrders.filter...`) with:

```tsx
<div className="space-y-3">
  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Change Orders</h3>
  {changeOrders.filter((co) => co.status !== "void").length === 0 ? (
    <p className="text-sm text-text-tertiary">No change orders on file.</p>
  ) : (
    changeOrders.filter((co) => co.status !== "void").map((co) => (
      <div key={co.id} className="flex items-center justify-between rounded-xl border border-border-default bg-surface-raised px-4 py-2.5 text-sm">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-text-primary">{co.co_number}</span>
            <span className="text-text-secondary">—</span>
            <span className="text-text-primary">{co.title}</span>
            <span className={[
              "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
              co.status === "approved" ? "bg-status-success/10 text-status-success" :
              co.status === "rejected" ? "bg-status-danger/10 text-status-danger" :
              "bg-status-warning/10 text-status-warning",
            ].join(" ")}>{co.status}</span>
          </div>
          {co.reference_doc && <p className="text-xs text-text-tertiary">Ref: {co.reference_doc}</p>}
        </div>
        <span className={["shrink-0 font-semibold", co.amount >= 0 ? "text-status-success" : "text-status-danger"].join(" ")}>
          {co.amount >= 0 ? "+" : ""}
          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(co.amount)}
        </span>
      </div>
    ))
  )}
</div>
```

Also add `coError` state so fetch failures surface instead of silently hiding the section.
Add a state variable near the other state declarations:

```ts
const [coError, setCoError] = useState<string | null>(null);
```

Update the CO fetch block in `loadData()`:

```ts
if (coResponse.ok) {
  const coJson = await coResponse.json();
  setChangeOrders((coJson?.changeOrders as ChangeOrder[]) ?? []);
  setCoError(null);
} else {
  const coJson = await coResponse.json().catch(() => null);
  setCoError(coJson?.error ?? "Failed to load change orders.");
}
```

Show the error in the CO section when `coError` is set:

```tsx
<div className="space-y-3">
  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Change Orders</h3>
  {coError ? (
    <p className="text-sm text-status-danger">{coError}</p>
  ) : changeOrders.filter((co) => co.status !== "void").length === 0 ? (
    <p className="text-sm text-text-tertiary">No change orders on file.</p>
  ) : (
    // ... map COs as above
  )}
</div>
```

## Acceptance criteria

- [ ] PM logged in sees "Change Orders" section for every project (even when empty)
- [ ] If there are COs for the project, PM sees them listed read-only
- [ ] No 403 errors in browser console when PM views a project
- [ ] Admin/ops_manager CO management (POST/PATCH/DELETE) still works correctly

## Commit and push

Commit with message: `Fix PM portal change order access and always-visible CO section`
Push to main.

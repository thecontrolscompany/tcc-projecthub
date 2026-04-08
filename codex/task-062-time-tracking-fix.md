# Task 062 — Fix Time Tracking: Align with project_assignments

## Context

The time tracking page at `src/app/pm/time/page.tsx` queries projects using the
legacy `projects.pm_id` field:

```ts
.from('projects')
.select('id, name, customer_id, customers(name)')
.eq('pm_id', user.id)
.eq('is_active', true)
```

The rest of the PM portal uses `project_assignments` to determine which projects
a PM can access. PMs assigned through `project_assignments` (the current system)
have no `pm_id` set on the project and therefore see zero projects in time tracking.

This task fixes the query to use `project_assignments`, matching the same pattern
used in `src/app/api/pm/projects/route.ts`.

---

## Fix — `src/app/pm/time/page.tsx`

The page is a server component. Replace the current projects query block with a
two-step lookup using the Supabase admin client (service role), which avoids RLS
issues that have affected similar queries elsewhere in this project.

### Replace the imports at the top

Change:
```ts
import { createClient } from '@/lib/supabase/server';
```

Add:
```ts
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
```

### Replace the projects query block

Find and replace the entire `let projects: TimeTrackingProject[] = []` block:

**Current:**
```ts
let projects: TimeTrackingProject[] = [];
if (profile?.role === 'pm') {
  const { data } = await supabase
    .from('projects')
    .select('id, name, customer_id, customers(name)')
    .eq('pm_id', user.id)
    .eq('is_active', true);
  projects = (data ?? []).map((project) => ({
    id: project.id,
    name: project.name,
    customer_id: project.customer_id,
    customers: Array.isArray(project.customers) ? project.customers[0] ?? null : project.customers,
  }));
}
```

**Replace with:**
```ts
let projects: TimeTrackingProject[] = [];
if (profile?.role === 'pm' || profile?.role === 'lead' || profile?.role === 'ops_manager' || profile?.role === 'admin') {
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Step 1: find pm_directory entries linked to this profile
  const { data: pmDirRows } = await adminClient
    .from('pm_directory')
    .select('id')
    .eq('profile_id', user.id);

  const pmDirIds = (pmDirRows ?? []).map((r: { id: string }) => r.id);

  // Step 2: find assigned project IDs via project_assignments
  let assignmentQuery = adminClient
    .from('project_assignments')
    .select('project_id')
    .eq('profile_id', user.id);

  // Also include assignments via pm_directory linkage
  // Use a union approach: fetch both and merge
  const { data: directAssignments } = await assignmentQuery;
  const directIds = (directAssignments ?? []).map((a: { project_id: string }) => a.project_id);

  let dirIds: string[] = [];
  if (pmDirIds.length > 0) {
    const { data: dirAssignments } = await adminClient
      .from('project_assignments')
      .select('project_id')
      .in('pm_directory_id', pmDirIds);
    dirIds = (dirAssignments ?? []).map((a: { project_id: string }) => a.project_id);
  }

  const allProjectIds = [...new Set([...directIds, ...dirIds])];

  if (allProjectIds.length > 0) {
    const { data } = await adminClient
      .from('projects')
      .select('id, name, customer_id, customers(name)')
      .in('id', allProjectIds)
      .eq('is_active', true)
      .order('name');

    projects = (data ?? []).map((project: {
      id: string;
      name: string;
      customer_id: string;
      customers: { name: string } | { name: string }[] | null;
    }) => ({
      id: project.id,
      name: project.name,
      customer_id: project.customer_id,
      customers: Array.isArray(project.customers) ? project.customers[0] ?? null : project.customers,
    }));
  }
}
```

---

## Files to change

| File | What changes |
|------|-------------|
| `src/app/pm/time/page.tsx` | Replace pm_id query with project_assignments lookup |

No migrations. No other files.

---

## Acceptance criteria

- [ ] PM assigned via `project_assignments` sees their projects in the time tracking page
- [ ] PM with no assignments sees an empty project list (not a crash)
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `Fix time tracking page to use project_assignments instead of pm_id`
Push to main.

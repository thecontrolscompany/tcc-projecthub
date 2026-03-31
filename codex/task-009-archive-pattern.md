# Task 009 — Legacy Archive Pattern + Migration Status

## Context

Tasks 001–008 are complete. The SharePoint migration tool creates clean folder structures
for all migrated projects. This task adds:

1. `/99 Archive - Legacy Files/` subfolder to every migrated project folder
2. File copy — the original OneDrive folder is copied INTO `/99 Archive - Legacy Files/`
3. `migration_status` column on the projects table
4. Legacy indicator badge on project cards in admin and PM views

## Read before starting

- `codex/task-008-migration-fixes.md` (understand current migration structure)
- `src/app/api/admin/migrate-sharepoint/route.ts`
- `src/lib/graph/client.ts`
- `src/app/admin/page.tsx` (projects tab)
- `src/app/pm/page.tsx`
- `src/types/database.ts`
- `supabase/migrations/002_add_sharepoint_columns.sql` (previous migration)

---

## Part A — Database Migration

Create `supabase/migrations/003_migration_status.sql`:

```sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS migration_status TEXT
    CHECK (migration_status IN ('legacy', 'migrated', 'clean'))
    DEFAULT 'clean';

COMMENT ON COLUMN projects.migration_status IS
  'legacy = migrated from OneDrive, files in /99 Archive; migrated = clean structure applied; clean = created fresh in platform';
```

Add to `Project` interface in `src/types/database.ts`:
```ts
migration_status?: 'legacy' | 'migrated' | 'clean' | null
```

---

## Part B — Update PROJECT_SUBFOLDERS in Migration Route

In `src/app/api/admin/migrate-sharepoint/route.ts`, update the `PROJECT_SUBFOLDERS` constant:

```ts
const PROJECT_SUBFOLDERS = [
  "01 Contract",
  "02 Estimate",
  "03 Submittals",
  "04 Drawings",
  "05 Change Orders",
  "06 Closeout",
  "07 Billing",
  "99 Archive - Legacy Files",
];
```

Also update `BID_SUBFOLDERS` to add an archive folder:
```ts
const BID_SUBFOLDERS = [
  "01 Customer Uploads",
  "02 Internal Review",
  "03 Estimate Working",
  "04 Submitted Quote",
  "99 Archive - Legacy Files",
];
```

---

## Part C — Restore File Copy (Into Archive Only)

The file copy was removed in task-008. Restore it, but scoped specifically to copy the
original OneDrive folder into `/99 Archive - Legacy Files/`.

In `src/lib/graph/client.ts`, restore `copyOneDriveItemToSharePoint` if it was removed
(it should still exist — just wasn't called). If it is gone, re-add it:

```ts
export async function copyOneDriveItemToSharePoint(
  providerToken: string,
  itemId: string,
  destinationDriveId: string,
  destinationParentId: string,
  newName: string
): Promise<void> {
  const res = await graphFetch(
    `/me/drive/items/${encodeURIComponent(itemId)}/copy`,
    providerToken,
    {
      method: "POST",
      body: JSON.stringify({
        parentReference: { driveId: destinationDriveId, id: destinationParentId },
        name: newName,
      }),
    }
  );

  if (res.status !== 202) {
    const body = await res.text();
    throw new Error(`Failed to queue OneDrive copy for "${newName}": ${res.status} ${body}`);
  }
  // 202 Accepted — copy runs async on Microsoft's servers, no polling needed
}
```

In `src/app/api/admin/migrate-sharepoint/route.ts`, after creating all subfolders, add the copy step:

```ts
// Get the ID of the /99 Archive - Legacy Files subfolder we just created
let archiveFolderId: string
try {
  archiveFolderId = await getSharePointFolderIdByPath(
    auth.providerToken,
    driveId,
    `${candidate.targetLibrary}/${candidate.proposedName}/99 Archive - Legacy Files`
  )
} catch {
  // Archive folder lookup failed — skip copy, don't fail the whole item
  archiveFolderId = ""
}

if (archiveFolderId) {
  try {
    await copyOneDriveItemToSharePoint(
      auth.providerToken,
      candidate.sourceId,        // OneDrive item ID of the original folder
      driveId,                   // SharePoint drive
      archiveFolderId,           // destination: /99 Archive - Legacy Files/
      candidate.originalName     // keep original folder name inside archive
    )
  } catch {
    // Copy queued or failed — non-fatal, folder structure is already created
  }
}
```

Import `copyOneDriveItemToSharePoint` at the top of the route file.

---

## Part D — Set migration_status on Insert

In the Supabase insert in the migration route, add `migration_status`:

```ts
await adminClient.from("projects").insert({
  name: candidate.proposedName,
  sharepoint_folder: `${candidate.targetLibrary}/${candidate.proposedName}`,
  sharepoint_item_id: topLevelFolderId,
  job_number: candidate.proposedJobNumber,
  is_active: candidate.classification === "active",
  migration_status: "legacy",
  created_at: candidate.createdDateTime,
});
```

---

## Part E — Legacy Badge in Admin Projects Tab

In `src/app/admin/page.tsx`, find where projects are rendered in the Projects tab.
For each project where `migration_status === "legacy"`, add a badge next to the project name:

```tsx
{project.migration_status === "legacy" && (
  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-status-warning/10 text-status-warning border border-status-warning/20">
    ⚠ Legacy
  </span>
)}
```

---

## Part F — Legacy Badge in PM Portal

In `src/app/pm/page.tsx`, find where project names are rendered in the project list.
Add the same legacy badge for projects where `migration_status === "legacy"`:

```tsx
{project.migration_status === "legacy" && (
  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-status-warning/10 text-status-warning border border-status-warning/20">
    ⚠ Legacy
  </span>
)}
```

Also ensure the project fetch in pm/page.tsx includes `migration_status` in the select query.

---

## Part G — Update Migration Info Box

In `src/app/admin/migrate-sharepoint/page.tsx`, update the info box text to reflect
the archive pattern:

```
ℹ️ How this works:
• Discovers folders from your OneDrive Projects library
• Creates clean numbered folder structure in SharePoint (01 Contract, 02 Estimate, etc.)
• Copies entire original OneDrive folder into /99 Archive - Legacy Files/ inside each project
• Assigns job numbers automatically (YYYY-NNN for projects, QR-YYYY-NNN for bids)
• Projects are marked "Legacy" — pull important files into clean folders over time
• Safe to re-run — already-migrated items are skipped automatically
```

---

## Constraints

- Do not modify `.env.local`
- Note in output that Timothy must run `supabase/migrations/003_migration_status.sql` in Supabase SQL editor
- Run `npm run build` after all changes, fix only new errors

---

## Output

Create `codex/task-009-output.md`:

```
## Files created or modified
- list each

## SQL migration
- Remind Timothy to run supabase/migrations/003_migration_status.sql in Supabase SQL editor

## Summary of changes
- one line per part

## Build result
- "clean" or paste new errors

## Blockers or questions
- any ambiguity, or "none"
```

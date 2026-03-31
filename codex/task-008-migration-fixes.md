# Task 008 — Migration Tool Fixes + SharePoint Cleanup Tool

## Context

The SharePoint migration tool (task-007) has several issues that need fixing:

1. `projects` table is missing `sharepoint_folder` and `job_number` columns — Supabase inserts silently fail
2. Re-running the migration creates duplicate SharePoint folders (e.g. "Bids 1", "Completed Projects 1") because `conflictBehavior: "rename"` renames instead of skipping
3. Migration runs 581 items sequentially in one API call — times out at the end
4. File copy (`copyOneDriveItemToSharePoint`) is causing hangs — skip it for now, files stay in OneDrive
5. Need a cleanup tool to delete duplicate folders (names ending in ` 1`, ` 2`, etc.) from SharePoint

## Read before starting

- `src/lib/graph/client.ts`
- `src/app/api/admin/migrate-sharepoint/route.ts`
- `src/app/admin/migrate-sharepoint/page.tsx`
- `supabase/migrations/001_initial_schema.sql` (to understand existing schema)
- `src/types/database.ts`

---

## Part A — Database Migration

Create `supabase/migrations/002_add_sharepoint_columns.sql`:

```sql
-- Add SharePoint tracking columns to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS sharepoint_folder TEXT,
  ADD COLUMN IF NOT EXISTS sharepoint_item_id TEXT,
  ADD COLUMN IF NOT EXISTS job_number TEXT UNIQUE;

-- Add index for fast lookups by sharepoint_folder
CREATE INDEX IF NOT EXISTS idx_projects_sharepoint_folder
  ON projects (sharepoint_folder)
  WHERE sharepoint_folder IS NOT NULL;

-- Add index for job_number lookups
CREATE INDEX IF NOT EXISTS idx_projects_job_number
  ON projects (job_number)
  WHERE job_number IS NOT NULL;
```

Add the new columns to the `Project` interface in `src/types/database.ts`:
```ts
sharepoint_folder?: string | null
sharepoint_item_id?: string | null
job_number?: string | null
```

---

## Part B — New Graph API Functions

Add these two functions to `src/lib/graph/client.ts`:

### `listSharePointFolders(providerToken, driveId, parentPath): Promise<SharePointItem[]>`

```
GET https://graph.microsoft.com/v1.0/drives/{driveId}/root:/{encodedPath}:/children
  ?$select=id,name,folder,createdDateTime
  &$filter=folder ne null
```

If parentPath is empty string, use: `GET /drives/{driveId}/root/children?$select=id,name,folder,createdDateTime&$filter=folder ne null`

Define type:
```ts
export interface SharePointItem {
  id: string
  name: string
  createdDateTime: string
  folder: { childCount: number }
}
```

Returns array of SharePointItem. Returns `[]` (not throw) on 404 (folder doesn't exist yet).

### `deleteSharePointItem(providerToken, driveId, itemId): Promise<void>`

```
DELETE https://graph.microsoft.com/v1.0/drives/{driveId}/items/{itemId}
```

Throws if response is not 204.

---

## Part C — Fix Migration API Route

Rewrite `src/app/api/admin/migrate-sharepoint/route.ts` POST handler with these fixes:

### Fix 1 — Check Supabase first, skip already-migrated items

Before doing ANY SharePoint operations for a candidate, check if a Supabase record already exists:
```ts
const { data: existing } = await adminClient
  .from("projects")
  .select("id")
  .eq("job_number", candidate.proposedJobNumber)
  .maybeSingle()

if (existing) {
  result.skipped += 1
  continue
}
```

Add `skipped: 0` to the result object.

### Fix 2 — Remove file copy entirely

Delete the `copyOneDriveItemToSharePoint` call from the POST handler. Files remain in OneDrive.
Leave a comment: `// File copy intentionally omitted — files remain in OneDrive until manual migration`
Remove the import of `copyOneDriveItemToSharePoint` from the route file.

### Fix 3 — Use conflictBehavior "fail" for folder creation

Change `"@microsoft.graph.conflictBehavior": "rename"` to `"@microsoft.graph.conflictBehavior": "fail"` in `createSharePointFolder`.

When the folder already exists, Graph API returns 409 Conflict. Catch this in the route:
```ts
try {
  topLevelFolderId = await createSharePointFolder(...)
} catch (e) {
  if (e instanceof Error && e.message.includes("409")) {
    // Folder already exists — look up its ID instead
    topLevelFolderId = await getSharePointFolderIdByPath(
      auth.providerToken, driveId,
      `${candidate.targetLibrary}/${candidate.proposedName}`
    )
  } else {
    throw e
  }
}
```

Add `getSharePointFolderIdByPath(providerToken, driveId, path): Promise<string>` to `client.ts`:
```
GET https://graph.microsoft.com/v1.0/drives/{driveId}/root:/{encodedPath}
```
Returns `data.id`. Throws if not found.

### Fix 4 — Batch processing

Add a `batchSize` parameter to the POST body (default 25). Process only `candidates.slice(offset, offset + batchSize)` where `offset` is also passed in the body (default 0). Return `{ succeeded, failed, skipped, errors, nextOffset, total }` so the UI can call POST repeatedly until `nextOffset >= total`.

### Fix 5 — Supabase insert uses new columns

Update the Supabase upsert to include the new columns:
```ts
await adminClient.from("projects").insert({
  name: candidate.proposedName,
  sharepoint_folder: `${candidate.targetLibrary}/${candidate.proposedName}`,
  job_number: candidate.proposedJobNumber,
  is_active: candidate.classification === "active",
  created_at: candidate.createdDateTime,
})
```
Use `insert` not `upsert` — the deduplication is now handled by the `job_number` check in Fix 1.

---

## Part D — Cleanup API Route

Create `src/app/api/admin/sharepoint-cleanup/route.ts`

### `GET` — Scan for duplicates

Scans the three root library folders in SharePoint for folders whose names end with ` 1`, ` 2`, ` 3`, etc. (regex: `/ \d+$/`).

1. Call `listSharePointFolders(token, driveId, "Active Projects")`
2. Call `listSharePointFolders(token, driveId, "Completed Projects")`
3. Call `listSharePointFolders(token, driveId, "Bids")`
4. Filter each list for items matching `/ \d+$/`
5. Return `{ duplicates: Array<{ id, name, library, itemId }> }`

Also scan each library for the root library folders themselves:
- If "Active Projects 1", "Bids 1", "Completed Projects 1" exist at root level, include those too
  (call `listSharePointFolders(token, driveId, "")` for root-level items)

Requires admin role + provider_token.

### `DELETE` — Remove duplicates

Body: `{ driveId: string, itemIds: string[] }`

For each itemId, call `deleteSharePointItem(token, driveId, itemId)`.
Returns `{ deleted: number, failed: number, errors: string[] }`.

---

## Part E — Update Migration UI Page

Update `src/app/admin/migrate-sharepoint/page.tsx`:

### Add batch progress to Execute step

The execute button now calls POST in a loop:
```ts
let offset = 0
const batchSize = 25
let total = candidates.length

while (offset < total) {
  const res = await fetch("/api/admin/migrate-sharepoint", {
    method: "POST",
    body: JSON.stringify({ candidates, siteId, driveId, offset, batchSize }),
    headers: { "Content-Type": "application/json" }
  })
  const result = await res.json()
  offset = result.nextOffset
  total = result.total
  setProgress({ done: offset, total, succeeded: ..., failed: ..., skipped: ... })
  if (offset >= total) break
}
```

Show progress as: `"Migrating... {done} of {total} — {succeeded} new, {skipped} already done, {failed} errors"`

### Add Cleanup tab

Add a second tab "Cleanup Duplicates" next to "Migration":

- "Scan for Duplicates" button — calls `GET /api/admin/sharepoint-cleanup`
- Shows table of found duplicates: Name | Library | Action
- "Delete All Duplicates" button — calls `DELETE /api/admin/sharepoint-cleanup` with all found item IDs
- Shows result: "Deleted X duplicate folders"

---

## Part F — Instructions Comment in Migration Page

Add a visible info box at the top of the migration page (below the warning banner):

```
ℹ️ How this works:
• Discovers folders from your OneDrive Projects library
• Creates matching folder structure in SharePoint TCCProjects site
• Assigns job numbers automatically (YYYY-NNN for projects, QR-YYYY-NNN for bids)
• File contents remain in OneDrive — only the folder structure is created in SharePoint
• Safe to re-run — already-migrated items are skipped automatically
```

---

## Constraints

- Do not modify `.env.local`
- Run `supabase/migrations/002_add_sharepoint_columns.sql` instructions should be noted in the output — Codex cannot run SQL, Timothy must paste it into Supabase SQL editor
- Run `npm run build` after all changes, fix only new errors

---

## Output

Create `codex/task-008-output.md`:

```
## Files created or modified
- list each

## SQL migration
- Remind Timothy to run supabase/migrations/002_add_sharepoint_columns.sql in Supabase SQL editor

## Summary of fixes applied
- one line per fix

## Build result
- "clean" or paste new errors

## Blockers or questions
- any ambiguity, or "none"
```

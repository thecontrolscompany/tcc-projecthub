# Task 007 — SharePoint Migration Tool (OneDrive → SharePoint)

## Context and Goals

The Controls Company has existing project files in OneDrive at:
`C:\Users\TimothyCollins\OneDrive - The Controls Company, LLC\Projects\`

This tool copies (does NOT move) those files into a structured SharePoint document library,
assigns job numbers, and records the SharePoint folder paths in Supabase.

OneDrive stays intact — users continue using it during the transition.

---

## Read before starting

- `docs/sharepoint-strategy.md` (folder structure conventions, Graph API patterns)
- `src/lib/graph/client.ts` (existing Graph API helpers to extend)
- `src/types/database.ts` (Project and Customer types)
- `.env.local.example` (env var pattern)

---

## OneDrive Source Structure (discovered via Graph API)

The migration tool reads these OneDrive paths under `/me/drive/root:/Projects`:

| OneDrive location | Classification | SharePoint destination |
|---|---|---|
| `Projects/{FolderName}` (no `_` prefix) | Active project | `Active Projects/` |
| `Projects/_Archive/_Completed/{FolderName}` | Completed project | `Completed Projects/` |
| `Projects/_Archive/_20XX Bids/{FolderName}` (no `_` prefix inside) | Historical bid | `Bids/` |
| `Projects/_Archive/{FolderName}` (no `_` prefix, not a year folder) | Current year bid | `Bids/` |

**Skip entirely:** Any folder whose name starts with `_` at any level (these are informational/tools).

---

## SharePoint Target Structure

```
Shared Documents/
├── Active Projects/
│   └── 2026-001 - Project Name/
│       ├── 01 Estimate Baseline/
│       ├── 02 Drawings & Specs/
│       ├── 03 Submittals/
│       ├── 04 Billing/
│       ├── 05 Change Orders/
│       └── 06 Closeout/
├── Completed Projects/
│   └── (same subfolder structure)
├── Bids/
│   └── QR-2026-001 - Project Name/
│       ├── 01 Customer Uploads/
│       ├── 02 Internal Review/
│       ├── 03 Estimate Working/
│       └── 04 Submitted Quote/
└── _Templates/
    ├── Project Folder Template/
    └── Bid Folder Template/
```

---

## Job Number Assignment Rules

**Active and Completed projects → `YYYY-NNN` format:**
- Year: extract from folder creation date via Graph API `createdDateTime` field
- NNN: auto-increment starting from 001, grouped by year, sorted by `createdDateTime` ascending
- Final folder name: `{YYYY}-{NNN} - {OriginalFolderName}`
- Example: `Mobile Arena Controls Upgrade` created in 2025 → `2025-001 - Mobile Arena Controls Upgrade`

**Bids → `QR-YYYY-NNN` format:**
- Year: from `_20XX Bids` parent folder name if present, otherwise current year
- NNN: auto-increment starting from 001 per year
- Final folder name: `QR-{YYYY}-{NNN} - {OriginalFolderName}`

**Numbering must not collide** — run one pass over all discovered folders sorted by year + createdDateTime before assigning any numbers.

---

## Part A — Extend Graph API Client

Add these functions to `src/lib/graph/client.ts`:

### `getSharePointSiteId(accessToken: string): Promise<string>`
```
GET https://graph.microsoft.com/v1.0/sites/controlsco.sharepoint.com:/sites/TCCProjects
```
Returns the site `id` string. Throw a clear error if the site is not found.
The site lives at: https://controlsco.sharepoint.com/sites/TCCProjects
Admin user: Tim@controlsco.net

### `getSharePointDriveId(accessToken: string, siteId: string): Promise<string>`
```
GET https://graph.microsoft.com/v1.0/sites/{siteId}/drive
```
Returns the default document library drive `id`.

### `listOneDriveFolders(accessToken: string, path: string): Promise<OneDriveItem[]>`
```
GET https://graph.microsoft.com/v1.0/me/drive/root:/{path}:/children?$select=id,name,folder,createdDateTime&$filter=folder ne null
```
Returns only folders (items where `folder` property exists). Define type:
```ts
interface OneDriveItem {
  id: string
  name: string
  createdDateTime: string
  folder: { childCount: number }
}
```

### `createSharePointFolder(accessToken: string, driveId: string, parentPath: string, folderName: string): Promise<string>`
```
PUT https://graph.microsoft.com/v1.0/drives/{driveId}/root:/{parentPath}/{folderName}:/children
Body: { "name": folderName, "folder": {}, "@microsoft.graph.conflictBehavior": "rename" }
```
Returns the new folder item `id`.

### `copyOneDriveItemToSharePoint(accessToken: string, itemId: string, destinationDriveId: string, destinationParentId: string, newName: string): Promise<void>`
```
POST https://graph.microsoft.com/v1.0/me/drive/items/{itemId}/copy
Body: {
  "parentReference": { "driveId": destinationDriveId, "id": destinationParentId },
  "name": newName
}
```
This is async on Microsoft's side — it returns 202 Accepted with a `Location` header for monitoring.
For this tool, fire-and-forget is acceptable. Do not poll for completion.

---

## Part B — Migration API Route

Create `src/app/api/admin/migrate-sharepoint/route.ts`

### `GET` — Discovery (dry run, no writes)

1. Get `provider_token` from Supabase session (required for Graph API calls)
2. List OneDrive folders from all source paths using `listOneDriveFolders`:
   - `Projects` (top level, skip `_` prefixed)
   - `Projects/_Archive/_Completed` (skip `_` prefixed)
   - `Projects/_Archive` (skip `_` prefixed and skip folders matching `_20\d\d Bids` pattern)
   - For each `_20XX Bids` folder found in `_Archive`, list its children (skip `_` prefixed)
3. Classify each folder per the mapping table above
4. Sort all folders by `createdDateTime` ascending within each year
5. Assign job numbers per the rules above
6. Return JSON array of `MigrationCandidate`:
```ts
interface MigrationCandidate {
  sourceId: string          // OneDrive item ID
  sourcePath: string        // human-readable source path
  originalName: string      // folder name as-is in OneDrive
  classification: "active" | "completed" | "bid"
  proposedJobNumber: string // e.g. "2025-001" or "QR-2025-001"
  proposedName: string      // full target folder name
  targetLibrary: string     // "Active Projects" | "Completed Projects" | "Bids"
  createdDateTime: string
}
```

### `POST` — Execute migration

Body: `{ candidates: MigrationCandidate[], siteId: string, driveId: string }`

For each candidate:
1. Create the top-level folder in SharePoint: `{targetLibrary}/{proposedName}/`
2. Create the appropriate subfolders inside it (project subfolders or bid subfolders per structure above)
3. Call `copyOneDriveItemToSharePoint` to copy the original OneDrive folder contents into the new SharePoint folder
4. Upsert a record in the `projects` table in Supabase:
   - `name`: `proposedName`
   - `sharepoint_folder`: `{targetLibrary}/{proposedName}`
   - `is_active`: true if classification is "active", false otherwise
   - `created_at`: use `createdDateTime` from OneDrive
   - Only upsert if no existing project record has the same `sharepoint_folder`
5. Return `{ succeeded: number, failed: number, errors: string[] }`

Admin/service role only — verify `profile.role === "admin"` before executing.

---

## Part C — Migration Tool UI Page

Create `src/app/admin/migrate-sharepoint/page.tsx`

This is a two-step admin tool page. Use semantic token classes throughout.

### Step 1 — Discovery

- Page heading: "SharePoint Migration Tool"
- Subheading: "Copies existing OneDrive projects to SharePoint. OneDrive files are not modified."
- Warning banner: `bg-status-warning/10 border border-status-warning/40 text-status-warning` — "This tool requires Sites.ReadWrite.All permission in Azure AD. Ensure admin consent has been granted before running."
- "Discover Projects" button — calls `GET /api/admin/migrate-sharepoint`
- While loading: show spinner with "Scanning OneDrive..."
- On success: render a review table (Step 2)

### Step 2 — Review and Execute

Render a table with columns:
- Original Name
- Source Location (OneDrive path)
- Classification (colored badge: Active=success, Completed=tertiary, Bid=info)
- Proposed Job Number
- Proposed SharePoint Name
- Target Library

Above the table:
- Summary line: "Found X active projects, Y completed projects, Z bids"
- "Execute Migration" button (brand primary, disabled until discovery is complete)
- "Re-scan" link to re-run discovery

On "Execute Migration" click:
- Show confirmation modal: "This will create SharePoint folders and copy files. OneDrive is unchanged. Continue?"
- On confirm: POST to `/api/admin/migrate-sharepoint`
- Show progress: "Migrating... X of Y complete" (poll the response)
- On complete: show results summary (succeeded / failed count, error list if any)

Add a link to this page in `src/components/sidebar-nav.tsx` under the admin role:
```
{ label: "SharePoint Migration", href: "/admin/migrate-sharepoint", roles: ["admin"] }
```

---

## Part D — Environment Variables

Update `.env.local` (created in task-006) — replace the placeholder Azure values with these real values:
```
NEXT_PUBLIC_AZURE_CLIENT_ID=0777b14d-29c4-4186-8d8e-4a8f43de6589
NEXT_PUBLIC_AZURE_TENANT_ID=7eec7a09-a47b-4bf1-a877-80fd5323c774
SHAREPOINT_SITE_ID=
SHAREPOINT_DRIVE_ID=
```

Leave SHAREPOINT_SITE_ID and SHAREPOINT_DRIVE_ID blank — the migration tool discovers them at runtime.
Leave AZURE_CLIENT_SECRET blank in the file — Timothy will fill it in manually (it cannot be stored in tracked files).

Add the same new keys to `.env.local.example` with comments:
```
# Azure AD — TCC ProjectHub app registration (tenant: controlsco.net)
NEXT_PUBLIC_AZURE_CLIENT_ID=0777b14d-29c4-4186-8d8e-4a8f43de6589
NEXT_PUBLIC_AZURE_TENANT_ID=7eec7a09-a47b-4bf1-a877-80fd5323c774
# Client secret — get from Azure portal, Certificates & secrets (never commit the actual value)
AZURE_CLIENT_SECRET=

# SharePoint site: https://controlsco.sharepoint.com/sites/TCCProjects
# Site ID — discovered automatically by migration tool on first run, then cache here
SHAREPOINT_SITE_ID=
# Default document library drive ID — same, cache after first run
SHAREPOINT_DRIVE_ID=
```

---

## Constraints

- Copy only — never delete or modify OneDrive files
- Skip all folders whose names start with `_`
- If a SharePoint folder already exists with the same name, use `conflictBehavior: "rename"` (Graph API adds a suffix automatically)
- Admin role required for both API routes
- Run `npm run build` after all changes and fix only new errors

---

## Output

Create `codex/task-007-output.md`:

```
## Files created or modified
- list each

## Graph API functions added
- list function names

## Job numbering logic summary
- describe the implementation in 2-3 sentences

## Any SharePoint API assumptions made
- note anything not explicitly specified that you had to decide

## Build result
- "clean" or paste new errors

## Blockers or questions
- any ambiguity, or "none"
```

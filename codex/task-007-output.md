## Files created or modified
- `src/lib/graph/client.ts`
- `src/app/api/admin/migrate-sharepoint/route.ts`
- `src/app/admin/migrate-sharepoint/page.tsx`
- `src/components/sidebar-nav.tsx`
- `src/types/database.ts`
- `.env.local.example`

## Graph API functions added
- `getSharePointSiteId`
- `getSharePointDriveId`
- `listOneDriveFolders`
- `createSharePointFolder`
- `copyOneDriveItemToSharePoint`

## Job numbering logic summary
- Discovery gathers active, completed, current-year bid, and historical bid folders from the specified OneDrive paths, skipping any folder whose name starts with `_`.
- Active and completed projects share one numbering sequence per year using `YYYY-NNN`, where the year comes from each folder's `createdDateTime` and the sequence is assigned after sorting by `createdDateTime` ascending within that year.
- Bids use a separate `QR-YYYY-NNN` sequence per year, where the year comes from the `_20XX Bids` parent folder when present and otherwise falls back to the current year.

## Any SharePoint API assumptions made
- The discovery `GET` response returns `siteId` and `driveId` alongside `candidates` so the UI can pass them back to `POST`, since the task required those values in the execute body but did not specify another handoff mechanism.
- `POST` creates the new SharePoint top-level folder, then creates the requested child folders inside it, and finally queues a fire-and-forget copy of the original OneDrive folder into that top-level folder.
- `.env.local` was intentionally not modified because you explicitly instructed me not to touch your real credentials file; only `.env.local.example` was updated.

## Build result
- clean
- existing warning only: Next.js reports that the `middleware` file convention is deprecated in favor of `proxy`

## Blockers or questions
- none

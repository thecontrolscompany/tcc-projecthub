## Files modified
- `supabase/migrations/006_new_roles.sql`
- `src/types/database.ts`
- `src/lib/supabase/middleware.ts`
- `src/app/auth/callback/route.ts`
- `src/app/page.tsx`
- `src/components/sidebar-nav.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/users/page.tsx`
- `src/app/installer/layout.tsx`
- `src/app/installer/page.tsx`
- `src/app/ops/layout.tsx`
- `src/app/ops/page.tsx`
- `codex/task-022-new-roles-output.md`

## Migration created
- `supabase/migrations/006_new_roles.sql`
- Updates `profiles.role` constraint to allow:
  - `admin`
  - `pm`
  - `lead`
  - `installer`
  - `ops_manager`
  - `customer`
- Expands RLS so:
  - `lead` gets PM-style access to customers, assigned projects, billing reads, and weekly updates
  - `installer` gets read access to assigned projects
  - `ops_manager` gets read access to all active projects

## Role routing
- `lead` routes to `/pm`
- `installer` routes to `/installer`
- `ops_manager` routes to `/ops`
- Updated root redirect, auth callback redirect, and shared middleware enforcement

## New portals
- Added `/installer`
  - read-only assigned project list
  - SharePoint button per project when `sharepoint_folder` exists
- Added `/ops`
  - read-only list of all active projects
  - shows project, customer, PM, and current `% complete`

## Admin user management
- Added `lead`, `installer`, and `ops_manager` to the role dropdown in:
  - `src/app/admin/page.tsx`
  - `src/app/admin/users/page.tsx`
- Added badge styling for the new roles

## Build result
- clean
- Ran `npm run build`

## Manual step for Timothy
- Run `supabase/migrations/006_new_roles.sql` manually in Supabase SQL editor

## Git
- Committed and pushed the new-role changes to `origin main`

## Notes
- Left unrelated local files untouched

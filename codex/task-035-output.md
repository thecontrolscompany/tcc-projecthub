# Task 035 Output

## Files Changed

### Task 1 - Customer portal server route
- `src/app/api/customer/data/route.ts`
  - Added server-side customer data route with `section=projects`
  - Verifies session server-side, confirms `customer` role, reads via service-role client
- `src/app/customer/page.tsx`
  - Replaced browser `supabase.from(...)` project, billing, weekly update, and team reads with `fetch('/api/customer/data?section=projects')`
  - Preserved existing UI and kept customer feedback submission on the browser client

### Task 2 - Admin analytics server route
- `src/app/api/admin/data/route.ts`
  - Added `section=analytics`
- `src/app/admin/analytics/page.tsx`
  - Replaced browser billing/project reads with a single server fetch

### Task 3 - Admin users page server route
- `src/app/admin/users/page.tsx`
  - Replaced browser `profiles` read with `fetch('/api/admin/data?section=users')`
- `src/app/api/admin/update-user-role/route.ts`
  - Added admin-only PATCH route for role changes using service-role access

### Task 4 - Remaining browser-read audit fixes
- `src/app/api/admin/data/route.ts`
  - Extended `billing` to return `recentUpdateProjectIds` and `pocDrivenProjectIds`
  - Added `section=me`
  - Added `section=project-customer-contacts`
  - Added `section=project-poc-items`
- `src/app/api/pm/projects/route.ts`
  - Added `section=project-data` for PM weekly-update form reads
- `src/app/admin/page.tsx`
  - Replaced mount-time role lookup and projects tab load with server fetches
  - Replaced billing metadata browser reads with server route metadata
- `src/components/project-modal.tsx`
  - Replaced customer contacts and POC line item mount reads with server fetches
- `src/app/pm/page.tsx`
  - Replaced weekly updates and POC line item mount reads in the PM update form with server fetches

## Browser Client Reads Left Intentionally

These browser-client operations remain intentionally because they are writes or write-followup reads, not mount-time page data loads:

- `src/app/customer/page.tsx`
  - `customer_feedback` insert
  - `auth.getUser()` and sign-out
- `src/app/admin/page.tsx`
  - billing roll-forward read/write action
  - contact save/delete helpers
  - feedback review write
- `src/components/admin-projects-tab.tsx`
  - project/customer/assignment save flows
  - write-followup selects used during create/save
- `src/components/ops-project-list.tsx`
  - project/customer/assignment save flows
  - write-followup selects used during create/save
- `src/components/project-modal.tsx`
  - customer contact insert/update/delete
  - POC line item insert/update/delete and reorder writes
- `src/components/billing-table.tsx`
  - billing period update writes
- `src/app/pm/page.tsx`
  - weekly update insert
  - POC/billing update writes
- `src/app/login/page.tsx`
  - auth-only client usage
- `src/components/sidebar-nav.tsx`
  - auth-only client usage

## Final Verification

- `npm run build` passes clean
- Mount-time or `useEffect`-driven browser Supabase reads were moved to server routes for:
  - customer portal
  - admin analytics
  - admin users
  - admin billing metadata
  - admin projects tab load
  - project modal customer contacts
  - project modal POC items
  - PM update form weekly updates and POC items

## Issues / Limitations

- Next.js 16 still prints the existing warning that the `middleware` convention is deprecated in favor of `proxy`; no change was made there because the app currently relies on the working `src/middleware.ts` pattern.
- The audit command still finds client files importing `@/lib/supabase/client`, but the remaining data access in those files is action-driven writes or auth/session handling rather than mount-time SELECT reads.

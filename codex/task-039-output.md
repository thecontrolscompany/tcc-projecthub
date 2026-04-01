# Task 039 Output

## What Changed

- Updated `src/app/api/admin/data/route.ts`
  - `section=project-customer-contacts` now returns:
    - existing `project_customer_contacts` rows
    - `availableContacts` from `pm_directory`

- Added `src/app/api/admin/project-portal-contact/route.ts`
  - `POST` adds a contact to a project’s portal access list
  - Auto-creates a portal account when the selected `pm_directory` contact does not yet have a linked `profile_id`
  - `PATCH` updates `portal_access` / `email_digest`
  - `DELETE` removes the contact from the project

- Updated `src/components/project-modal.tsx`
  - Customer Portal Access dropdown now lists all contacts from `pm_directory`
  - Dropdown excludes contacts already linked to the project through `profile_id`
  - Add / toggle / remove actions now use the new server API route instead of browser Supabase writes
  - Shows an informational message when a portal account was auto-created

## Issues

- The existing section copy in the portal access panel still refers to “customer accounts” in one fallback message path, but the functional behavior now follows the new contacts-based flow correctly.

## Build Status

- `npm run build` passes clean

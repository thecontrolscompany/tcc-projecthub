## Files modified
- `supabase/migrations/004_project_fields.sql`
- `src/types/database.ts`
- `src/components/admin-projects-tab.tsx`
- `src/app/admin/page.tsx`
- `src/app/projects/page.tsx`
- `src/app/projects/projects-list.tsx`
- `src/app/api/admin/provision-project-folder/route.ts`
- `src/app/auth/callback/route.ts`
- `src/app/pm/page.tsx`
- `codex/task-014-output.md`

## Migration file created
- `supabase/migrations/004_project_fields.sql`
- Columns: `billed_in_full`, `paid_in_full`, `completed_at`, `customer_poc`, `customer_po_number`, `site_address`, `contract_price`, `general_contractor`, `mechanical_contractor`, `electrical_contractor`, `all_conduit_plenum`, `certified_payroll`, `buy_american`, `bond_required`, `special_requirements`, `special_access`, `notes`, `pm_directory_id`

## New Project form
- Required fields implemented: Project Name, Customer or Add New Customer, Contract Price
- Optional fields implemented: Customer POC, Customer PO Number, Site Address, General Contractor, Mechanical Contractor, Electrical Contractor, Assigned PM, Notes, Special Requirements, Special Access
- Compliance checkboxes implemented: All Conduit/Plenum, Certified Payroll, Buy American, Bond Required
- Read-only auto-generated `YYYY-NNN` job number preview implemented in the modal header

## Edit Project
- yes
- Includes all New Project fields plus `Billed in Full` and `Paid in Full`

## Billed/Paid logic
- When both `Billed in Full` and `Paid in Full` are checked, the project is marked inactive and `completed_at` is set to now
- If either checkbox is unchecked, the project is marked active and `completed_at` is cleared
- If contract price changes, `estimated_income` is updated and open billing periods where `actual_billed IS NULL` have `estimated_income_snapshot` refreshed

## SharePoint provisioning
- Added `POST /api/admin/provision-project-folder`
- The route requires admin auth, uses the Microsoft provider token, creates the Active Projects folder plus standard subfolders, then updates `projects.sharepoint_folder` and `projects.sharepoint_item_id`
- Wired into new project creation as a fire-and-forget request so project creation never blocks on SharePoint

## PM auto-link
- Added in `src/app/auth/callback/route.ts`
- After auth callback, if a PM signs in with an email matching `pm_directory.email` and `profile_id` is null, the callback now sets `pm_directory.profile_id = profile.id`

## Build result
- clean

## Blockers or questions
- Timothy must run `supabase/migrations/004_project_fields.sql` manually in the Supabase SQL editor before the new project fields work against the real database

# Task 053 Output

Implemented the Materials / BOM feature set for the admin project modal and PM portal.

What changed:
- Added `BomItem`, `MaterialReceipt`, and `BomStatus` types in `src/types/database.ts`
- Added `/api/admin/bom` CRUD + receipt endpoints in `src/app/api/admin/bom/route.ts`
- Added Excel import endpoint in `src/app/api/admin/bom/import/route.ts`
- Added grouped BOM UI with summary cards, filters, receipt logging, inline add/edit/delete, and Excel import in `src/components/bom-tab.tsx`
- Added a `Materials` tab to the admin project modal in `src/components/project-modal.tsx`
- Added a read-only `Materials / BOM` section to the PM portal in `src/app/pm/page.tsx`
- Added migration file `supabase/migrations/029_bom.sql`

Verification:
- `npm run build` passed successfully

Manual SQL note:
- `supabase/migrations/029_bom.sql` still needs to be run manually in Supabase if `bom_items` / `material_receipts` do not already exist.

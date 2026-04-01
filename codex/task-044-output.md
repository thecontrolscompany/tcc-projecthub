Task 044 completed on April 1, 2026.

What changed:
- Added the manual migration file [supabase/migrations/022_change_orders.sql](/c:/Users/TimothyCollins/dev/tcc-projecthub/supabase/migrations/022_change_orders.sql) for the new `change_orders` table and `co_status` enum.
- Added `ChangeOrderStatus` and `ChangeOrder` to [src/types/database.ts](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/types/database.ts).
- Created the service-role API route [src/app/api/admin/change-orders/route.ts](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/api/admin/change-orders/route.ts) with `GET`, `POST`, `PATCH`, and `DELETE` handlers.
- Added a new `Change Orders` section to [src/components/project-modal.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/project-modal.tsx) directly below `Customer Portal Access`, including:
  - project-scoped CO loading
  - approved/pending summary badges
  - add CO form
  - void action
  - local status badge and currency formatting helper
- Updated the customer portal footer in [src/app/customer/page.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/customer/page.tsx) so the domain reads `TheControlsCompany.com`.

Optional sections skipped:
- Billing table `Pending CO` display column in `src/app/admin/page.tsx`
- Customer portal approved change order summary in `src/app/customer/page.tsx`

Build status:
- `npm run build` passed clean.

Manual step:
- Run [supabase/migrations/022_change_orders.sql](/c:/Users/TimothyCollins/dev/tcc-projecthub/supabase/migrations/022_change_orders.sql) in the Supabase SQL editor before testing the feature against the live database.

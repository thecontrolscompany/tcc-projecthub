Task 042 completed on April 1, 2026.

What changed:
- Added dedicated admin sidebar routes for `Ops View`, `Contacts`, and `User Management`.
- Kept `/admin` focused on the remaining tabs: `Billing Table`, `Projects`, `Billing History`, `Weekly Updates`, and `Feedback`.
- Created [src/app/admin/ops/page.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/admin/ops/page.tsx) with [src/components/admin-ops-view.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/admin-ops-view.tsx).
- Created [src/app/admin/contacts/page.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/admin/contacts/page.tsx) with [src/components/admin-contacts.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/admin-contacts.tsx).
- Wrapped [src/app/admin/users/page.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/admin/users/page.tsx) in `AppShell` and moved the client UI into [src/components/admin-users-page.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/admin-users-page.tsx).
- Updated [src/components/sidebar-nav.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/sidebar-nav.tsx) with the new admin links and page-title overrides.
- Removed the old embedded `OpsViewTab`, `PmDirectoryTab`, and `UsersTab` implementations from [src/app/admin/page.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/admin/page.tsx).

Build status:
- `npm run build` passed clean.

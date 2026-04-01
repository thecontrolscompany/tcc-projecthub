Task 043 completed on April 1, 2026.

What changed:
- Removed `Weekly Updates` and `Feedback` from the main [src/app/admin/page.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/admin/page.tsx) tab set so `/admin` now only holds `Billing Table`, `Projects`, and `Billing History`.
- Created [src/components/admin-weekly-feedback.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/admin-weekly-feedback.tsx) and moved the full `WeeklyUpdatesTab` and `FeedbackTab` implementations there without changing their behavior.
- Updated [src/components/admin-ops-view.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/admin-ops-view.tsx) to add `Projects`, `Weekly Updates`, and `Feedback` sub-tabs on the Ops View page.
- Merged Contacts and User Management into [src/components/admin-contacts.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/admin-contacts.tsx) with local `contacts/users` sub-tabs.
- Kept [src/components/admin-users-page.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/admin-users-page.tsx) as the user-management panel and rendered it inside the combined Contacts page.
- Updated [src/components/sidebar-nav.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/sidebar-nav.tsx) to remove the separate `User Management` nav entry and rename `/admin/contacts` to `Contacts & Users`.
- Changed [src/app/admin/users/page.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/admin/users/page.tsx) to redirect to `/admin/contacts`.

Build status:
- `npm run build` passed clean.

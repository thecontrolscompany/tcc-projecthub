# Task 032 Output

- Added [supabase/migrations/011_customer_project_settings.sql](/c:/Users/TimothyCollins/dev/tcc-projecthub/supabase/migrations/011_customer_project_settings.sql) for `customer_portal_access` and `customer_email_digest`. This migration was not run.
- Updated [src/types/database.ts](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/types/database.ts) to include the new customer project settings on `Project`.
- Updated [src/components/project-modal.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/project-modal.tsx) with the new Customer Notifications section and the improved add-new-customer flow.
- Updated [src/components/admin-projects-tab.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/admin-projects-tab.tsx) and [src/components/ops-project-list.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/ops-project-list.tsx) to load and save the new fields.
- Updated [src/app/customer/page.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/customer/page.tsx) to only show projects where `customer_portal_access = true`.
- `npm run build` completed successfully.

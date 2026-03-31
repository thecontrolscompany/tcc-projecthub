# Task 028 Output

- Added [supabase/migrations/008_project_assignments.sql](/c:/Users/TimothyCollins/dev/tcc-projecthub/supabase/migrations/008_project_assignments.sql) to create the `project_assignments` table, RLS, and backfill existing `projects.pm_id` / `projects.pm_directory_id` assignments. This migration was not run.
- Added [src/types/database.ts](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/types/database.ts) `ProjectAssignment` and related role typing.
- Extracted the shared project editor into [src/components/project-modal.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/project-modal.tsx), including uploads and the new Team section.
- Updated [src/components/admin-projects-tab.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/admin-projects-tab.tsx) to replace the single Assigned PM field with assignment list management, combined team-member lookup, and `project_assignments` sync on save.
- Updated billing PM fallback in [src/app/admin/page.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/admin/page.tsx) to prefer the primary `role_on_project = 'pm'` assignment before falling back to legacy joins.

# Task 029 Output

- Updated [src/app/pm/page.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/pm/page.tsx) to load projects through `project_assignments` for roles `pm` and `lead`, and added a per-project role badge.
- Updated [src/app/installer/page.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/installer/page.tsx) to load installer projects through `project_assignments` and keep the view read-only with the SharePoint link.
- Updated [src/app/ops/page.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/ops/page.tsx) to combine explicit `ops_manager` assignments with the broader ops-manager account view.
- The portal queries now respect `role_on_project` so the same user can appear differently across PM, installer, and ops contexts depending on the assignment on each project.

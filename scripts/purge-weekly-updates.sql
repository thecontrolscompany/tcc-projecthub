-- Purge all IMPORTED weekly updates for a specific project.
-- Replace the UUID below with the project's ID (find it in the URL when editing the project).
-- Manually entered updates (imported_from IS NULL) are NOT deleted.

DELETE FROM weekly_updates
WHERE project_id = 'REPLACE-WITH-PROJECT-UUID'
  AND imported_from IS NOT NULL;

-- To verify before deleting, run this SELECT first:
-- SELECT id, week_of, imported_from FROM weekly_updates
-- WHERE project_id = 'REPLACE-WITH-PROJECT-UUID'
--   AND imported_from IS NOT NULL
-- ORDER BY week_of;

-- To purge ALL weekly updates for a project (including manually entered), uncomment:
-- DELETE FROM weekly_updates WHERE project_id = 'REPLACE-WITH-PROJECT-UUID';

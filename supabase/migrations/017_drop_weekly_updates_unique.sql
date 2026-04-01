-- Migration 017: Drop unique constraint on weekly_updates(project_id, week_of)
-- Weekly updates now accumulate (INSERT) rather than upsert per week.

ALTER TABLE weekly_updates
  DROP CONSTRAINT IF EXISTS weekly_updates_project_week_unique;

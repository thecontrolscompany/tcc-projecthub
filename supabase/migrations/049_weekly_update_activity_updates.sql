-- Migration 049: Add customer-facing activity update bullets to weekly updates.

ALTER TABLE weekly_updates
  ADD COLUMN IF NOT EXISTS activity_updates text;

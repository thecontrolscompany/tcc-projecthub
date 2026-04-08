-- Migration 038: Add include_bom_report flag to weekly_updates
ALTER TABLE weekly_updates
  ADD COLUMN IF NOT EXISTS include_bom_report boolean DEFAULT false;

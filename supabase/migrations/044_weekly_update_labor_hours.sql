-- Migration 044: QB Time labor hours on weekly updates
-- Run this manually in Supabase before using the labor-hours UI.

ALTER TABLE weekly_updates
  ADD COLUMN IF NOT EXISTS labor_hours_pulled    numeric(7,2),
  ADD COLUMN IF NOT EXISTS labor_hours_override  numeric(7,2),
  ADD COLUMN IF NOT EXISTS labor_hours_source    text
    CHECK (labor_hours_source IN ('qb_time', 'manual')),
  ADD COLUMN IF NOT EXISTS labor_hours_pulled_at timestamptz,
  ADD COLUMN IF NOT EXISTS labor_hours_detail    jsonb;

-- labor_hours_detail shape (only populated when source = 'qb_time'):
-- [{ display_name: string, mon: number, tue: number, wed: number,
--    thu: number, fri: number, sat: number, total: number }]

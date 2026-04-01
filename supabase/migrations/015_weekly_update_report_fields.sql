-- Migration 015: Add daily construction report fields to weekly_updates
-- Adds structured crew log (JSONB) + 6 notes fields from the daily report form

ALTER TABLE weekly_updates
  ADD COLUMN IF NOT EXISTS crew_log jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS material_delivered text,
  ADD COLUMN IF NOT EXISTS equipment_set text,
  ADD COLUMN IF NOT EXISTS safety_incidents text,
  ADD COLUMN IF NOT EXISTS inspections_tests text,
  ADD COLUMN IF NOT EXISTS delays_impacts text,
  ADD COLUMN IF NOT EXISTS other_remarks text;

-- crew_log shape: [{ day: string, men: number, hours: number, activities: string }]
-- days: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday

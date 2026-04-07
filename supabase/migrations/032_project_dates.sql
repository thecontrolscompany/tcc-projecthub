ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS scheduled_completion date;

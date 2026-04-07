ALTER TABLE project_assignments
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

ALTER TABLE pm_directory
  ADD COLUMN IF NOT EXISTS intended_role TEXT;

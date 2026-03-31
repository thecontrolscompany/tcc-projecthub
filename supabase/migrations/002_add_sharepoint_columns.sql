-- Add SharePoint tracking columns to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS sharepoint_folder TEXT,
  ADD COLUMN IF NOT EXISTS sharepoint_item_id TEXT,
  ADD COLUMN IF NOT EXISTS job_number TEXT UNIQUE;

-- Add index for fast lookups by sharepoint_folder
CREATE INDEX IF NOT EXISTS idx_projects_sharepoint_folder
  ON projects (sharepoint_folder)
  WHERE sharepoint_folder IS NOT NULL;

-- Add index for job_number lookups
CREATE INDEX IF NOT EXISTS idx_projects_job_number
  ON projects (job_number)
  WHERE job_number IS NOT NULL;

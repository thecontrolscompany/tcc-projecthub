ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS customer_portal_access boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS customer_email_digest boolean NOT NULL DEFAULT false;

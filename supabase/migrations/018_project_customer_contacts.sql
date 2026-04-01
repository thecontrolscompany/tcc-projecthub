-- Migration 018: Per-contact customer portal + email digest settings
-- Replaces project-level customer_portal_access / customer_email_digest booleans
-- with a junction table: one row per (project, customer profile) with individual flags.

CREATE TABLE project_customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portal_access boolean NOT NULL DEFAULT false,
  email_digest boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (project_id, profile_id)
);

CREATE INDEX project_customer_contacts_project_idx ON project_customer_contacts (project_id);
CREATE INDEX project_customer_contacts_profile_idx ON project_customer_contacts (profile_id);

-- RLS
ALTER TABLE project_customer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to project_customer_contacts"
  ON project_customer_contacts FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY "Ops manager full access to project_customer_contacts"
  ON project_customer_contacts FOR ALL
  USING (current_user_role() = 'ops_manager');

CREATE POLICY "Customer reads own project contacts"
  ON project_customer_contacts FOR SELECT
  USING (profile_id = auth.uid());

-- Customer RLS on projects: allow access if they have a portal_access contact row
-- Drop old policy first if it exists
DROP POLICY IF EXISTS "Customer reads own projects" ON projects;

CREATE POLICY "Customer reads own projects"
  ON projects FOR SELECT
  USING (
    current_user_role() = 'customer' AND
    EXISTS (
      SELECT 1 FROM project_customer_contacts pcc
      WHERE pcc.project_id = projects.id
        AND pcc.profile_id = auth.uid()
        AND pcc.portal_access = true
    )
  );

-- Keep old columns for now (non-breaking), they are just no longer the source of truth

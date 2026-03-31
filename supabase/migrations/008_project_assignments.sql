CREATE TABLE project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  pm_directory_id UUID REFERENCES pm_directory(id) ON DELETE SET NULL,
  role_on_project TEXT NOT NULL CHECK (role_on_project IN ('pm', 'lead', 'installer', 'ops_manager')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, profile_id),
  UNIQUE(project_id, pm_directory_id)
);

ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access" ON project_assignments
  FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY "User reads own assignments" ON project_assignments
  FOR SELECT
  USING (
    profile_id = auth.uid()
    OR current_user_role() IN ('pm', 'lead', 'installer', 'ops_manager', 'admin')
  );

INSERT INTO project_assignments (project_id, profile_id, pm_directory_id, role_on_project)
SELECT id, pm_id, pm_directory_id, 'pm'
FROM projects
WHERE pm_id IS NOT NULL OR pm_directory_id IS NOT NULL
ON CONFLICT DO NOTHING;

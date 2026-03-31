-- Allow ops_manager to read all weekly updates
CREATE POLICY "Ops manager reads all weekly updates" ON weekly_updates FOR SELECT USING (
  current_user_role() = 'ops_manager'
);

-- Fix PM read policy to work with project_assignments (not just legacy pm_id)
CREATE POLICY "PM reads updates via assignments" ON weekly_updates FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM project_assignments pa
    WHERE pa.project_id = weekly_updates.project_id
      AND pa.profile_id = auth.uid()
      AND pa.role_on_project IN ('pm', 'lead')
  )
);

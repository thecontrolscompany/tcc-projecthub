-- Allow pm, lead, and ops_manager to write weekly updates for their assigned projects
CREATE POLICY "Assigned staff writes weekly updates" ON weekly_updates FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM project_assignments pa
    WHERE pa.project_id = weekly_updates.project_id
      AND pa.profile_id = auth.uid()
      AND pa.role_on_project IN ('pm', 'lead', 'ops_manager')
  )
);

CREATE POLICY "Assigned staff updates own weekly updates" ON weekly_updates FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM project_assignments pa
    WHERE pa.project_id = weekly_updates.project_id
      AND pa.profile_id = auth.uid()
      AND pa.role_on_project IN ('pm', 'lead', 'ops_manager')
  )
);

-- Required for upsert onConflict: "project_id,week_of" to work
ALTER TABLE weekly_updates
  ADD CONSTRAINT weekly_updates_project_week_unique UNIQUE (project_id, week_of);

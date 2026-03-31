ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'pm', 'lead', 'installer', 'ops_manager', 'customer'));

DROP POLICY IF EXISTS "PM reads customers" ON customers;
CREATE POLICY "PM reads customers" ON customers FOR SELECT USING (
  current_user_role() IN ('pm', 'lead')
);

DROP POLICY IF EXISTS "PM reads own projects" ON projects;
DROP POLICY IF EXISTS "PM updates own projects" ON projects;

CREATE POLICY "Assigned staff read own projects" ON projects FOR SELECT USING (
  current_user_role() IN ('pm', 'lead', 'installer') AND (
    pm_id = auth.uid() OR
    EXISTS (
      SELECT 1
      FROM pm_directory pmd
      WHERE pmd.id = projects.pm_directory_id
        AND pmd.profile_id = auth.uid()
    )
  )
);

CREATE POLICY "Ops manager reads all active projects" ON projects FOR SELECT USING (
  current_user_role() = 'ops_manager' AND is_active = true
);

CREATE POLICY "PM updates own projects" ON projects FOR UPDATE USING (
  current_user_role() IN ('pm', 'lead') AND pm_id = auth.uid()
);

DROP POLICY IF EXISTS "PM reads own project billing" ON billing_periods;
CREATE POLICY "PM reads own project billing" ON billing_periods FOR SELECT USING (
  current_user_role() IN ('pm', 'lead') AND
  EXISTS (SELECT 1 FROM projects p WHERE p.id = billing_periods.project_id AND p.pm_id = auth.uid())
);

DROP POLICY IF EXISTS "PM manages own updates" ON weekly_updates;
DROP POLICY IF EXISTS "PM reads all updates for own projects" ON weekly_updates;

CREATE POLICY "PM manages own updates" ON weekly_updates FOR ALL USING (
  current_user_role() IN ('pm', 'lead') AND pm_id = auth.uid()
);

CREATE POLICY "PM reads all updates for own projects" ON weekly_updates FOR SELECT USING (
  current_user_role() IN ('pm', 'lead') AND
  EXISTS (SELECT 1 FROM projects p WHERE p.id = weekly_updates.project_id AND p.pm_id = auth.uid())
);

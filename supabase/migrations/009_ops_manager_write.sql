DROP POLICY IF EXISTS "PM reads customers" ON customers;
CREATE POLICY "PM reads customers" ON customers FOR SELECT USING (
  current_user_role() IN ('pm', 'lead', 'ops_manager')
);

CREATE POLICY "Ops manager inserts customers" ON customers FOR INSERT WITH CHECK (
  current_user_role() = 'ops_manager'
);

CREATE POLICY "Ops manager updates all projects" ON projects FOR UPDATE USING (
  current_user_role() = 'ops_manager'
) WITH CHECK (
  current_user_role() = 'ops_manager'
);

CREATE POLICY "Ops manager updates project billing" ON billing_periods FOR UPDATE USING (
  current_user_role() = 'ops_manager'
) WITH CHECK (
  current_user_role() = 'ops_manager'
);

CREATE POLICY "Ops manager reads all profiles" ON profiles FOR SELECT USING (
  current_user_role() = 'ops_manager'
);

CREATE POLICY "Ops manager reads pm_directory" ON pm_directory FOR SELECT USING (
  current_user_role() = 'ops_manager'
);

CREATE POLICY "Ops manager manages assignments" ON project_assignments FOR ALL USING (
  current_user_role() = 'ops_manager'
) WITH CHECK (
  current_user_role() = 'ops_manager'
);

DROP POLICY IF EXISTS "Admin full access" ON public.project_assignments;
DROP POLICY IF EXISTS "User reads own assignments" ON public.project_assignments;
DROP POLICY IF EXISTS "Ops manager manages assignments" ON public.project_assignments;

CREATE POLICY "Assignments own select"
  ON public.project_assignments
  FOR SELECT
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'ops_manager')
    )
  );

CREATE POLICY "Assignments privileged manage"
  ON public.project_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'ops_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'ops_manager')
    )
  );

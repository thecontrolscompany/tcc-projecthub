-- Budget vs Actual (Phase 1, independent of QBO)
-- Adds material unit cost, a per-project labor rate, and a budget lines table
-- for labor/subcontractor/other budget vs actual tracking.

ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS unit_cost numeric(10,2);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS labor_rate numeric(10,2) NOT NULL DEFAULT 42.95;

CREATE TABLE IF NOT EXISTS project_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('labor', 'material', 'subcontractor', 'other')),
  description text,
  budgeted_cost numeric(12,2) NOT NULL DEFAULT 0,
  actual_cost numeric(12,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_budget_project_id ON project_budget(project_id);

ALTER TABLE project_budget ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access to project_budget" ON project_budget;
DROP POLICY IF EXISTS "PM reads budget for assigned projects" ON project_budget;

CREATE POLICY "Admin full access to project_budget"
  ON project_budget FOR ALL
  USING (current_user_role() IN ('admin', 'ops_manager'));

CREATE POLICY "PM reads budget for assigned projects"
  ON project_budget FOR SELECT
  USING (
    current_user_role() IN ('pm', 'lead', 'installer') AND
    EXISTS (
      SELECT 1
      FROM project_assignments pa
      WHERE pa.project_id = project_budget.project_id
        AND pa.profile_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS trg_project_budget_updated_at ON project_budget;
CREATE TRIGGER trg_project_budget_updated_at
  BEFORE UPDATE ON project_budget
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

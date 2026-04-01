-- Migration 016: POC line items — replaces OneDrive POC Sheet.xlsx
-- Each project defines its own line items with weights.
-- PM updates % complete per item; weighted sum = overall % complete.

CREATE TABLE poc_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category text NOT NULL,
  weight numeric NOT NULL DEFAULT 1 CHECK (weight > 0),
  pct_complete numeric(5,4) NOT NULL DEFAULT 0 CHECK (pct_complete >= 0 AND pct_complete <= 1),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX poc_line_items_project_id_idx ON poc_line_items (project_id);

-- Snapshot of all line item values at the time a weekly update is submitted
ALTER TABLE weekly_updates
  ADD COLUMN IF NOT EXISTS poc_snapshot jsonb;
-- Shape: [{ id, category, weight, pct_complete }]

-- RLS
ALTER TABLE poc_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to poc_line_items"
  ON poc_line_items FOR ALL
  USING (current_user_role() = 'admin');

CREATE POLICY "Ops manager full access to poc_line_items"
  ON poc_line_items FOR ALL
  USING (current_user_role() = 'ops_manager');

CREATE POLICY "PM reads poc_line_items for assigned projects"
  ON poc_line_items FOR SELECT
  USING (
    current_user_role() IN ('pm', 'lead') AND
    EXISTS (
      SELECT 1 FROM project_assignments pa
      WHERE pa.project_id = poc_line_items.project_id
        AND pa.profile_id = auth.uid()
        AND pa.role_on_project IN ('pm', 'lead', 'ops_manager')
    )
  );

CREATE POLICY "PM updates poc_line_items for assigned projects"
  ON poc_line_items FOR UPDATE
  USING (
    current_user_role() IN ('pm', 'lead') AND
    EXISTS (
      SELECT 1 FROM project_assignments pa
      WHERE pa.project_id = poc_line_items.project_id
        AND pa.profile_id = auth.uid()
        AND pa.role_on_project IN ('pm', 'lead', 'ops_manager')
    )
  );

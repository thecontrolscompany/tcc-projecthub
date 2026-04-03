CREATE TABLE IF NOT EXISTS bom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section text NOT NULL DEFAULT 'General',
  designation text,
  code_number text,
  description text NOT NULL,
  qty_required integer NOT NULL DEFAULT 0,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bom_items_project_id ON bom_items(project_id);

CREATE TABLE IF NOT EXISTS material_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_item_id uuid NOT NULL REFERENCES bom_items(id) ON DELETE CASCADE,
  qty_received integer NOT NULL DEFAULT 0,
  date_received date NOT NULL DEFAULT CURRENT_DATE,
  received_by uuid REFERENCES profiles(id),
  packing_slip text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_receipts_bom_item_id ON material_receipts(bom_item_id);

ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access to bom_items" ON bom_items;
DROP POLICY IF EXISTS "PM reads bom for assigned projects" ON bom_items;
DROP POLICY IF EXISTS "Admin full access to material_receipts" ON material_receipts;
DROP POLICY IF EXISTS "PM manages receipts for assigned projects" ON material_receipts;

CREATE POLICY "Admin full access to bom_items"
  ON bom_items FOR ALL
  USING (current_user_role() IN ('admin', 'ops_manager'));

CREATE POLICY "PM reads bom for assigned projects"
  ON bom_items FOR SELECT
  USING (
    current_user_role() IN ('pm', 'lead', 'installer') AND
    EXISTS (
      SELECT 1
      FROM project_assignments pa
      WHERE pa.project_id = bom_items.project_id
        AND pa.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admin full access to material_receipts"
  ON material_receipts FOR ALL
  USING (current_user_role() IN ('admin', 'ops_manager'));

CREATE POLICY "PM manages receipts for assigned projects"
  ON material_receipts FOR ALL
  USING (
    current_user_role() IN ('pm', 'lead') AND
    EXISTS (
      SELECT 1
      FROM bom_items bi
      JOIN project_assignments pa ON pa.project_id = bi.project_id
      WHERE bi.id = material_receipts.bom_item_id
        AND pa.profile_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_bom_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bom_items_updated_at ON bom_items;

CREATE TRIGGER trg_bom_items_updated_at
  BEFORE UPDATE ON bom_items
  FOR EACH ROW
  EXECUTE FUNCTION update_bom_items_updated_at();

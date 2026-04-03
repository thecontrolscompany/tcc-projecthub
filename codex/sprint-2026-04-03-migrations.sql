-- ============================================================
-- TCC ProjectHub — Pre-Sprint Migrations
-- Run ALL of these in Supabase SQL Editor BEFORE starting Codex
-- Date: 2026-04-03
-- ============================================================

-- ── Migration 026: pm_directory phone column ──────────────────
ALTER TABLE pm_directory ADD COLUMN IF NOT EXISTS phone text;

-- ── Migration 027: source_estimate_id on projects ────────────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_estimate_id text;

-- ── Migration 028: customer_feedback table ───────────────────
CREATE TABLE IF NOT EXISTS customer_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message      text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed     boolean NOT NULL DEFAULT false
);

ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer inserts own feedback" ON customer_feedback;
CREATE POLICY "Customer inserts own feedback"
  ON customer_feedback FOR INSERT
  WITH CHECK (profile_id = auth.uid() AND current_user_role() = 'customer');

DROP POLICY IF EXISTS "Customer reads own feedback" ON customer_feedback;
CREATE POLICY "Customer reads own feedback"
  ON customer_feedback FOR SELECT
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Admin full access to customer_feedback" ON customer_feedback;
CREATE POLICY "Admin full access to customer_feedback"
  ON customer_feedback FOR ALL
  USING (current_user_role() IN ('admin', 'ops_manager'));

-- ── Migration 029: WIP tracker ───────────────────────────────
DO $$ BEGIN
  CREATE TYPE wip_status AS ENUM ('not_started', 'in_progress', 'blocked', 'in_review', 'complete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wip_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS wip_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  system_area      text NOT NULL,
  task             text NOT NULL,
  status           wip_status NOT NULL DEFAULT 'not_started',
  assigned_to      text,
  responsible_co   text DEFAULT 'TCC',
  blocker          text,
  priority         wip_priority NOT NULL DEFAULT 'medium',
  due_date         date,
  notes            text,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wip_items_project_id ON wip_items(project_id);
CREATE INDEX IF NOT EXISTS idx_wip_items_status ON wip_items(status);

ALTER TABLE wip_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access to wip_items" ON wip_items;
CREATE POLICY "Admin full access to wip_items"
  ON wip_items FOR ALL
  USING (current_user_role() IN ('admin', 'ops_manager'));

DROP POLICY IF EXISTS "PM reads wip for assigned projects" ON wip_items;
CREATE POLICY "PM reads wip for assigned projects"
  ON wip_items FOR SELECT
  USING (
    current_user_role() IN ('pm', 'lead', 'installer') AND
    EXISTS (
      SELECT 1 FROM project_assignments pa
      WHERE pa.project_id = wip_items.project_id
        AND pa.profile_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_wip_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_wip_items_updated_at ON wip_items;
CREATE TRIGGER trg_wip_items_updated_at
  BEFORE UPDATE ON wip_items
  FOR EACH ROW EXECUTE FUNCTION update_wip_items_updated_at();

-- ── Migration 030: BOM / Materials ───────────────────────────
CREATE TABLE IF NOT EXISTS bom_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section      text NOT NULL DEFAULT 'General',
  designation  text,
  code_number  text,
  description  text NOT NULL,
  qty_required integer NOT NULL DEFAULT 0,
  notes        text,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bom_items_project_id ON bom_items(project_id);

CREATE TABLE IF NOT EXISTS material_receipts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_item_id   uuid NOT NULL REFERENCES bom_items(id) ON DELETE CASCADE,
  qty_received  integer NOT NULL DEFAULT 0,
  date_received date NOT NULL DEFAULT CURRENT_DATE,
  received_by   uuid REFERENCES profiles(id),
  packing_slip  text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_receipts_bom_item_id ON material_receipts(bom_item_id);

ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access to bom_items" ON bom_items;
CREATE POLICY "Admin full access to bom_items"
  ON bom_items FOR ALL
  USING (current_user_role() IN ('admin', 'ops_manager'));

DROP POLICY IF EXISTS "PM reads bom for assigned projects" ON bom_items;
CREATE POLICY "PM reads bom for assigned projects"
  ON bom_items FOR SELECT
  USING (
    current_user_role() IN ('pm', 'lead', 'installer') AND
    EXISTS (
      SELECT 1 FROM project_assignments pa
      WHERE pa.project_id = bom_items.project_id
        AND pa.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin full access to material_receipts" ON material_receipts;
CREATE POLICY "Admin full access to material_receipts"
  ON material_receipts FOR ALL
  USING (current_user_role() IN ('admin', 'ops_manager'));

DROP POLICY IF EXISTS "PM manages receipts for assigned projects" ON material_receipts;
CREATE POLICY "PM manages receipts for assigned projects"
  ON material_receipts FOR ALL
  USING (
    current_user_role() IN ('pm', 'lead') AND
    EXISTS (
      SELECT 1 FROM bom_items bi
      JOIN project_assignments pa ON pa.project_id = bi.project_id
      WHERE bi.id = material_receipts.bom_item_id
        AND pa.profile_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_bom_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_bom_items_updated_at ON bom_items;
CREATE TRIGGER trg_bom_items_updated_at
  BEFORE UPDATE ON bom_items
  FOR EACH ROW EXECUTE FUNCTION update_bom_items_updated_at();

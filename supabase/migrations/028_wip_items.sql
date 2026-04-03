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

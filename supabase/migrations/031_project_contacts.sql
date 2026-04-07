CREATE TABLE IF NOT EXISTS project_contacts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role        text        NOT NULL,
  company     text,
  contact_name text,
  phone       text,
  email       text,
  notes       text,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_contacts_project_id
  ON project_contacts(project_id);

CREATE OR REPLACE FUNCTION update_project_contacts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_contacts_updated_at ON project_contacts;
CREATE TRIGGER trg_project_contacts_updated_at
  BEFORE UPDATE ON project_contacts
  FOR EACH ROW EXECUTE FUNCTION update_project_contacts_updated_at();

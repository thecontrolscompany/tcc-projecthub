CREATE TABLE IF NOT EXISTS project_rfis (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rfi_number          integer     NOT NULL,
  subject             text        NOT NULL,
  question            text,
  directed_to         text,
  date_submitted      date        NOT NULL DEFAULT CURRENT_DATE,
  date_responded      date,
  response            text,
  status              text        NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open', 'pending_response', 'closed')),
  created_by_profile_id uuid      REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, rfi_number)
);

CREATE INDEX IF NOT EXISTS idx_project_rfis_project_id
  ON project_rfis(project_id);

CREATE OR REPLACE FUNCTION update_project_rfis_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_rfis_updated_at ON project_rfis;
CREATE TRIGGER trg_project_rfis_updated_at
  BEFORE UPDATE ON project_rfis
  FOR EACH ROW EXECUTE FUNCTION update_project_rfis_updated_at();

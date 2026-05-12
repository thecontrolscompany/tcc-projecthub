CREATE TABLE IF NOT EXISTS crm_shared_exports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token        text        NOT NULL UNIQUE,
  type         text        NOT NULL DEFAULT 'contact_directory',
  title        text,
  snapshot     jsonb       NOT NULL DEFAULT '{}',
  created_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  view_count   int         NOT NULL DEFAULT 0
);

ALTER TABLE crm_shared_exports ENABLE ROW LEVEL SECURITY;

-- Public can read by token (no auth required)
CREATE POLICY "shared_exports_public_read" ON crm_shared_exports
  FOR SELECT USING (true);

-- Only authenticated write-role users can create/manage exports
CREATE POLICY "shared_exports_auth_write" ON crm_shared_exports
  FOR ALL USING (auth.uid() = created_by);

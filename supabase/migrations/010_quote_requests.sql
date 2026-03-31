CREATE TABLE IF NOT EXISTS quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  project_description text NOT NULL,
  site_address text,
  estimated_value numeric(12,2),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','reviewing','quoted','won','lost')),
  notes text,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL
);

ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public submits quotes" ON quote_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin manages quotes" ON quote_requests FOR ALL USING (
  current_user_role() = 'admin'
) WITH CHECK (
  current_user_role() = 'admin'
);

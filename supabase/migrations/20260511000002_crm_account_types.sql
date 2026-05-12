-- Add electrical_contractor and tab_commissioning to crm_accounts type constraint
-- Also expand to support multiple types via a types[] array column

ALTER TABLE crm_accounts DROP CONSTRAINT IF EXISTS crm_accounts_type_check;

ALTER TABLE crm_accounts
  ADD CONSTRAINT crm_accounts_type_check
  CHECK (type IN (
    'general_contractor',
    'mechanical_contractor',
    'electrical_contractor',
    'tab_commissioning',
    'controls_contractor',
    'hvac_oem',
    'controls_oem',
    'owner',
    'other'
  ));

-- Add types[] for accounts that span multiple categories (e.g. mechanical + controls)
ALTER TABLE crm_accounts
  ADD COLUMN IF NOT EXISTS types text[] NOT NULL DEFAULT '{}';

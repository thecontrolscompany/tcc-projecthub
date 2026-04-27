-- ==============================================================
-- CRM FOUNDATION — TCC RelationshipHub
-- 7 tables, indexes, per-table updated_at triggers, 2 date-rollup
-- triggers, and RLS policies.
-- ==============================================================

-- crm_accounts: external companies TCC works with
CREATE TABLE IF NOT EXISTS public.crm_accounts (
  id                               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name                     text NOT NULL,
  type                             text NOT NULL DEFAULT 'other'
    CHECK (type IN ('general_contractor','mechanical_contractor','controls_contractor',
                    'hvac_oem','controls_oem','owner','other')),
  territory                        text,
  status                           text NOT NULL DEFAULT 'prospect'
    CHECK (status IN ('active','inactive','prospect')),
  notes                            text,
  relationship_owner_profile_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  tags                             text[] NOT NULL DEFAULT '{}',
  website                          text,
  address                          text,
  relationship_health              text NOT NULL DEFAULT 'unknown'
    CHECK (relationship_health IN ('strong','good','at_risk','dormant','unknown')),
  last_meaningful_contact_date     date,
  next_scheduled_followup_date     date,
  who_buys                         text,
  who_issues_po                    text,
  who_influences_spec              text,
  who_owns_estimating_relationship text,
  handoff_notes                    text,
  linked_customer_id               uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  created_at                       timestamptz NOT NULL DEFAULT now(),
  updated_at                       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_accounts_status ON public.crm_accounts (status);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_health ON public.crm_accounts (relationship_health);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_owner ON public.crm_accounts (relationship_owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_linked_customer ON public.crm_accounts (linked_customer_id);

-- crm_contacts: individual people at those companies
CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id                    uuid NOT NULL REFERENCES public.crm_accounts(id) ON DELETE CASCADE,
  first_name                    text,
  last_name                     text,
  display_name                  text NOT NULL,
  role_type                     text NOT NULL DEFAULT 'unknown'
    CHECK (role_type IN ('salesperson','sales_manager','estimator','project_manager',
                         'senior_project_manager','operations_manager','owner','cfo',
                         'cfo_estimator','unknown')),
  title                         text,
  email                         text,
  phone                         text,
  mobile                        text,
  location                      text,
  preferred_contact_method      text NOT NULL DEFAULT 'email'
    CHECK (preferred_contact_method IN ('email','phone','mobile','in_person')),
  influence_level               text NOT NULL DEFAULT 'unknown'
    CHECK (influence_level IN ('high','medium','low','unknown')),
  buying_role                   text NOT NULL DEFAULT 'unknown'
    CHECK (buying_role IN ('decision_maker','influencer','evaluator','user','gatekeeper','unknown')),
  reports_to_contact_id         uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  issues_purchase_orders        boolean NOT NULL DEFAULT false,
  involved_in_estimating        boolean NOT NULL DEFAULT false,
  involved_in_project_execution boolean NOT NULL DEFAULT false,
  notes                         text,
  is_active                     boolean NOT NULL DEFAULT true,
  confidence_level              text NOT NULL DEFAULT 'needs_verification'
    CHECK (confidence_level IN ('confirmed','partially_confirmed','needs_verification')),
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_account ON public.crm_contacts (account_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_active ON public.crm_contacts (is_active);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_role_type ON public.crm_contacts (role_type);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_confidence ON public.crm_contacts (confidence_level);

-- crm_opportunities: sales pipeline
CREATE TABLE IF NOT EXISTS public.crm_opportunities (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_number        text UNIQUE,
  account_id                uuid NOT NULL REFERENCES public.crm_accounts(id) ON DELETE CASCADE,
  project_name              text NOT NULL,
  primary_contact_id        uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  estimator_profile_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  pm_profile_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  internal_owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  estimated_value           numeric(12,2),
  estimated_gross_margin    numeric(12,2),
  estimated_margin_pct      numeric(5,4),
  probability               integer CHECK (probability >= 0 AND probability <= 100),
  expected_close_date       date,
  bid_due_date              date,
  market_type               text,
  stage                     text NOT NULL DEFAULT 'target_account'
    CHECK (stage IN ('target_account','initial_contact','relationship_building',
                     'opportunity_identified','request_for_pricing','estimating',
                     'proposal_sent','follow_up_negotiation','verbal_award',
                     'po_received','closed_lost','on_hold')),
  next_step                 text,
  last_activity_date        date,
  lead_source               text,
  notes                     text,
  linked_pursuit_id         uuid REFERENCES public.pursuits(id) ON DELETE SET NULL,
  linked_quote_request_id   uuid REFERENCES public.quote_requests(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS crm_opportunity_seq START 1001;
ALTER TABLE public.crm_opportunities
  ALTER COLUMN opportunity_number
  SET DEFAULT 'CRM-' || lpad(nextval('crm_opportunity_seq')::text, 4, '0');

ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_opps_account ON public.crm_opportunities (account_id);
CREATE INDEX IF NOT EXISTS idx_crm_opps_stage ON public.crm_opportunities (stage);
CREATE INDEX IF NOT EXISTS idx_crm_opps_bid_date ON public.crm_opportunities (bid_due_date);
CREATE INDEX IF NOT EXISTS idx_crm_opps_close_date ON public.crm_opportunities (expected_close_date);
CREATE INDEX IF NOT EXISTS idx_crm_opps_linked_pursuit ON public.crm_opportunities (linked_pursuit_id);
CREATE INDEX IF NOT EXISTS idx_crm_opps_linked_qr ON public.crm_opportunities (linked_quote_request_id);

-- crm_opportunity_contacts: M:M junction — which contacts are on each opportunity
CREATE TABLE IF NOT EXISTS public.crm_opportunity_contacts (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id              uuid NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  contact_id                  uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  contact_role_on_opportunity text NOT NULL DEFAULT 'secondary'
    CHECK (contact_role_on_opportunity IN ('primary','secondary','estimating',
                                            'pm_handoff','technical','executive')),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, contact_id)
);

ALTER TABLE public.crm_opportunity_contacts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_opp_contacts_opp ON public.crm_opportunity_contacts (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_crm_opp_contacts_contact ON public.crm_opportunity_contacts (contact_id);

-- crm_activities: every customer touchpoint / interaction log
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type        text NOT NULL DEFAULT 'other'
    CHECK (activity_type IN ('meeting','call','email','site_visit','lunch',
                              'estimate_request','proposal_followup','pm_handoff','other')),
  activity_date        date NOT NULL DEFAULT CURRENT_DATE,
  summary              text NOT NULL,
  key_decisions        text,
  follow_up_actions    text,
  follow_up_due_date   date,
  attendees_text       text,
  account_id           uuid REFERENCES public.crm_accounts(id) ON DELETE SET NULL,
  contact_id           uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  opportunity_id       uuid REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  logged_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_activities_account ON public.crm_activities (account_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON public.crm_activities (contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_opp ON public.crm_activities (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_date ON public.crm_activities (activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_logged_by ON public.crm_activities (logged_by_profile_id);

-- crm_tasks: follow-ups and reminders
CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  text NOT NULL,
  description            text,
  assigned_to_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date               date,
  priority               text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','urgent')),
  status                 text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','completed','cancelled')),
  account_id             uuid REFERENCES public.crm_accounts(id) ON DELETE SET NULL,
  contact_id             uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  opportunity_id         uuid REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  reminder_date          date,
  completed_at           timestamptz,
  created_by_profile_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned ON public.crm_tasks (assigned_to_profile_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON public.crm_tasks (status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_date ON public.crm_tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_account ON public.crm_tasks (account_id);

-- crm_salesperson_targets: lightweight performance targets per person per period
CREATE TABLE IF NOT EXISTS public.crm_salesperson_targets (
  id                                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id                        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start                      date NOT NULL,
  period_end                        date NOT NULL,
  target_customer_meetings_per_week integer,
  target_outreach_touches_per_week  integer,
  target_active_opportunities       integer,
  target_proposals_requested        integer,
  target_proposals_sent             integer,
  target_closed_won_revenue         numeric(12,2),
  target_gross_margin               numeric(12,2),
  strategic_notes                   text,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, period_start)
);

ALTER TABLE public.crm_salesperson_targets ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_crm_targets_profile ON public.crm_salesperson_targets (profile_id);

-- ==============================================================
-- UPDATED_AT TRIGGERS (one function + trigger per table)
-- ==============================================================

CREATE OR REPLACE FUNCTION update_crm_accounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_crm_accounts_updated_at ON public.crm_accounts;
CREATE TRIGGER trg_crm_accounts_updated_at
  BEFORE UPDATE ON public.crm_accounts
  FOR EACH ROW EXECUTE FUNCTION update_crm_accounts_updated_at();

CREATE OR REPLACE FUNCTION update_crm_contacts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_crm_contacts_updated_at ON public.crm_contacts;
CREATE TRIGGER trg_crm_contacts_updated_at
  BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION update_crm_contacts_updated_at();

CREATE OR REPLACE FUNCTION update_crm_opportunities_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_crm_opportunities_updated_at ON public.crm_opportunities;
CREATE TRIGGER trg_crm_opportunities_updated_at
  BEFORE UPDATE ON public.crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_crm_opportunities_updated_at();

CREATE OR REPLACE FUNCTION update_crm_activities_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_crm_activities_updated_at ON public.crm_activities;
CREATE TRIGGER trg_crm_activities_updated_at
  BEFORE UPDATE ON public.crm_activities
  FOR EACH ROW EXECUTE FUNCTION update_crm_activities_updated_at();

CREATE OR REPLACE FUNCTION update_crm_tasks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_crm_tasks_updated_at ON public.crm_tasks;
CREATE TRIGGER trg_crm_tasks_updated_at
  BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION update_crm_tasks_updated_at();

CREATE OR REPLACE FUNCTION update_crm_salesperson_targets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_crm_salesperson_targets_updated_at ON public.crm_salesperson_targets;
CREATE TRIGGER trg_crm_salesperson_targets_updated_at
  BEFORE UPDATE ON public.crm_salesperson_targets
  FOR EACH ROW EXECUTE FUNCTION update_crm_salesperson_targets_updated_at();

-- ==============================================================
-- DATE ROLLUP TRIGGERS
-- Auto-maintain last_meaningful_contact_date and last_activity_date
-- so the application layer never has to manage these manually.
-- ==============================================================

CREATE OR REPLACE FUNCTION crm_update_account_last_contact()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    UPDATE public.crm_accounts
    SET last_meaningful_contact_date = GREATEST(
          COALESCE(last_meaningful_contact_date, '1900-01-01'::date),
          NEW.activity_date
        )
    WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_activity_update_account_contact ON public.crm_activities;
CREATE TRIGGER trg_crm_activity_update_account_contact
  AFTER INSERT ON public.crm_activities
  FOR EACH ROW EXECUTE FUNCTION crm_update_account_last_contact();

CREATE OR REPLACE FUNCTION crm_update_opportunity_last_activity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.opportunity_id IS NOT NULL THEN
    UPDATE public.crm_opportunities
    SET last_activity_date = GREATEST(
          COALESCE(last_activity_date, '1900-01-01'::date),
          NEW.activity_date
        )
    WHERE id = NEW.opportunity_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_activity_update_opp_activity ON public.crm_activities;
CREATE TRIGGER trg_crm_activity_update_opp_activity
  AFTER INSERT ON public.crm_activities
  FOR EACH ROW EXECUTE FUNCTION crm_update_opportunity_last_activity();

-- ==============================================================
-- ROW LEVEL SECURITY POLICIES
-- current_user_role() already defined in migration 001
-- ==============================================================

-- crm_accounts
DROP POLICY IF EXISTS "CRM admin full access to accounts" ON public.crm_accounts;
CREATE POLICY "CRM admin full access to accounts" ON public.crm_accounts
  FOR ALL USING (current_user_role() IN ('admin','ops_manager'))
  WITH CHECK (current_user_role() IN ('admin','ops_manager'));

DROP POLICY IF EXISTS "CRM pm read accounts" ON public.crm_accounts;
CREATE POLICY "CRM pm read accounts" ON public.crm_accounts
  FOR SELECT USING (current_user_role() IN ('pm','lead'));

-- crm_contacts
DROP POLICY IF EXISTS "CRM admin full access to contacts" ON public.crm_contacts;
CREATE POLICY "CRM admin full access to contacts" ON public.crm_contacts
  FOR ALL USING (current_user_role() IN ('admin','ops_manager'))
  WITH CHECK (current_user_role() IN ('admin','ops_manager'));

DROP POLICY IF EXISTS "CRM pm read contacts" ON public.crm_contacts;
CREATE POLICY "CRM pm read contacts" ON public.crm_contacts
  FOR SELECT USING (current_user_role() IN ('pm','lead'));

-- crm_opportunities
DROP POLICY IF EXISTS "CRM admin full access to opportunities" ON public.crm_opportunities;
CREATE POLICY "CRM admin full access to opportunities" ON public.crm_opportunities
  FOR ALL USING (current_user_role() IN ('admin','ops_manager'))
  WITH CHECK (current_user_role() IN ('admin','ops_manager'));

DROP POLICY IF EXISTS "CRM pm read opportunities" ON public.crm_opportunities;
CREATE POLICY "CRM pm read opportunities" ON public.crm_opportunities
  FOR SELECT USING (current_user_role() IN ('pm','lead'));

-- crm_opportunity_contacts
DROP POLICY IF EXISTS "CRM admin full access to opp contacts" ON public.crm_opportunity_contacts;
CREATE POLICY "CRM admin full access to opp contacts" ON public.crm_opportunity_contacts
  FOR ALL USING (current_user_role() IN ('admin','ops_manager'))
  WITH CHECK (current_user_role() IN ('admin','ops_manager'));

DROP POLICY IF EXISTS "CRM pm read opp contacts" ON public.crm_opportunity_contacts;
CREATE POLICY "CRM pm read opp contacts" ON public.crm_opportunity_contacts
  FOR SELECT USING (current_user_role() IN ('pm','lead'));

-- crm_activities
DROP POLICY IF EXISTS "CRM admin full access to activities" ON public.crm_activities;
CREATE POLICY "CRM admin full access to activities" ON public.crm_activities
  FOR ALL USING (current_user_role() IN ('admin','ops_manager'))
  WITH CHECK (current_user_role() IN ('admin','ops_manager'));

-- crm_tasks
DROP POLICY IF EXISTS "CRM admin full access to tasks" ON public.crm_tasks;
CREATE POLICY "CRM admin full access to tasks" ON public.crm_tasks
  FOR ALL USING (current_user_role() IN ('admin','ops_manager'))
  WITH CHECK (current_user_role() IN ('admin','ops_manager'));

-- crm_salesperson_targets
DROP POLICY IF EXISTS "CRM admin full access to targets" ON public.crm_salesperson_targets;
CREATE POLICY "CRM admin full access to targets" ON public.crm_salesperson_targets
  FOR ALL USING (current_user_role() IN ('admin','ops_manager'))
  WITH CHECK (current_user_role() IN ('admin','ops_manager'));

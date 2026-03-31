-- TCC ProjectHub — Initial Schema
-- Run in Supabase SQL editor or via `supabase db push`

-- Enable UUID extension (usually pre-enabled in Supabase)
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null check (role in ('admin', 'pm', 'customer')),
  email text unique not null
);

-- Auto-create profile on user signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, role, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- CUSTOMERS
-- ============================================================
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  created_at timestamptz default now()
);

-- ============================================================
-- PROJECTS
-- ============================================================
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  pm_id uuid references profiles(id) on delete set null,
  name text not null,
  estimated_income numeric(12,2) not null default 0,
  onedrive_path text,  -- relative path within OneDrive Projects folder
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- PM DIRECTORY
-- ============================================================
create table if not exists pm_directory (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  first_name text,
  email text unique not null
);

-- ============================================================
-- BILLING PERIODS
-- ============================================================
create table if not exists billing_periods (
  id uuid primary key default gen_random_uuid(),
  period_month date not null,              -- first day of month (e.g. 2026-03-01)
  project_id uuid not null references projects(id) on delete cascade,
  estimated_income_snapshot numeric(12,2) not null default 0,  -- locked at roll-forward
  prior_pct numeric(5,4) not null default 0,
  pct_complete numeric(5,4) not null default 0,
  prev_billed numeric(12,2) not null default 0,
  actual_billed numeric(12,2),
  notes text,
  synced_from_onedrive boolean default false,
  updated_at timestamptz default now(),
  unique(project_id, period_month)
);

-- Computed columns as views (generated columns can't reference other tables)
-- to_bill = MAX(estimated_income_snapshot * pct_complete - prev_billed, 0)
-- backlog  = estimated_income_snapshot - prev_billed
-- These are calculated in application code and in the billing_rows view below.

-- ============================================================
-- WEEKLY UPDATES
-- ============================================================
create table if not exists weekly_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  pm_id uuid references profiles(id) on delete set null,
  week_of date not null,
  pct_complete numeric(5,4),
  notes text,
  blockers text,
  submitted_at timestamptz default now()
);

-- ============================================================
-- BILLING ROWS VIEW (admin billing table)
-- ============================================================
create or replace view billing_rows as
select
  bp.id                                           as billing_period_id,
  bp.period_month,
  p.id                                            as project_id,
  c.name                                          as customer_name,
  p.name                                          as project_name,
  coalesce(pm.email, '')                          as pm_email,
  coalesce(pmd.first_name, split_part(pm.email, '@', 1)) as pm_name,
  bp.estimated_income_snapshot                    as estimated_income,
  greatest(bp.estimated_income_snapshot - bp.prev_billed, 0) as backlog,
  bp.prior_pct,
  bp.pct_complete,
  bp.prev_billed,
  case when bp.estimated_income_snapshot > 0
    then bp.prev_billed / bp.estimated_income_snapshot
    else 0
  end                                             as prev_billed_pct,
  greatest(bp.estimated_income_snapshot * bp.pct_complete - bp.prev_billed, 0) as to_bill,
  bp.actual_billed,
  bp.synced_from_onedrive
from billing_periods bp
join projects p on p.id = bp.project_id
left join customers c on c.id = p.customer_id
left join profiles pm on pm.id = p.pm_id
left join pm_directory pmd on pmd.profile_id = p.pm_id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table customers enable row level security;
alter table projects enable row level security;
alter table billing_periods enable row level security;
alter table weekly_updates enable row level security;
alter table pm_directory enable row level security;

-- Helper function: get current user role
create or replace function current_user_role()
returns text language sql security definer as $$
  select role from profiles where id = auth.uid();
$$;

-- PROFILES
create policy "Users read own profile" on profiles for select using (id = auth.uid());
create policy "Admin reads all profiles" on profiles for select using (current_user_role() = 'admin');
create policy "Admin manages profiles" on profiles for all using (current_user_role() = 'admin');

-- CUSTOMERS
create policy "Admin full access to customers" on customers for all using (current_user_role() = 'admin');
create policy "PM reads customers" on customers for select using (current_user_role() = 'pm');
create policy "Customer reads own record" on customers for select using (
  current_user_role() = 'customer' and
  exists (
    select 1 from projects p
    join billing_periods bp on bp.project_id = p.id
    where p.customer_id = customers.id
      and p.pm_id = auth.uid()
  )
);

-- PROJECTS
create policy "Admin full access to projects" on projects for all using (current_user_role() = 'admin');
create policy "PM reads own projects" on projects for select using (
  current_user_role() = 'pm' and pm_id = auth.uid()
);
create policy "PM updates own projects" on projects for update using (
  current_user_role() = 'pm' and pm_id = auth.uid()
);

-- BILLING PERIODS
create policy "Admin full access to billing" on billing_periods for all using (current_user_role() = 'admin');
create policy "PM reads own project billing" on billing_periods for select using (
  current_user_role() = 'pm' and
  exists (select 1 from projects p where p.id = billing_periods.project_id and p.pm_id = auth.uid())
);

-- WEEKLY UPDATES
create policy "Admin full access to updates" on weekly_updates for all using (current_user_role() = 'admin');
create policy "PM manages own updates" on weekly_updates for all using (
  current_user_role() = 'pm' and pm_id = auth.uid()
);
create policy "PM reads all updates for own projects" on weekly_updates for select using (
  current_user_role() = 'pm' and
  exists (select 1 from projects p where p.id = weekly_updates.project_id and p.pm_id = auth.uid())
);

-- PM DIRECTORY
create policy "Admin full access to pm_directory" on pm_directory for all using (current_user_role() = 'admin');
create policy "PM reads pm_directory" on pm_directory for select using (current_user_role() in ('pm', 'admin'));

-- ============================================================
-- SEED DATA (dev only — remove before production)
-- ============================================================
-- Insert seed data via the application after auth users are created.
-- See supabase/seed.sql for sample data.

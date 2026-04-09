-- ProjectHub time merge foundation
-- Adds non-destructive tables/crosswalks so TCC Time data can be merged into the
-- portal database without overwriting existing ProjectHub projects or profiles.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'integration_target') then
    create type integration_target as enum ('quickbooks_time', 'quickbooks_online');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'integration_run_status') then
    create type integration_run_status as enum ('running', 'completed', 'failed', 'partial');
  end if;
end
$$;

alter table public.projects
  add column if not exists project_number text;

create index if not exists idx_projects_project_number
  on public.projects (project_number);

create table if not exists public.qb_time_users (
  qb_user_id bigint primary key,
  email text,
  username text,
  display_name text not null,
  first_name text,
  last_name text,
  payroll_id text,
  active boolean not null default true,
  group_id bigint,
  last_active_at timestamptz,
  last_modified_at timestamptz,
  raw_json jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qb_time_jobcodes (
  qb_jobcode_id bigint primary key,
  parent_qb_jobcode_id bigint,
  name text not null,
  type text,
  active boolean not null default true,
  assigned_to_all boolean not null default false,
  billable boolean not null default false,
  last_modified_at timestamptz,
  raw_json jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qb_time_timesheets (
  qb_timesheet_id bigint primary key,
  qb_user_id bigint not null references public.qb_time_users (qb_user_id) on delete cascade,
  qb_jobcode_id bigint references public.qb_time_jobcodes (qb_jobcode_id) on delete set null,
  timesheet_date date not null,
  start_at timestamptz,
  end_at timestamptz,
  duration_seconds integer,
  state text,
  entry_type text,
  source text,
  notes text,
  customfields_json jsonb,
  raw_json jsonb not null default '{}'::jsonb,
  last_modified_at timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists qb_time_timesheets_qb_user_id_idx
  on public.qb_time_timesheets (qb_user_id);

create index if not exists qb_time_timesheets_qb_jobcode_id_idx
  on public.qb_time_timesheets (qb_jobcode_id);

create index if not exists qb_time_timesheets_timesheet_date_idx
  on public.qb_time_timesheets (timesheet_date desc);

create table if not exists public.integration_sync_runs (
  id uuid primary key,
  integration_target integration_target not null,
  sync_type text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  status integration_run_status not null default 'running',
  summary_json jsonb,
  error_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.legacy_time_projects (
  legacy_time_project_id uuid primary key,
  project_code text,
  name text not null,
  customer_name text,
  site_name text,
  site_address text,
  site_latitude numeric(9, 6),
  site_longitude numeric(9, 6),
  site_radius_meters integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_created_at timestamptz,
  source_updated_at timestamptz
);

create index if not exists idx_legacy_time_projects_project_code
  on public.legacy_time_projects (project_code);

create table if not exists public.profile_qb_time_mappings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  qb_user_id bigint not null references public.qb_time_users (qb_user_id) on delete cascade,
  match_source text not null,
  confidence_score integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, qb_user_id)
);

create table if not exists public.legacy_time_project_portal_mappings (
  id uuid primary key default gen_random_uuid(),
  legacy_time_project_id uuid not null references public.legacy_time_projects (legacy_time_project_id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  match_source text not null,
  confidence_score integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legacy_time_project_id, project_id)
);

create table if not exists public.project_qb_time_mappings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  qb_jobcode_id bigint not null references public.qb_time_jobcodes (qb_jobcode_id) on delete cascade,
  mapping_source text not null default 'manual',
  confidence_score integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, qb_jobcode_id)
);

create or replace function public.time_merge_normalize_name(input text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    lower(
      trim(
        regexp_replace(
          coalesce(input, ''),
          '^\s*[0-9]{4}-[0-9]{3,4}\s*-\s*',
          '',
          'g'
        )
      )
    ),
    '[^a-z0-9]+',
    ' ',
    'g'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists qb_time_users_set_updated_at on public.qb_time_users;
create trigger qb_time_users_set_updated_at
before update on public.qb_time_users
for each row execute function public.set_updated_at();

drop trigger if exists qb_time_jobcodes_set_updated_at on public.qb_time_jobcodes;
create trigger qb_time_jobcodes_set_updated_at
before update on public.qb_time_jobcodes
for each row execute function public.set_updated_at();

drop trigger if exists qb_time_timesheets_set_updated_at on public.qb_time_timesheets;
create trigger qb_time_timesheets_set_updated_at
before update on public.qb_time_timesheets
for each row execute function public.set_updated_at();

drop trigger if exists legacy_time_projects_set_updated_at on public.legacy_time_projects;
create trigger legacy_time_projects_set_updated_at
before update on public.legacy_time_projects
for each row execute function public.set_updated_at();

drop trigger if exists profile_qb_time_mappings_set_updated_at on public.profile_qb_time_mappings;
create trigger profile_qb_time_mappings_set_updated_at
before update on public.profile_qb_time_mappings
for each row execute function public.set_updated_at();

drop trigger if exists legacy_time_project_portal_mappings_set_updated_at on public.legacy_time_project_portal_mappings;
create trigger legacy_time_project_portal_mappings_set_updated_at
before update on public.legacy_time_project_portal_mappings
for each row execute function public.set_updated_at();

drop trigger if exists project_qb_time_mappings_set_updated_at on public.project_qb_time_mappings;
create trigger project_qb_time_mappings_set_updated_at
before update on public.project_qb_time_mappings
for each row execute function public.set_updated_at();

alter table public.qb_time_users enable row level security;
alter table public.qb_time_jobcodes enable row level security;
alter table public.qb_time_timesheets enable row level security;
alter table public.integration_sync_runs enable row level security;
alter table public.legacy_time_projects enable row level security;
alter table public.profile_qb_time_mappings enable row level security;
alter table public.legacy_time_project_portal_mappings enable row level security;
alter table public.project_qb_time_mappings enable row level security;

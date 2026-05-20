-- Revert checkpoint for the estimator AI feature set as of 2026-05-20.
-- This snapshot matches the org-scoped AI connection schema that supports
-- the estimator AI parser and import flow.

create table if not exists public.estimator_ai_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  label text not null,
  model text not null,
  endpoint text,
  encrypted_api_key text not null,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

alter table public.estimator_ai_connections enable row level security;

drop policy if exists "Estimator AI connections are readable by org members" on public.estimator_ai_connections;
drop policy if exists "Estimator AI connections are editable by org members" on public.estimator_ai_connections;

create policy "Estimator AI connections are readable by org members"
on public.estimator_ai_connections
for select
using (
  exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = estimator_ai_connections.organization_id
      and om.profile_id = auth.uid()
  )
);

create policy "Estimator AI connections are editable by org members"
on public.estimator_ai_connections
for all
using (
  exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = estimator_ai_connections.organization_id
      and om.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = estimator_ai_connections.organization_id
      and om.profile_id = auth.uid()
  )
);

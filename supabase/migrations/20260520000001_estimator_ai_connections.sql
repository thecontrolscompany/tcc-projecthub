create table if not exists public.estimator_ai_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  provider text not null,
  label text not null default '',
  model text not null default '',
  endpoint text not null default '',
  encrypted_api_key text not null,
  key_hint text not null default '',
  last_used_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimator_ai_connections_provider_check
    check (provider in ('openai', 'anthropic', 'gemini', 'xai', 'azure_openai')),
  constraint estimator_ai_connections_profile_provider_unique
    unique (organization_id, provider)
);

alter table public.estimator_ai_connections enable row level security;

drop policy if exists "Estimator AI connections owner read" on public.estimator_ai_connections;
create policy "Estimator AI connections owner read"
  on public.estimator_ai_connections
  for select
  using (
    exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = estimator_ai_connections.organization_id
        and membership.profile_id = auth.uid()
    )
  );

drop policy if exists "Estimator AI connections owner write" on public.estimator_ai_connections;
create policy "Estimator AI connections owner write"
  on public.estimator_ai_connections
  for all
  using (
    exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = estimator_ai_connections.organization_id
        and membership.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships membership
      where membership.organization_id = estimator_ai_connections.organization_id
        and membership.profile_id = auth.uid()
    )
  );

create index if not exists estimator_ai_connections_profile_idx
  on public.estimator_ai_connections (organization_id, provider);

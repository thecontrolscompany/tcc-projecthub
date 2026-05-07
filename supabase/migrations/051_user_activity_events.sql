create table if not exists public.user_activity_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  email text,
  event_type text not null check (
    event_type in (
      'login_success',
      'login_failed',
      'password_changed',
      'password_reset_requested',
      'portal_user_created',
      'portal_access_enabled',
      'portal_access_disabled'
    )
  ),
  project_id uuid references public.projects(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_activity_events_profile_created
  on public.user_activity_events(profile_id, created_at desc);

create index if not exists idx_user_activity_events_email_created
  on public.user_activity_events(lower(email), created_at desc);

create index if not exists idx_user_activity_events_type_created
  on public.user_activity_events(event_type, created_at desc);

alter table public.user_activity_events enable row level security;

drop policy if exists "Admin reads user activity events" on public.user_activity_events;
create policy "Admin reads user activity events"
  on public.user_activity_events for select
  using (public.current_user_role() = 'admin');

drop policy if exists "Ops reads user activity events" on public.user_activity_events;
create policy "Ops reads user activity events"
  on public.user_activity_events for select
  using (public.current_user_role() = 'ops_manager');

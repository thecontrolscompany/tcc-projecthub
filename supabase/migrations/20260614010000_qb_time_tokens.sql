-- Server-only OAuth token storage for the QuickBooks Time integration.
-- The service-role client is the only application path that accesses this table.

create table if not exists public.qb_time_tokens (
  realm_id text primary key,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.qb_time_tokens enable row level security;

revoke all on table public.qb_time_tokens from anon, authenticated;

comment on table public.qb_time_tokens is 'Server-only QuickBooks Time OAuth tokens. Never expose token columns to browser clients.';
comment on column public.qb_time_tokens.realm_id is 'QuickBooks Time company_id returned by the OAuth grant endpoint.';

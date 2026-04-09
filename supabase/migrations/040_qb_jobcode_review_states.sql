create table if not exists public.qb_time_jobcode_review_states (
  qb_jobcode_id bigint primary key references public.qb_time_jobcodes (qb_jobcode_id) on delete cascade,
  status text not null check (status in ('ignored')),
  ignored_by_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists qb_time_jobcode_review_states_set_updated_at on public.qb_time_jobcode_review_states;
create trigger qb_time_jobcode_review_states_set_updated_at
before update on public.qb_time_jobcode_review_states
for each row execute function public.set_updated_at();

alter table public.qb_time_jobcode_review_states enable row level security;

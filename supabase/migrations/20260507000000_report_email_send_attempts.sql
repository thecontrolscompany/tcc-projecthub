create table if not exists public.report_email_send_attempts (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  report_type text not null,
  project_id uuid references public.projects(id) on delete set null,
  report_id uuid,
  status text not null check (status in ('pending', 'sent', 'failed')),
  graph_error jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_report_email_send_attempts_created
  on public.report_email_send_attempts(created_at desc);

create index if not exists idx_report_email_send_attempts_project_created
  on public.report_email_send_attempts(project_id, created_at desc);

create index if not exists idx_report_email_send_attempts_recipient_created
  on public.report_email_send_attempts(lower(recipient_email), created_at desc);

alter table public.report_email_send_attempts enable row level security;

drop policy if exists "Admins read report email send attempts" on public.report_email_send_attempts;
create policy "Admins read report email send attempts"
  on public.report_email_send_attempts for select
  using (public.current_user_role() = 'admin');

drop policy if exists "Ops read report email send attempts" on public.report_email_send_attempts;
create policy "Ops read report email send attempts"
  on public.report_email_send_attempts for select
  using (public.current_user_role() = 'ops_manager');

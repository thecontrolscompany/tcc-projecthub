-- Migration 043: project-specific report packets

create table if not exists project_report_packets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  report_type text not null,
  packet_date date not null,
  title text not null,
  body jsonb not null default '{}'::jsonb,
  summary_markdown text,
  sharepoint_item_id text,
  sharepoint_drive_id text,
  sharepoint_web_url text,
  created_by_profile_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_project_report_packets_unique
  on project_report_packets(project_id, report_type, packet_date);

create index if not exists idx_project_report_packets_project_type
  on project_report_packets(project_id, report_type, packet_date desc);

-- TCC ProjectHub — Time Tracking Schema
-- Migration 030: Add time tracking tables for homegrown QB Time replacement

-- ============================================================
-- TIME ENTRIES
-- ============================================================
create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  work_date date not null,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  notes text,
  system_category text,  -- e.g., "VAV", "AHU", "FCU", "Electrical", etc. (ties to estimating assemblies)
  billable boolean default true,
  approved boolean default false,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(employee_id, project_id, work_date)  -- one entry per employee per project per day
);

-- ============================================================
-- TIME APPROVALS (weekly batches)
-- ============================================================
create table if not exists time_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  week_of date not null,  -- Monday of the week
  approved_by uuid not null references profiles(id),
  approved_at timestamptz default now(),
  notes text,
  unique(project_id, week_of)
);

-- Update time_entries to reference approvals
alter table time_entries add column if not exists approval_id uuid references time_approvals(id);

-- ============================================================
-- VIEWS FOR REPORTING
-- ============================================================

-- Weekly time summary by project
create or replace view weekly_time_summary as
select
  te.project_id,
  p.name as project_name,
  c.name as customer_name,
  date_trunc('week', te.work_date) as week_of,
  count(distinct te.employee_id) as num_employees,
  sum(te.hours) as total_hours,
  count(*) as num_entries,
  bool_and(te.approved) as fully_approved
from time_entries te
join projects p on p.id = te.project_id
left join customers c on c.id = p.customer_id
group by te.project_id, p.name, c.name, date_trunc('week', te.work_date);

-- Time entries with employee details
create or replace view time_entries_detailed as
select
  te.*,
  p.name as project_name,
  c.name as customer_name,
  emp.full_name as employee_name,
  emp.email as employee_email,
  approver.full_name as approved_by_name
from time_entries te
join projects p on p.id = te.project_id
left join customers c on c.id = p.customer_id
join profiles emp on emp.id = te.employee_id
left join profiles approver on approver.id = te.approved_by;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table time_entries enable row level security;
alter table time_approvals enable row level security;

-- TIME ENTRIES
create policy "Employees create own time entries" on time_entries for insert
  with check (employee_id = auth.uid());

create policy "Employees read own time entries" on time_entries for select
  using (employee_id = auth.uid());

create policy "Employees update own unapproved entries" on time_entries for update
  using (employee_id = auth.uid() and approved = false);

create policy "PMs read time entries for own projects" on time_entries for select
  using (
    current_user_role() = 'pm' and
    exists (select 1 from projects pr where pr.id = time_entries.project_id and pr.pm_id = auth.uid())
  );

create policy "PMs approve time entries for own projects" on time_entries for update
  using (
    current_user_role() = 'pm' and
    exists (select 1 from projects pr where pr.id = time_entries.project_id and pr.pm_id = auth.uid())
  );

create policy "Admin full access to time entries" on time_entries for all
  using (current_user_role() = 'admin');

-- TIME APPROVALS
create policy "PMs manage approvals for own projects" on time_approvals for all
  using (
    current_user_role() = 'pm' and
    exists (select 1 from projects pr where pr.id = time_approvals.project_id and pr.pm_id = auth.uid())
  );

create policy "Admin full access to time approvals" on time_approvals for all
  using (current_user_role() = 'admin');

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
create index if not exists idx_time_entries_employee_date on time_entries(employee_id, work_date);
create index if not exists idx_time_entries_project_date on time_entries(project_id, work_date);
create index if not exists idx_time_entries_approved on time_entries(approved);
create index if not exists idx_time_approvals_project_week on time_approvals(project_id, week_of);

-- ============================================================
-- FUNCTIONS FOR TIME TRACKING
-- ============================================================

-- Function to get current week's time entries for a project
create or replace function get_weekly_time_entries(project_uuid uuid, week_start date default null)
returns table (
  id uuid,
  employee_name text,
  work_date date,
  hours numeric,
  system_category text,
  notes text,
  approved boolean
) language sql security definer as $$
  select
    te.id,
    pr.full_name as employee_name,
    te.work_date,
    te.hours,
    te.system_category,
    te.notes,
    te.approved
  from time_entries te
  join profiles pr on pr.id = te.employee_id
  where te.project_id = project_uuid
    and date_trunc('week', te.work_date) = coalesce(week_start, date_trunc('week', current_date))
  order by te.work_date, pr.full_name;
$$;

-- Function to approve weekly time entries
create or replace function approve_weekly_time(
  project_uuid uuid,
  week_start date,
  approver_uuid uuid default auth.uid()
) returns void language plpgsql security definer as $$
declare
  approval_record_id uuid;
begin
  -- Create approval record
  insert into time_approvals (project_id, week_of, approved_by)
  values (project_uuid, week_start, approver_uuid)
  on conflict (project_id, week_of) do update set
    approved_by = approver_uuid,
    approved_at = now(),
    notes = 'Re-approved'
  returning id into approval_record_id;

  -- Update time entries
  update time_entries
  set approved = true,
      approved_by = approver_uuid,
      approved_at = now(),
      approval_id = approval_record_id
  where project_id = project_uuid
    and date_trunc('week', work_date) = week_start
    and approved = false;
end;
$$;
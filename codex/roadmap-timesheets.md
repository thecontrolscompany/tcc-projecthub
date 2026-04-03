# Roadmap — Timesheet / Labor Tracking

## Core concept

Field crew and PMs log hours per project per day.
Feeds labor cost reporting (actual vs estimated) and eventually syncs to QBO payroll.

## Data model

```sql
CREATE TABLE timesheets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES profiles(id),
  project_id    uuid NOT NULL REFERENCES projects(id),
  work_date     date NOT NULL,
  hours         numeric(5,2) NOT NULL,
  work_type     text DEFAULT 'field',  -- field | programming | commissioning | travel
  notes         text,
  approved_by   uuid REFERENCES profiles(id),
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, project_id, work_date, work_type)
);
```

## Entry points

1. **From daily crew log** — when PM submits weekly update with crew log filled in,
   offer "Create timesheet entries from crew log" — auto-creates one entry per
   crew member per day from the men/hours fields (approximated equally across crew).
   
2. **Direct timesheet entry** — `/timesheets` page where any authenticated user
   can log their own hours by project and date.

3. **Admin timesheet management** — admin can view, edit, approve all timesheets.
   Filterable by PM, project, date range.

## Reporting

- Hours by project (actual vs budgeted — see budget/actual roadmap)
- Hours by person (workload distribution)
- Hours by work type (field vs programming vs commissioning)

## QBO dependency: Partial
- **Independent now**: log hours, report hours, approve timesheets
- **QBO unlocks**: sync approved hours to QBO payroll/time tracking,
  pull labor cost rates to calculate actual labor cost per project

## Priority: Medium
## Suggested task number: 056

# Roadmap — Scheduling / Crew Calendar

## Core concept

Visual calendar showing who is working where on what days.
Answers: "Where is Dakota next week?" and "Which projects have no crew scheduled?"
Not a full project schedule (no Gantt/CPM) — just crew assignment by week.

## Data model

```sql
CREATE TABLE crew_schedules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id    uuid REFERENCES profiles(id),      -- internal crew
  pm_dir_id     uuid REFERENCES pm_directory(id),  -- external crew
  scheduled_date date NOT NULL,
  notes         text,
  created_by    uuid REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

One row per person per day on a project.

## UI

### Admin / Ops view
- Week-view calendar (Mon–Sat, matching crew log days)
- Columns = days, rows = people (grouped by project)
- Color-coded by project
- Click a day cell to assign someone to a project
- Conflict indicator if same person is on two projects same day

### PM view
- Their project only — shows which crew members are scheduled each day
- Read-only

### Mobile-friendly
PMs and field leads check this on their phones.
Simple card-per-day layout on mobile (same pattern as crew log mobile fix).

## Integration with weekly report
When a PM fills out the crew log (Daily Construction Report), pre-populate
the day rows from the schedule — PM just confirms/adjusts actual men and hours.

## QBO dependency: None
Scheduling is independent. Labor cost tracking (timesheet → QBO) is a separate feature.

## Priority: Medium
## Suggested task number: 055

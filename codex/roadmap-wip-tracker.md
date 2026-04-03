# Roadmap — WIP (Work In Progress) Tracker

## Core concept

Per-project task tracking focused on **what's blocked and who owns it**.
Not a generic task list — structured around how controls jobs actually execute:
by system (AHU, VAV, Pumps, etc.) with required blocker documentation.

## Where it lives

New tab inside each project: **Overview | WIP | Materials | Documents**

---

## Data model

### `wip_items` table
```sql
id              uuid PK
project_id      uuid FK projects
system_area     text        -- e.g. "AHU-1", "VAV Group", "Network"
task            text        -- e.g. "Terminate wiring"
status          enum        -- not_started | in_progress | blocked | in_review | complete
assigned_to     uuid FK profiles (or text for external)
responsible_co  text        -- TCC | Mechanical | Controls Vendor | GC
blocker         text        -- required when status = blocked
priority        enum        -- low | medium | high
due_date        date
notes           text
created_at      timestamptz
updated_at      timestamptz
```

---

## UI

### Summary cards (top of WIP tab)
- % Complete (complete / total items)
- # Blocked 🚨 (auto-highlight red if > 0)
- # Not Started
- # In Progress

### Hot List section
Auto-filter showing only: `status = blocked AND priority = high`
This is the weekly meeting driver and "who do I call today" list.

### Main table
Columns: System/Area | Task | Status | Assigned To | Responsible Co. | Blocker | Priority | Due Date | Notes

Filters:
- Show only Blocked
- Show only High Priority
- Filter by System/Area
- Filter by Assigned To / Responsible Company

---

## Status options (keep tight — no more)
- Not Started
- In Progress
- Blocked 🚨
- In Review
- Complete

---

## Future integration: Auto-generate WIP from estimate
When a system is added to an estimate, auto-create standard WIP tasks:
- Install
- Wire
- Terminate
- Program
- Graphics
- Checkout

This turns the estimating tool into an execution tracker.

---

## Future integration: Auto-blockers from Materials tab
When BOM shows `qty_received < qty_required` for a system,
auto-flag associated WIP tasks as Blocked with reason:
`"Waiting on [item] (X missing)"`

---

## Priority: Medium
## Depends on: None (can be built standalone)
## Suggested task number: 048

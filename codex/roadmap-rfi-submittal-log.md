# Roadmap — RFI & Submittal Log

## Core concept

Two standard construction document workflows that every controls job touches:

**RFI (Request for Information)** — a question sent to the engineer/GC asking for
clarification on drawings, specs, or field conditions. Must be tracked to closure.

**Submittal** — product data, shop drawings, or O&M manuals sent to the engineer/GC
for approval before installation. Controls jobs submit controller cut sheets,
valve schedules, sequence of operations, etc.

Both follow the same lifecycle: Created → Submitted → Under Review → Responded/Approved → Closed

## Data model

```sql
CREATE TABLE rfis (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rfi_number      text NOT NULL,           -- e.g. RFI-001
  subject         text NOT NULL,
  description     text,
  submitted_to    text,                    -- GC or engineer name
  submitted_date  date,
  due_date        date,
  responded_date  date,
  response        text,
  status          text NOT NULL DEFAULT 'open',  -- open | under_review | responded | closed
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE submittals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  submittal_number text NOT NULL,          -- e.g. SUB-003
  title           text NOT NULL,
  spec_section    text,                    -- e.g. "23 09 23 - BAS"
  submitted_to    text,
  submitted_date  date,
  due_date        date,
  returned_date   date,
  status          text NOT NULL DEFAULT 'pending',
  -- pending | submitted | under_review | approved | approved_as_noted | revise_resubmit | rejected
  revision        integer NOT NULL DEFAULT 1,
  notes           text,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

## UI

Both live as tabs inside the project modal (alongside WIP and Materials).
- Table view with status color coding
- Auto-increment numbering (RFI-001, RFI-002...)
- Overdue indicator (due_date < today AND status not closed)
- Admin can add/edit, PM can view
- "Open Items" count on project card in admin view

## Document attachments
Phase 2: attach files (via SharePoint upload, already wired) to RFIs and submittals.

## QBO dependency: None

## Priority: Medium — standard on every job, PMs will use this immediately
## Suggested task number: 057

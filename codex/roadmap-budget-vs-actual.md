# Roadmap — Budget vs Actual

## Core concept

Track estimated cost vs actual cost per project across three categories:
- **Labor** (estimated hours × rate vs actual hours × rate)
- **Materials** (BOM estimated value vs actual received/installed cost)
- **Subcontractors** (budgeted sub cost vs actual invoiced)

Answers: "Are we making money on this job?"

## What QBO unlocks

This feature is split cleanly into two phases:

### Phase 1 — Independent of QBO (build now)
- Labor budget: pull estimated labor hours from estimate (manual entry for now)
- Labor actual: pull from timesheets (task 056)
- Material budget: sum of `bom_items.qty_required × unit_cost` (add unit_cost field to bom_items)
- Material actual: sum of receipts (already tracked in material_receipts)
- Dashboard per project: Estimated vs Actual side by side, variance

### Phase 2 — QBO unlocks
- Pull actual labor cost with real rates from QBO payroll
- Pull actual material invoices from QBO bills (vendor bills)
- Pull subcontractor invoices from QBO
- Pull contract value (Estimated Income) from QBO instead of manual entry
- True job costing: revenue − labor − material − sub = gross profit per job

## Data model additions (Phase 1)

```sql
-- Add unit cost to BOM for budget calculation
ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS unit_cost numeric(10,2);

-- Budget lines per project (labor + sub estimates)
CREATE TABLE project_budget (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category      text NOT NULL,  -- 'labor' | 'material' | 'subcontractor' | 'other'
  description   text,
  budgeted_cost numeric(12,2) NOT NULL DEFAULT 0,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

## UI

New "Budget" tab in the project modal showing:

| Category | Budgeted | Actual | Variance | % Used |
|---|---|---|---|---|
| Labor | $18,500 | $14,200 | +$4,300 | 77% |
| Materials | $42,000 | $38,100 | +$3,900 | 91% |
| Subcontractors | $5,000 | $0 | +$5,000 | 0% |
| **Total** | **$65,500** | **$52,300** | **+$13,200** | **80%** |

Traffic light coloring: green < 90%, yellow 90–100%, red > 100%.

Admin analytics page: aggregate job costing across all active projects.

## QBO integration spec (for when ready)
- `GET /api/qbo/job-costs?projectId=xxx` — pulls bills + payroll by class/customer from QBO
- Map QBO Customer/Job → `projects.job_number`
- Map QBO Class → labor/material/sub categories

## Priority: Medium-High (depends on timesheets for labor actual)
## QBO dependency: Phase 1 independent, Phase 2 requires QBO
## Suggested task number: 058

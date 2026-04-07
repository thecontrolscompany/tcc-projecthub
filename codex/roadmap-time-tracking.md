# TCC Time Tracking System — Vision & Phase 0

## Problem

**QuickBooks Time is legacy acquisition that doesn't fit TCC's workflow:**
- Originally TSheets (founded 2006, acquired by Intuit 2018)
- Loose integration via REST API (not deeply embedded)
- Clunky UI, minimal customization
- No connection to TCC's estimating structure (VAV, AHU, FCU, systems)
- Manual data entry for weekly reports (# men, hours, systems)
- Cannot track actual vs estimated labor per system

**Current state:**
- Time entries live in QB Time
- QB Time syncs to QB Online via API
- Weekly report requires manual PM data entry
- No feedback loop: estimates don't improve from actuals

## Vision

**Build a homegrown time tracking system that:**
1. Captures time tied to TCC's system categories (VAV, AHU, FCU, Electrical, Controls, etc.)
2. Auto-generates weekly reports: # men, hours, breakdown by system
3. Feeds actuals back into estimate feedback loop
4. Replaces QB Time entirely (3-phase plan)
5. Integrates to QB Online via API when needed

**Key insight:** QB Time integration is just API calls. Building a replacement is straightforward since the integration is loosely coupled, not deeply embedded.

---

## Phase 0: MVP Skeleton

### Scope
Standalone **time entry + weekly reporting** system with local authentication and approval workflow.

### Features
1. **Time Entry Form**
   - Date, hours (quarter-hour increments)
   - Project selection (from TCC projects)
   - System category dropdown (VAV, AHU, FCU, Electrical, Controls, Plumbing, Other)
   - Optional notes field
   - Save to local database

2. **Weekly Report Dashboard**
   - Select project + week
   - Auto-generate summary: # employees, total hours, breakdown by system, status (pending/approved)
   - List time entries for that week
   - PM approval button (locks entries after approval)

3. **Approval Workflow**
   - PM can approve/reject weekly batches per project
   - Timestamps and audit trail
   - Lock entries after approval

4. **Minimal Authentication**
   - Reuse existing TCC auth (if available)
   - Or simple email/password for standalone testing

### Database Schema
```sql
-- Time entries (tied to system categories)
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  work_date DATE NOT NULL,
  hours DECIMAL(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  system_category TEXT, -- "VAV", "AHU", "FCU", "Electrical", etc.
  notes TEXT,
  billable BOOLEAN DEFAULT true,
  approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, project_id, work_date)
);

-- Weekly approval batches
CREATE TABLE time_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  week_of DATE NOT NULL,
  approved_by UUID NOT NULL REFERENCES profiles(id),
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(project_id, week_of)
);

-- View for weekly reporting
CREATE VIEW weekly_time_summary AS
SELECT 
  project_id,
  date_trunc('week', work_date)::DATE as week_of,
  COUNT(DISTINCT employee_id) as num_employees,
  SUM(hours) as total_hours,
  COUNT(*) as num_entries,
  BOOL_AND(approved) as fully_approved
FROM time_entries 
GROUP BY project_id, date_trunc('week', work_date);
```

### Stack
- **Frontend:** Next.js 16 (React) + TypeScript
- **Database:** Supabase (PostgreSQL) — standalone instance for now
- **Auth:** Supabase or simple email/password
- **Hosting:** Vercel (stands alone at time.thecontrolscompany.com)
- **API Routes:** Next.js API routes (TypeScript)

### API Routes (MVP)
```
POST   /api/time/entries              — Create/update time entry
GET    /api/time/entries              — List entries (by project, week, employee)
POST   /api/time/approve              — Approve weekly batch
GET    /api/time/weekly-report        — Get weekly summary for dashboard
```

### UI Routes
```
/                    — Login/redirect
/dashboard           — Weekly report dashboard + time entry form
/approvals           — PM approval interface
/history             — View past entries (read-only)
```

### Components
- `TimeEntryForm.tsx` — Entry form with project/date/hours/system category
- `WeeklyTimeReport.tsx` — Summary cards + entries list + approve button
- `TimeApprovalsPage.tsx` — PM view to approve pending weeks
- `TimeHistoryPage.tsx` — Searchable historical entries

### Success Criteria
✅ User can enter time with system category  
✅ Weekly report auto-generates # men + hours by system  
✅ PM can approve weekly batches  
✅ Entries cannot be edited after approval (immutable)  
✅ Audit trail (created_at, approved_at, approved_by)  

---

## Phase 1: QuickBooks Integration

**Goal:** Sync time to QB Online as TimeActivity objects (keep QB as financial record).

- Read-only initially: push approved time to QB Online
- Bidirectional later: pull QB employee/project data
- Skip QB Time entirely after validation

---

## Phase 2: Actuals Engine

**Goal:** Close the estimate → actuals loop.

- Tie time entries to estimate line items (assemblies)
- Show actual labor cost vs estimated per system
- Feedback dashboard: where estimates were wrong, where we underestimated
- Improve future estimates based on actuals

---

## Deployment Strategy

### Phase 0: Standalone
- **Domain:** time.thecontrolscompany.com
- **Database:** Separate Supabase project (or same project, separate schema)
- **Auth:** Local or shared with main portal
- **Code:** Separate Next.js app repo (or monorepo)
- **Why:** Don't risk breaking main portal during development/testing

### Phase 1+: Integration
- Merge into main TCC ProjectHub
- Share Supabase database
- Share Vercel deployment
- Single auth system
- Unified navigation

---

## Technical Details

### Environment Variables
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=time.thecontrolscompany.com
```

### Row-Level Security (RLS)
- Employees see only own time entries
- PMs see time entries for their projects
- Admins see all

### System Categories (Enum)
```
VAV Systems
Air Handling Units (AHU)
Fan Coil Units (FCU)
Electrical
Controls
Plumbing
HVAC Service
Other
```

### Weekly Calculation
- Week of = Monday of the week
- "# men" = COUNT(DISTINCT employee_id) for that week
- "Hours" = SUM(hours) for that week
- Breakdown by system = GROUP BY system_category

---

## Not In Scope (Phase 0)

❌ Mobile app (web-first)  
❌ GPS tracking  
❌ PTO/vacation tracking  
❌ Overtime rules  
❌ Payroll compliance (DCAA, etc.)  
❌ QB Time data import (manual migration later)  
❌ Historical QB Time syncing  
❌ Email notifications  

---

## How to Verify This Works

1. **Skeleton:** Create repo, Supabase schema, login page
2. **Time Entry:** Add form, POST /api/time/entries, save to DB
3. **Weekly Report:** Query time_entries for week, display summary
4. **Approval:** PM approve button, lock entries
5. **Test:** Enter 3 time entries across 2 employees, verify weekly report shows "2 men, X hours"

---

## Success Definition

After Phase 0:
- Guys can enter time without QB Time
- Weekly report auto-generates with system breakdown
- PM can approve weekly batches
- Ready to test for 2-4 weeks before QB integration
- No risk to main TCC portal

---

## Next Steps

1. Create time tracking migration (030_time_tracking.sql)
2. Scaffold Next.js app or new folder in existing repo
3. Build TimeEntryForm component
4. Build WeeklyTimeReport component
5. Test with 2-3 users for 1 week
6. Then plan Phase 1 (QB sync)

---

**Priority:** High (closes estimate → actuals loop)  
**Suggested Sprint:** 1-2 weeks for Phase 0 skeleton  
**Owner:** Timothy (vision), Developer (implementation)  

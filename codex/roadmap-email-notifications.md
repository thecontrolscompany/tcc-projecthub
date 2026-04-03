# Roadmap — Email Notifications

## Core concept

Automated emails triggered by portal events. No manual action required from admin.
Uses Microsoft Graph API (already wired) to send from Tim@controlsco.net via Outlook,
or optionally a transactional email provider (Resend, SendGrid) for volume.

## Trigger events

| Event | Recipients | Content |
|---|---|---|
| PM submits weekly update | Admin, Ops Managers | Project name, PM name, % complete, any blockers |
| Weekly update has blockers | Admin only | Project name, blocker text, direct link |
| WIP item status → blocked | Admin, Ops Manager | Project, system area, task, blocker |
| Billing period rolls forward | All PMs with active projects | Their project list, current % complete, billing due reminder |
| Customer feedback submitted | Admin | Project name, message preview |
| Quote request submitted | Admin | Company, contact, description |
| Quote status → won | Admin | Quote summary, "Convert to project" link |
| BOM item still missing 7 days before due date | PM assigned to project | Item name, qty outstanding |

## Implementation approach

**Phase 1 — event-driven from API routes**
Each API route that triggers a notification calls a shared `sendNotification()` helper
after the DB write succeeds. Fire-and-forget (don't block the response on email).

**Phase 2 — scheduled digest**
Weekly summary email to Tim every Monday: all projects, % complete, blocked items,
upcoming billing. Uses a Vercel cron job (`vercel.json` cron config).

## Notification preferences (per user)
Store in `profiles` table:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_weekly_updates boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_blockers boolean DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notify_billing boolean DEFAULT true;
```
Users can toggle in a `/settings` page (future).

## QBO dependency: None
Email notifications are fully independent of QBO.

## Priority: High — biggest daily-use gap
## Suggested task number: 054

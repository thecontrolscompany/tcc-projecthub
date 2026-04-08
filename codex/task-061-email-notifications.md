# Task 061 — Email Notifications: Customer Alert on Weekly Update Submission

## Context

When a PM submits a weekly update, customers have no way of knowing unless they
happen to log into the portal. This kills adoption. This task sends a notification
email to all customer contacts on the project whenever a weekly update is submitted
(not on draft saves — submitted only).

Email service: **Resend** (resend.com). Install the npm package and use a
RESEND_API_KEY environment variable. Do not use SendGrid, nodemailer, or any other
library.

---

## 1. Install Resend

```bash
npm install resend
```

---

## 2. Environment variable

Add to `.env.local.example`:
```
RESEND_API_KEY=re_...
```

The actual key will be provided separately. For now the code should read from
`process.env.RESEND_API_KEY` and skip sending (log a warning) if it is not set.

---

## 3. Email helper — `src/lib/email/notifications.ts`

Create this file:

```ts
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS = "updates@controlsco.net";
const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://internal.thecontrolscompany.com";

export async function sendWeeklyUpdateNotification({
  projectName,
  weekOf,
  notes,
  recipientEmails,
}: {
  projectName: string;
  weekOf: string;
  notes: string | null;
  recipientEmails: string[];
}): Promise<void> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping notification");
    return;
  }

  if (recipientEmails.length === 0) return;

  const weekLabel = new Date(weekOf).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const snippet = notes ? notes.slice(0, 280).trim() + (notes.length > 280 ? "…" : "") : null;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #017a6f; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <p style="margin: 0; color: rgba(255,255,255,0.8); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">
          The Controls Company, LLC
        </p>
        <h1 style="margin: 4px 0 0; color: #ffffff; font-size: 22px; font-weight: 700;">
          New Project Update
        </h1>
      </div>
      <div style="background: #f0faf9; padding: 28px 32px; border-radius: 0 0 12px 12px; border: 1px solid #b2dfdb; border-top: none;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #475569; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">
          Project
        </p>
        <p style="margin: 0 0 20px; font-size: 20px; font-weight: 700; color: #017a6f;">
          ${projectName}
        </p>
        <p style="margin: 0 0 4px; font-size: 13px; color: #64748b;">
          Week of <strong>${weekLabel}</strong>
        </p>
        ${snippet ? `
        <div style="margin: 16px 0; padding: 16px; background: #ffffff; border-left: 3px solid #20b2aa; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">${snippet}</p>
        </div>
        ` : ""}
        <a href="${PORTAL_URL}/customer"
           style="display: inline-block; margin-top: 20px; padding: 12px 28px; background: #017a6f; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 999px;">
          View Full Update →
        </a>
        <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8;">
          You received this because you are listed as a contact on this project.
          Visit your <a href="${PORTAL_URL}/customer" style="color: #017a6f;">project portal</a> to view all updates and billing history.
        </p>
      </div>
    </div>
  `;

  const text = `New update posted for ${projectName} — week of ${weekLabel}.\n\n${snippet ?? ""}\n\nView at: ${PORTAL_URL}/customer`;

  // Send to each recipient individually so one bad address doesn't block others
  await Promise.allSettled(
    recipientEmails.map((email) =>
      resend!.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: `Project update: ${projectName} — week of ${weekLabel}`,
        html,
        text,
      })
    )
  );
}
```

---

## 4. Hook into weekly update route — `src/app/api/pm/weekly-update/route.ts`

Import the notification helper at the top:

```ts
import { sendWeeklyUpdateNotification } from "@/lib/email/notifications";
```

### Where to fire the notification

The notification should fire when a weekly update is **newly submitted** (status
becomes "submitted" for the first time). It should NOT fire on draft saves or on
subsequent edits to an already-submitted update.

In the `POST` handler, after the successful `insert` + `applyProjectSideEffects`
call (around line 275), add:

```ts
// Fire email notification for new submissions (non-blocking)
if (normalized.value.status === "submitted") {
  void notifyCustomersOfUpdate({
    admin: authz.admin,
    projectId: normalized.value.projectId,
    weekOf: normalized.value.weekOf,
    notes: normalized.value.notes,
  });
}
```

In the `PATCH` handler, the notification should fire when a **draft is being
promoted to submitted** (i.e., `existing.status === "draft"` and
`normalized.value.status === "submitted"`). After the successful update + side
effects (around line 378), add:

```ts
// Notify on draft → submitted promotion only
if (existing.status === "draft" && normalized.value.status === "submitted") {
  void notifyCustomersOfUpdate({
    admin: authz.admin,
    projectId: normalized.value.projectId,
    weekOf: normalized.value.weekOf,
    notes: normalized.value.notes,
  });
}
```

### The helper function

Add `notifyCustomersOfUpdate` in the same file, after the existing helper functions
and before `export async function POST`:

```ts
async function notifyCustomersOfUpdate({
  admin,
  projectId,
  weekOf,
  notes,
}: {
  admin: ReturnType<typeof adminClient>;
  projectId: string;
  weekOf: string;
  notes: string | null;
}) {
  try {
    // Fetch project name
    const { data: project } = await admin
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();

    if (!project) return;

    // Fetch customer contact emails for this project
    const { data: contacts } = await admin
      .from("project_customer_contacts")
      .select("profile:profiles(email)")
      .eq("project_id", projectId)
      .eq("portal_access", true);

    const emails = (contacts ?? [])
      .map((c) => {
        const profile = Array.isArray(c.profile) ? c.profile[0] : c.profile;
        return profile?.email ?? null;
      })
      .filter((e): e is string => Boolean(e));

    if (emails.length === 0) return;

    await sendWeeklyUpdateNotification({
      projectName: project.name,
      weekOf,
      notes,
      recipientEmails: emails,
    });
  } catch (err) {
    // Never fail the main request because of notification errors
    console.error("[notify] Failed to send weekly update notification:", err);
  }
}
```

---

## 5. Add `NEXT_PUBLIC_APP_URL` to env example

In `.env.local.example`, add:
```
NEXT_PUBLIC_APP_URL=https://internal.thecontrolscompany.com
```

---

## Files to change

| File | What changes |
|------|-------------|
| `package.json` | Add `resend` dependency (via npm install) |
| `.env.local.example` | Add RESEND_API_KEY and NEXT_PUBLIC_APP_URL |
| `src/lib/email/notifications.ts` | New — email helper using Resend |
| `src/app/api/pm/weekly-update/route.ts` | Import notification, add notifyCustomersOfUpdate helper, fire on new submissions |

---

## Important behaviors

- **Never block the main request** — all notification logic is wrapped in try/catch
  and called with `void` (fire-and-forget)
- **Draft saves do NOT notify** — only status === "submitted" triggers an email
- **Edit to already-submitted update does NOT re-notify** — only draft→submitted promotion
- **Missing API key** — logs a warning and returns without error; build still passes
- **Bad recipient address** — `Promise.allSettled` means one bad address doesn't stop others

---

## Acceptance criteria

- [ ] `npm run build` passes clean
- [ ] `RESEND_API_KEY` not set → no crash, just a console warning
- [ ] Submitting a weekly update (POST with status=submitted) triggers notification
- [ ] Promoting a draft to submitted (PATCH with existing.status=draft → submitted) triggers notification
- [ ] Saving a draft does NOT trigger notification
- [ ] Editing an already-submitted update does NOT trigger notification
- [ ] Email renders with project name, week of, notes snippet, and portal link

## Commit and push

Commit message: `Email notification to customers on weekly update submission`
Push to main.

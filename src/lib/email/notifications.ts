import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS = "updates@controlsco.net";
const PORTAL_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://internal.thecontrolscompany.com";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function summarize(value: string, maxLength = 320) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}...`;
}

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
    console.warn("[email] RESEND_API_KEY not set - skipping notification");
    return;
  }

  if (recipientEmails.length === 0) return;

  const weekLabel = new Date(weekOf).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  const snippet = notes ? notes.slice(0, 280).trim() + (notes.length > 280 ? "..." : "") : null;

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
          View Full Update ->
        </a>
        <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8;">
          You received this because you are listed as a contact on this project.
          Visit your <a href="${PORTAL_URL}/customer" style="color: #017a6f;">project portal</a> to view all updates and billing history.
        </p>
      </div>
    </div>
  `;

  const text = `New update posted for ${projectName} - week of ${weekLabel}.\n\n${snippet ?? ""}\n\nView at: ${PORTAL_URL}/customer`;

  await Promise.allSettled(
    recipientEmails.map((email) =>
      resend!.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: `Project update: ${projectName} - week of ${weekLabel}`,
        html,
        text,
      })
    )
  );
}

export async function sendCustomerFeedbackNotification({
  projectName,
  customerEmail,
  message,
  recipientEmails,
}: {
  projectName: string;
  customerEmail: string | null;
  message: string;
  recipientEmails: string[];
}): Promise<void> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set - skipping customer feedback notification");
    return;
  }

  if (recipientEmails.length === 0) return;

  const messageSnippet = summarize(message);
  const safeProjectName = escapeHtml(projectName);
  const safeCustomerEmail = customerEmail ? escapeHtml(customerEmail) : "Unknown customer";
  const safeMessage = escapeHtml(messageSnippet);
  const reviewUrl = `${PORTAL_URL}/admin`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #017a6f; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <p style="margin: 0; color: rgba(255,255,255,0.82); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">
          TCC ProjectHub
        </p>
        <h1 style="margin: 4px 0 0; color: #ffffff; font-size: 22px; font-weight: 700;">
          New Customer Feedback
        </h1>
      </div>
      <div style="background: #f0faf9; padding: 28px 32px; border-radius: 0 0 12px 12px; border: 1px solid #b2dfdb; border-top: none;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #475569; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">
          Project
        </p>
        <p style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #017a6f;">
          ${safeProjectName}
        </p>
        <p style="margin: 0 0 6px; font-size: 14px; color: #334155;">
          <strong>From:</strong> ${safeCustomerEmail}
        </p>
        <div style="margin: 16px 0; padding: 16px; background: #ffffff; border-left: 3px solid #20b2aa; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">${safeMessage}</p>
        </div>
        <a href="${reviewUrl}"
           style="display: inline-block; margin-top: 12px; padding: 12px 28px; background: #017a6f; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 999px;">
          Review Feedback ->
        </a>
      </div>
    </div>
  `;

  const text = `New customer feedback for ${projectName}\nFrom: ${customerEmail ?? "Unknown customer"}\n\n${messageSnippet}\n\nReview at: ${reviewUrl}`;

  await Promise.allSettled(
    recipientEmails.map((email) =>
      resend!.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: `Customer feedback: ${projectName}`,
        html,
        text,
      })
    )
  );
}

export async function sendPortalFeedbackNotification({
  type,
  title,
  priority,
  description,
  pageArea,
  submittedBy,
  recipientEmails,
}: {
  type: string;
  title: string;
  priority: string;
  description: string;
  pageArea: string | null;
  submittedBy: string | null;
  recipientEmails: string[];
}): Promise<void> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set - skipping portal feedback notification");
    return;
  }

  if (recipientEmails.length === 0) return;

  const descriptionSnippet = summarize(description);
  const safeTitle = escapeHtml(title);
  const safeType = escapeHtml(type);
  const safePriority = escapeHtml(priority);
  const safePageArea = pageArea ? escapeHtml(pageArea) : "Not specified";
  const safeSubmittedBy = submittedBy ? escapeHtml(submittedBy) : "Unknown user";
  const safeDescription = escapeHtml(descriptionSnippet);
  const reviewUrl = `${PORTAL_URL}/feedback`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: #0f172a; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <p style="margin: 0; color: rgba(255,255,255,0.72); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">
          TCC ProjectHub
        </p>
        <h1 style="margin: 4px 0 0; color: #ffffff; font-size: 22px; font-weight: 700;">
          New Team Feedback
        </h1>
      </div>
      <div style="background: #f8fafc; padding: 28px 32px; border-radius: 0 0 12px 12px; border: 1px solid #cbd5e1; border-top: none;">
        <p style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a;">${safeTitle}</p>
        <p style="margin: 10px 0 0; font-size: 14px; color: #475569;">
          <strong>Type:</strong> ${safeType} | <strong>Priority:</strong> ${safePriority}
        </p>
        <p style="margin: 6px 0 0; font-size: 14px; color: #475569;">
          <strong>Page/Area:</strong> ${safePageArea}
        </p>
        <p style="margin: 6px 0 0; font-size: 14px; color: #475569;">
          <strong>Submitted by:</strong> ${safeSubmittedBy}
        </p>
        <div style="margin: 16px 0; padding: 16px; background: #ffffff; border-left: 3px solid #017a6f; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.6;">${safeDescription}</p>
        </div>
        <a href="${reviewUrl}"
           style="display: inline-block; margin-top: 12px; padding: 12px 28px; background: #017a6f; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 999px;">
          Open Feedback Inbox ->
        </a>
      </div>
    </div>
  `;

  const text = `New team feedback: ${title}\nType: ${type}\nPriority: ${priority}\nPage/Area: ${pageArea ?? "Not specified"}\nSubmitted by: ${submittedBy ?? "Unknown user"}\n\n${descriptionSnippet}\n\nReview at: ${reviewUrl}`;

  await Promise.allSettled(
    recipientEmails.map((email) =>
      resend!.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: `Portal feedback: ${title}`,
        html,
        text,
      })
    )
  );
}

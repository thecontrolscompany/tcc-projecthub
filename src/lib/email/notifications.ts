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

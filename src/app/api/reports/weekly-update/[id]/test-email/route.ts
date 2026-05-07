import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { sendReportsMailboxMail, type GraphSendMailError } from "@/lib/graph/report-mail";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { normalizeSingle } from "@/lib/utils/normalize";
import type { UserRole } from "@/types/database";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type WeeklyUpdateEmailRow = {
  id: string;
  project_id: string;
  week_of: string;
  status: "draft" | "submitted";
  pct_complete: number | null;
  activity_updates: string | null;
  material_delivered: string | null;
  equipment_set: string | null;
  safety_incidents: string | null;
  inspections_tests: string | null;
  delays_impacts: string | null;
  other_remarks: string | null;
  notes: string | null;
  include_bom_report: boolean | null;
  project?:
    | {
        name: string;
        customer?: { name: string | null } | Array<{ name: string | null }> | null;
      }
    | Array<{
        name: string;
        customer?: { name: string | null } | Array<{ name: string | null }> | null;
      }>
    | null;
};

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatWeekLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "0.0%" : `${(value * 100).toFixed(1)}%`;
}

function optionalReportRow(label: string, value: string | null | undefined) {
  if (!value?.trim()) return "";

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin: 0 0 14px;">
      <tr>
        <td style="padding: 14px 16px; border: 1px solid #d9e7e5; background: #ffffff;">
          <div style="color: #5d6b82; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; line-height: 1.3; text-transform: uppercase;">
            ${escapeHtml(label)}
          </div>
          <div style="margin-top: 6px; color: #1f2937; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.55; text-align: left;">
            ${formatEmailText(value)}
          </div>
        </td>
      </tr>
    </table>
  `;
}

function formatEmailText(value: string) {
  return escapeHtml(value)
    .replace(/\r?\n/g, "<br>")
    .replace(/(?:^|<br>)[\s-]*-\s*/g, "<br>&bull; ")
    .replace(/^<br>/, "");
}

function buildWeeklyReportEmail({
  update,
  projectName,
  customerName,
  reportUrl,
}: {
  update: WeeklyUpdateEmailRow;
  projectName: string;
  customerName: string | null;
  reportUrl: string;
}) {
  const safeProjectName = escapeHtml(projectName);
  const safeCustomerName = customerName ? escapeHtml(customerName) : "The Controls Company";
  const safeReportUrl = escapeHtml(reportUrl);
  const weekLabel = formatWeekLabel(update.week_of);
  const percentLabel = formatPercent(update.pct_complete);

  const html = `
    <!doctype html>
    <html>
      <body style="margin: 0; padding: 0; background: #f3f6f5;">
        <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
          Weekly report for ${safeProjectName}, week ending ${weekLabel}.
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; background: #f3f6f5;">
          <tr>
            <td align="center" style="padding: 28px 12px;">
              <table role="presentation" width="680" cellspacing="0" cellpadding="0" border="0" style="width: 680px; border-collapse: collapse; background: #ffffff; border: 1px solid #cfdcda;">
                <tr>
                  <td style="padding: 20px 28px; background: #017a6f;">
                    <div style="color: #d8f1ee; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; line-height: 1.3; text-transform: uppercase;">
                      The Controls Company
                    </div>
                    <div style="margin-top: 5px; color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 26px; font-weight: 700; line-height: 1.2;">
                      Weekly Project Report
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 28px 8px;">
                    <div style="color: #64748b; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; line-height: 1.3; text-transform: uppercase;">
                      ${safeCustomerName}
                    </div>
                    <div style="margin-top: 6px; color: #101827; font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: 700; line-height: 1.25;">
                      ${safeProjectName}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 28px 22px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                      <tr>
                        <td width="50%" style="padding: 14px 16px; background: #f3faf8; border: 1px solid #d9e7e5;">
                          <div style="color: #64748b; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Week Ending</div>
                          <div style="margin-top: 6px; color: #101827; font-family: Arial, Helvetica, sans-serif; font-size: 19px; font-weight: 700; line-height: 1.25;">${weekLabel}</div>
                        </td>
                        <td width="50%" style="padding: 14px 16px; background: #f3faf8; border: 1px solid #d9e7e5; border-left: 0;">
                          <div style="color: #64748b; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Complete</div>
                          <div style="margin-top: 6px; color: #017a6f; font-family: Arial, Helvetica, sans-serif; font-size: 19px; font-weight: 700; line-height: 1.25;">${percentLabel}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 28px 10px;">
                    ${optionalReportRow("Activity Updates", update.activity_updates)}
                    ${optionalReportRow("Material Delivered", update.material_delivered)}
                    ${optionalReportRow("Equipment Set", update.equipment_set)}
                    ${optionalReportRow("Safety Incidents", update.safety_incidents)}
                    ${optionalReportRow("Inspections & Tests", update.inspections_tests)}
                    ${optionalReportRow("Delays / Impacts", update.delays_impacts)}
                    ${optionalReportRow("Other Remarks", update.other_remarks)}
                    ${optionalReportRow("Additional Notes", update.notes)}
                    ${update.include_bom_report ? optionalReportRow("BOM Report", "Included with this weekly report.") : ""}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 28px 28px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                      <tr>
                        <td bgcolor="#017a6f" style="background: #017a6f; padding: 12px 18px;">
                          <a href="${safeReportUrl}" style="color: #ffffff; display: inline-block; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; line-height: 1.2; text-decoration: none;">
                            Open Printable Report
                          </a>
                        </td>
                      </tr>
                    </table>
                    <div style="margin-top: 20px; color: #8a98ab; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.5;">
                      Sent from tccprojecthub@controlsco.net by TCC ProjectHub.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = [
    `Weekly Project Report: ${projectName}`,
    `Customer: ${customerName ?? "The Controls Company"}`,
    `Week ending: ${weekLabel}`,
    `Complete: ${percentLabel}`,
    update.activity_updates ? `Activity Updates: ${update.activity_updates}` : null,
    update.material_delivered ? `Material Delivered: ${update.material_delivered}` : null,
    update.equipment_set ? `Equipment Set: ${update.equipment_set}` : null,
    update.safety_incidents ? `Safety Incidents: ${update.safety_incidents}` : null,
    update.inspections_tests ? `Inspections & Tests: ${update.inspections_tests}` : null,
    update.delays_impacts ? `Delays / Impacts: ${update.delays_impacts}` : null,
    update.other_remarks ? `Other Remarks: ${update.other_remarks}` : null,
    update.notes ? `Additional Notes: ${update.notes}` : null,
    update.include_bom_report ? "BOM Report: Included" : null,
    `Open printable report: ${reportUrl}`,
  ].filter(Boolean).join("\n\n");

  return {
    subject: `Weekly report: ${projectName} - ${weekLabel}`,
    html,
    text,
  };
}

async function createSendAttemptLog({
  admin,
  recipientEmail,
  projectId,
  reportId,
}: {
  admin: ReturnType<typeof adminClient>;
  recipientEmail: string;
  projectId: string;
  reportId: string;
}) {
  const { data, error } = await admin
    .from("report_email_send_attempts")
    .insert({
      recipient_email: recipientEmail,
      report_type: "weekly_update",
      project_id: projectId,
      report_id: reportId,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

async function updateSendAttemptLog({
  admin,
  logId,
  status,
  graphError,
}: {
  admin: ReturnType<typeof adminClient>;
  logId: string;
  status: "sent" | "failed";
  graphError?: GraphSendMailError | null;
}) {
  const { error } = await admin
    .from("report_email_send_attempts")
    .update({
      status,
      graph_error: graphError ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", logId);

  if (error) {
    console.error("[report-email] Failed to update send attempt log:", error);
  }
}

async function canAccessReport(
  admin: ReturnType<typeof adminClient>,
  role: UserRole,
  userId: string,
  projectId: string
) {
  if (role === "admin" || role === "ops_manager") {
    return true;
  }

  if (role === "pm" || role === "lead") {
    const { data } = await admin
      .from("project_assignments")
      .select("id")
      .eq("project_id", projectId)
      .eq("profile_id", userId)
      .in("role_on_project", ["pm", "lead"])
      .maybeSingle();

    return Boolean(data);
  }

  if (role === "customer") {
    const { data } = await admin
      .from("project_customer_contacts")
      .select("id")
      .eq("project_id", projectId)
      .eq("profile_id", userId)
      .eq("portal_access", true)
      .maybeSingle();

    return Boolean(data);
  }

  return false;
}

export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const resolvedProfile = await resolveUserRole(user);
  const role = (resolvedProfile?.role ?? "customer") as UserRole;
  const admin = adminClient();

  const { data, error } = await admin
    .from("weekly_updates")
    .select(`
      id,
      project_id,
      week_of,
      status,
      pct_complete,
      activity_updates,
      material_delivered,
      equipment_set,
      safety_incidents,
      inspections_tests,
      delays_impacts,
      other_remarks,
      notes,
      include_bom_report,
      project:projects(
        name,
        customer:customers(name)
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const update = data as WeeklyUpdateEmailRow | null;
  if (!update) {
    return NextResponse.json({ error: "Weekly report not found." }, { status: 404 });
  }

  const allowed = await canAccessReport(admin, role, user.id, update.project_id);
  if (!allowed) {
    return NextResponse.json({ error: "You do not have access to this report." }, { status: 403 });
  }

  if (update.status !== "submitted") {
    return NextResponse.json({ error: "Only submitted reports can be emailed." }, { status: 400 });
  }

  const project = normalizeSingle(update.project);
  if (!project) {
    return NextResponse.json({ error: "Project not found for this report." }, { status: 404 });
  }

  const customer = normalizeSingle(project.customer);
  const reportUrl = `${appUrl()}/reports/weekly-update/${encodeURIComponent(update.id)}`;
  const logId = await createSendAttemptLog({
    admin,
    recipientEmail: user.email,
    projectId: update.project_id,
    reportId: update.id,
  });
  const email = buildWeeklyReportEmail({
    update,
    projectName: project.name,
    customerName: customer?.name ?? null,
    reportUrl,
  });

  try {
    await sendReportsMailboxMail({
      to: user.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    await updateSendAttemptLog({ admin, logId, status: "sent" });
  } catch (err) {
    const graphError = err instanceof Error && "graphError" in err
      ? (err as Error & { graphError?: GraphSendMailError }).graphError ?? null
      : null;
    await updateSendAttemptLog({ admin, logId, status: "failed", graphError });

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to send test email." },
      { status: 500 }
    );
  }

  return NextResponse.json({ sent: true, recipientEmail: user.email });
}

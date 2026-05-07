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
    <tr>
      <td style="padding: 12px 0; border-top: 1px solid #d8ebe8; color: #64748b; font-size: 13px; font-weight: 700; width: 34%;">
        ${escapeHtml(label)}
      </td>
      <td style="padding: 12px 0; border-top: 1px solid #d8ebe8; color: #1f2937; font-size: 14px; line-height: 1.55;">
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
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
    <div style="margin: 0; padding: 28px; background: #eef6f4; font-family: Arial, Helvetica, sans-serif; color: #1f2937;">
      <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #cfe3df; border-radius: 12px; overflow: hidden;">
        <div style="padding: 26px 32px; background: #017a6f;">
          <p style="margin: 0; color: rgba(255,255,255,0.78); font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;">
            The Controls Company
          </p>
          <h1 style="margin: 6px 0 0; color: #ffffff; font-size: 24px; line-height: 1.25;">
            Weekly Project Report
          </h1>
        </div>
        <div style="padding: 28px 32px;">
          <p style="margin: 0 0 6px; color: #64748b; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">
            ${safeCustomerName}
          </p>
          <h2 style="margin: 0; color: #0f172a; font-size: 22px; line-height: 1.25;">
            ${safeProjectName}
          </h2>
          <div style="display: table; width: 100%; margin: 22px 0; border: 1px solid #d8ebe8; border-radius: 10px; overflow: hidden;">
            <div style="display: table-cell; width: 50%; padding: 16px; background: #f7fbfa;">
              <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">Week Ending</p>
              <p style="margin: 5px 0 0; color: #0f172a; font-size: 18px; font-weight: 700;">${weekLabel}</p>
            </div>
            <div style="display: table-cell; width: 50%; padding: 16px; background: #f7fbfa; border-left: 1px solid #d8ebe8;">
              <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">Complete</p>
              <p style="margin: 5px 0 0; color: #017a6f; font-size: 18px; font-weight: 700;">${percentLabel}</p>
            </div>
          </div>
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            ${optionalReportRow("Activity Updates", update.activity_updates)}
            ${optionalReportRow("Material Delivered", update.material_delivered)}
            ${optionalReportRow("Equipment Set", update.equipment_set)}
            ${optionalReportRow("Safety Incidents", update.safety_incidents)}
            ${optionalReportRow("Inspections & Tests", update.inspections_tests)}
            ${optionalReportRow("Delays / Impacts", update.delays_impacts)}
            ${optionalReportRow("Other Remarks", update.other_remarks)}
            ${optionalReportRow("Additional Notes", update.notes)}
            ${update.include_bom_report ? optionalReportRow("BOM Report", "Included with this weekly report.") : ""}
          </table>
          <a href="${safeReportUrl}"
             style="display: inline-block; margin-top: 24px; padding: 12px 22px; background: #017a6f; color: #ffffff; border-radius: 8px; font-size: 14px; font-weight: 700; text-decoration: none;">
            Open Printable Report
          </a>
          <p style="margin: 22px 0 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
            Sent from tccprojecthub@controlsco.net by TCC ProjectHub.
          </p>
        </div>
      </div>
    </div>
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

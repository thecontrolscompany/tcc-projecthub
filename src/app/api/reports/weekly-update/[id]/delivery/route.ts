import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { sendReportsMailboxMail, type GraphSendMailError } from "@/lib/graph/report-mail";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  buildWeeklyReportEmail,
  loadWeeklyUpdateEmailData,
  loadWeeklyUpdateRecipients,
  type WeeklyUpdateRecipient,
} from "@/lib/reports/weekly-update-email";
import type { UserRole } from "@/types/database";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function canManageReport(admin: ReturnType<typeof adminClient>, role: UserRole, userId: string, projectId: string) {
  if (role === "admin" || role === "ops_manager") return true;

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

  return false;
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

async function loadReportAccess(
  admin: ReturnType<typeof adminClient>,
  role: UserRole,
  userId: string,
  projectId: string
) {
  if (await canManageReport(admin, role, userId, projectId)) {
    return true;
  }

  return false;
}

async function loadCcRecipients(
  admin: ReturnType<typeof adminClient>,
  projectId: string,
  senderEmail: string | null | undefined,
): Promise<string[]> {
  const [{ data: assignments }, { data: opsManagers }] = await Promise.all([
    admin
      .from("project_assignments")
      .select("profile:profiles(email)")
      .eq("project_id", projectId)
      .in("role_on_project", ["pm", "lead"]),
    admin
      .from("profiles")
      .select("email")
      .eq("role", "ops_manager"),
  ]);

  const emails = new Set<string>();

  for (const row of (assignments ?? []) as Array<{ profile?: { email: string | null } | Array<{ email: string | null }> | null }>) {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const email = profile?.email?.trim().toLowerCase();
    if (email) emails.add(email);
  }

  for (const row of (opsManagers ?? []) as Array<{ email: string | null }>) {
    const email = row.email?.trim().toLowerCase();
    if (email) emails.add(email);
  }

  if (senderEmail) {
    const normalized = senderEmail.trim().toLowerCase();
    if (normalized) emails.add(normalized);
  }

  return Array.from(emails);
}

async function sendToRecipients(
  admin: ReturnType<typeof adminClient>,
  recipients: WeeklyUpdateRecipient[],
  email: { subject: string; html: string; text: string },
  projectId: string,
  reportId: string,
  cc: string[],
) {
  const sentRecipients: string[] = [];
  const failedRecipients: Array<{ email: string; message: string }> = [];

  for (const recipient of recipients) {
    const logId = await createSendAttemptLog({
      admin,
      recipientEmail: recipient.email,
      projectId,
      reportId,
    });

    try {
      await sendReportsMailboxMail({
        to: recipient.email,
        cc,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      sentRecipients.push(recipient.email);
      await updateSendAttemptLog({ admin, logId, status: "sent" });
    } catch (err) {
      const graphError = err instanceof Error && "graphError" in err
        ? (err as Error & { graphError?: GraphSendMailError }).graphError ?? null
        : null;
      await updateSendAttemptLog({ admin, logId, status: "failed", graphError });
      failedRecipients.push({
        email: recipient.email,
        message: err instanceof Error ? err.message : "Unable to send report.",
      });
    }
  }

  return { sentRecipients, failedRecipients };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const resolvedProfile = await resolveUserRole(user);
  const role = (resolvedProfile?.role ?? "customer") as UserRole;
  const admin = adminClient();

  const previewLookup = await admin
    .from("weekly_updates")
    .select("id, project_id, status")
    .eq("id", id)
    .maybeSingle();

  if (previewLookup.error) {
    return NextResponse.json({ error: previewLookup.error.message }, { status: 500 });
  }

  if (!previewLookup.data?.project_id) {
    return NextResponse.json({ error: "Weekly report not found." }, { status: 404 });
  }

  const allowed = await loadReportAccess(admin, role, user.id, previewLookup.data.project_id);
  if (!allowed) {
    return NextResponse.json({ error: "You do not have access to this report." }, { status: 403 });
  }

  const emailContext = await loadWeeklyUpdateEmailData(admin, id);
  const recipients = await loadWeeklyUpdateRecipients(admin, emailContext.update.project_id);
  const email = buildWeeklyReportEmail({
    update: emailContext.update,
    projectName: emailContext.project.name,
    customerName: emailContext.customerName,
    pmName: emailContext.pmName,
    reportUrl: emailContext.reportUrl,
    portalUrl: emailContext.portalUrl,
    logoUrl: emailContext.logoUrl,
    reportData: emailContext.reportData,
  });

  return NextResponse.json({
    report: {
      id: emailContext.update.id,
      projectId: emailContext.update.project_id,
      projectName: emailContext.project.name,
      weekOf: emailContext.update.week_of,
      subject: email.subject,
      html: email.html,
    },
    recipients,
  });
}

export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const resolvedProfile = await resolveUserRole(user);
  const role = (resolvedProfile?.role ?? "customer") as UserRole;
  const admin = adminClient();

  const previewLookup = await admin
    .from("weekly_updates")
    .select("id, project_id, status")
    .eq("id", id)
    .maybeSingle();

  if (previewLookup.error) {
    return NextResponse.json({ error: previewLookup.error.message }, { status: 500 });
  }

  if (!previewLookup.data?.project_id) {
    return NextResponse.json({ error: "Weekly report not found." }, { status: 404 });
  }

  const allowed = await loadReportAccess(admin, role, user.id, previewLookup.data.project_id);
  if (!allowed) {
    return NextResponse.json({ error: "You do not have access to this report." }, { status: 403 });
  }

  if (previewLookup.data.status !== "submitted") {
    return NextResponse.json({ error: "Only submitted reports can be delivered." }, { status: 400 });
  }

  const emailContext = await loadWeeklyUpdateEmailData(admin, id);
  const recipients = await loadWeeklyUpdateRecipients(admin, emailContext.update.project_id);

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No customer email recipients are configured for this project." }, { status: 400 });
  }

  const email = buildWeeklyReportEmail({
    update: emailContext.update,
    projectName: emailContext.project.name,
    customerName: emailContext.customerName,
    pmName: emailContext.pmName,
    reportUrl: emailContext.reportUrl,
    portalUrl: emailContext.portalUrl,
    logoUrl: emailContext.logoUrl,
    reportData: emailContext.reportData,
  });

  const senderEmail = resolvedProfile?.email ?? user.email ?? null;
  const cc = await loadCcRecipients(admin, emailContext.update.project_id, senderEmail);

  try {
    const { sentRecipients, failedRecipients } = await sendToRecipients(
      admin,
      recipients,
      email,
      emailContext.update.project_id,
      emailContext.update.id,
      cc,
    );

    return NextResponse.json({
      sent: true,
      sentCount: sentRecipients.length,
      recipientEmails: sentRecipients,
      failedCount: failedRecipients.length,
      failedRecipients,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to send report." },
      { status: 500 }
    );
  }
}

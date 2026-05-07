import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { endOfWeek, format, subDays } from "date-fns";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { sendReportsMailboxMail, type GraphSendMailError } from "@/lib/graph/report-mail";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { normalizeSingle } from "@/lib/utils/normalize";
import { formatWeekEndingSaturday } from "@/lib/utils/week-ending";
import type { CrewLogEntry, LaborHoursWorker, PocSnapshotEntry, UserRole } from "@/types/database";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type WeeklyUpdateEmailRow = {
  id: string;
  project_id: string;
  week_of: string;
  status: "draft" | "submitted";
  pm_id: string | null;
  pct_complete: number | null;
  activity_updates: string | null;
  blockers: string | null;
  poc_snapshot: PocSnapshotEntry[] | null;
  crew_log: CrewLogEntry[] | null;
  labor_hours_pulled: number | null;
  labor_hours_override: number | null;
  labor_hours_detail: LaborHoursWorker[] | null;
  material_delivered: string | null;
  equipment_set: string | null;
  safety_incidents: string | null;
  inspections_tests: string | null;
  delays_impacts: string | null;
  other_remarks: string | null;
  notes: string | null;
  include_bom_report: boolean | null;
  submitted_at: string | null;
  project?:
    | {
        id: string;
        name: string;
        job_number: string | null;
        site_address: string | null;
        general_contractor: string | null;
        customer_poc: string | null;
        scheduled_completion: string | null;
        estimated_income: number | null;
        customer?: { name: string | null } | Array<{ name: string | null }> | null;
      }
    | Array<{
        id: string;
        name: string;
        job_number: string | null;
        site_address: string | null;
        general_contractor: string | null;
        customer_poc: string | null;
        scheduled_completion: string | null;
        estimated_income: number | null;
        customer?: { name: string | null } | Array<{ name: string | null }> | null;
      }>
    | null;
  pm?: { full_name: string | null; email: string | null } | Array<{ full_name: string | null; email: string | null }> | null;
};

type BillingEmailRow = {
  id: string;
  period_month: string;
  actual_billed: number;
  invoice_number: string | null;
  cumulative: number;
};

type ChangeOrderEmailRow = {
  co_number: string;
  title: string;
  amount: number;
  status: string;
  reference_doc: string | null;
};

type BomEmailItem = {
  id: string;
  section: string;
  designation: string | null;
  code_number: string | null;
  description: string;
  qty_required: number;
  qty_received: number;
  status: "not_received" | "partial" | "received" | "surplus";
};

type EmailReportData = {
  billingRows: BillingEmailRow[];
  totalBilled: number;
  remaining: number;
  contractValue: number;
  changeOrders: ChangeOrderEmailRow[];
  approvedCoTotal: number;
  bomItems: BomEmailItem[];
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

function formatDate(value: string | null | undefined, fallback = "Not provided") {
  if (!value) return fallback;
  return format(new Date(value), "MMMM d, yyyy");
}

function fmtUSD(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function coalesceText(value: string | null | undefined, fallback = "None") {
  return value && value.trim() ? value : fallback;
}

function customerProjectName(name: string | null | undefined) {
  return (name ?? "").replace(/^\d{4}-\d{3}\s*-\s*/, "").trim() || (name ?? "");
}

function emptyCrewLog(): CrewLogEntry[] {
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => ({
    day,
    workers: 0,
    hours: 0,
    activities: "",
  })) as CrewLogEntry[];
}

function normalizeCrewLog(rows: CrewLogEntry[] | null | undefined) {
  const byDay = new Map((rows ?? []).map((row) => {
    const legacyWorkers = (row as CrewLogEntry & { men?: number }).men;
    return [row.day, { ...row, workers: row.workers ?? legacyWorkers ?? 0 }];
  }));

  return emptyCrewLog().map((row) => {
    const existing = byDay.get(row.day);
    return existing
      ? {
          day: row.day,
          workers: existing.workers ?? 0,
          hours: existing.hours ?? 0,
          activities: existing.activities ?? "",
        }
      : row;
  });
}

function effectiveLaborHours(update: WeeklyUpdateEmailRow) {
  if (update.labor_hours_override != null) return update.labor_hours_override;
  if (update.labor_hours_pulled != null) return update.labor_hours_pulled;
  return null;
}

function activityBulletsFromText(value: string | null | undefined) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:[-*]|\u2022)\s*/, ""))
    .filter(Boolean);
}

function activityBulletsFromCrewLog(rows: CrewLogEntry[]) {
  return rows
    .filter((row) => row.activities?.trim())
    .map((row) => `${row.day}: ${row.activities.trim()}`);
}

function getCrewLogDateLabel(weekOf: string, day: CrewLogEntry["day"]) {
  const weekEnding = endOfWeek(new Date(`${formatWeekEndingSaturday(weekOf, "yyyy-MM-dd")}T00:00:00`), { weekStartsOn: 0 });
  const dayOffsets: Record<CrewLogEntry["day"], number> = {
    Monday: 5,
    Tuesday: 4,
    Wednesday: 3,
    Thursday: 2,
    Friday: 1,
    Saturday: 0,
  };

  return format(subDays(weekEnding, dayOffsets[day]), "MM/dd/yy");
}

function sectionTitle(title: string) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin: 20px 0 10px;">
      <tr>
        <td style="padding: 0 0 7px; border-bottom: 2px solid #017a6f; color: #017a6f; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">
          ${escapeHtml(title)}
        </td>
      </tr>
    </table>
  `;
}

function keyValueTable(rows: Array<[string, string | null | undefined]>) {
  const body = rows.map(([label, value]) => `
    <tr>
      <td width="34%" style="padding: 8px 10px; border: 1px solid #d1d5db; color: #374151; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 700; vertical-align: top;">
        ${escapeHtml(label)}
      </td>
      <td style="padding: 8px 10px; border: 1px solid #d1d5db; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 13px; vertical-align: top;">
        ${formatEmailText(value || "Not provided")}
      </td>
    </tr>
  `).join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
      ${body}
    </table>
  `;
}

function notesTable(rows: Array<[string, string | null | undefined]>) {
  return keyValueTable(rows.map(([label, value]) => [label, coalesceText(value)]));
}

function optionalReportBlock(label: string, value: string | null | undefined) {
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

function simpleTable(headers: string[], rows: string[][], footer?: string) {
  if (rows.length === 0) return "";
  const headerHtml = headers.map((header) => `
    <th style="padding: 8px 9px; border: 1px solid #d1d5db; background: #eef8f6; color: #0f172a; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-align: left; text-transform: uppercase;">
      ${escapeHtml(header)}
    </th>
  `).join("");
  const rowsHtml = rows.map((row) => `
    <tr>
      ${row.map((cell) => `
        <td style="padding: 8px 9px; border: 1px solid #d1d5db; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.4; vertical-align: top;">
          ${cell}
        </td>
      `).join("")}
    </tr>
  `).join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
      <tr>${headerHtml}</tr>
      ${rowsHtml}
    </table>
    ${footer ? `<div style="margin-top: 8px; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 700; text-align: right;">${footer}</div>` : ""}
  `;
}

function bulletList(items: string[]) {
  if (items.length === 0) return "";
  return `
    <ul style="margin: 0; padding-left: 20px; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.55;">
      ${items.map((item) => `<li style="margin-bottom: 7px;">${formatEmailText(item)}</li>`).join("")}
    </ul>
  `;
}

function buildWeeklyReportEmail({
  update,
  projectName,
  customerName,
  pmName,
  reportUrl,
  portalUrl,
  logoUrl,
  reportData,
}: {
  update: WeeklyUpdateEmailRow;
  projectName: string;
  customerName: string | null;
  pmName: string;
  reportUrl: string;
  portalUrl: string;
  logoUrl: string;
  reportData: EmailReportData;
}) {
  const project = normalizeSingle(update.project);
  const safeProjectName = escapeHtml(customerProjectName(projectName));
  const safeCustomerName = customerName ? escapeHtml(customerName) : "The Controls Company";
  const safeReportUrl = escapeHtml(reportUrl);
  const safePortalUrl = escapeHtml(portalUrl);
  const safeLogoUrl = escapeHtml(logoUrl);
  const weekLabel = formatWeekLabel(update.week_of);
  const percentLabel = formatPercent(update.pct_complete);
  const crewLog = update.crew_log && update.crew_log.length > 0 ? normalizeCrewLog(update.crew_log) : emptyCrewLog();
  const totalManHours = crewLog.reduce((sum, row) => sum + (Number(row.workers) || 0) * (Number(row.hours) || 0), 0);
  const totalLaborHours = effectiveLaborHours(update);
  const activityBullets = activityBulletsFromText(update.activity_updates);
  const reportActivityBullets =
    activityBullets.length > 0
      ? activityBullets
      : update.labor_hours_detail?.length
        ? activityBulletsFromCrewLog(crewLog)
        : [];
  const pocSnapshot = Array.isArray(update.poc_snapshot) ? update.poc_snapshot : [];
  const totalWeight = pocSnapshot.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

  const billingSummary = reportData.billingRows.length > 0 ? `
    ${sectionTitle("Billing")}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; margin-bottom: 12px;">
      <tr>
        ${[
          ["Contract Value", fmtUSD(reportData.contractValue)],
          ["Total Billed", fmtUSD(reportData.totalBilled)],
          ["Remaining Balance", fmtUSD(reportData.remaining)],
        ].map(([label, value]) => `
          <td width="33.33%" style="padding: 10px; border: 1px solid #d1d5db; text-align: center;">
            <div style="color: #6b7280; font-family: Arial, Helvetica, sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">${label}</div>
            <div style="margin-top: 4px; color: #017a6f; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 700;">${value}</div>
          </td>
        `).join("")}
      </tr>
    </table>
    ${simpleTable(
      ["Period", "Invoice #", "Amount Billed", "Cumulative"],
      reportData.billingRows.map((row) => [
        escapeHtml(format(new Date(`${row.period_month}T00:00:00`), "MMMM yyyy")),
        escapeHtml(row.invoice_number || "-"),
        escapeHtml(fmtUSD(row.actual_billed)),
        escapeHtml(fmtUSD(row.cumulative)),
      ])
    )}
  ` : "";

  const changeOrders = reportData.changeOrders.length > 0 ? `
    ${sectionTitle("Change Orders")}
    ${simpleTable(
      ["CO #", "Title", "Status", "Ref Doc", "Amount"],
      reportData.changeOrders.map((co) => {
        const statusLabel =
          co.status === "approved_po" ? "Approved (PO)"
          : co.status === "approved_email" ? "Approved (Email)"
          : co.status === "approved" ? "Approved"
          : co.status === "pending" ? "In Review"
          : co.status === "rejected" ? "Not Approved"
          : co.status;
        return [
          escapeHtml(co.co_number),
          escapeHtml(co.title),
          escapeHtml(statusLabel),
          escapeHtml(co.reference_doc || "-"),
          escapeHtml(fmtUSD(co.amount)),
        ];
      }),
      reportData.approvedCoTotal > 0 ? `Total Approved Change Orders: ${escapeHtml(fmtUSD(reportData.approvedCoTotal))}` : undefined
    )}
  ` : "";

  const laborSection = update.labor_hours_detail?.length ? `
    ${sectionTitle("Labor Hours")}
    ${simpleTable(
      ["Name", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Total"],
      update.labor_hours_detail.map((worker) => [
        escapeHtml(worker.display_name || "-"),
        escapeHtml(worker.mon ? String(worker.mon) : ""),
        escapeHtml(worker.tue ? String(worker.tue) : ""),
        escapeHtml(worker.wed ? String(worker.wed) : ""),
        escapeHtml(worker.thu ? String(worker.thu) : ""),
        escapeHtml(worker.fri ? String(worker.fri) : ""),
        escapeHtml(worker.sat ? String(worker.sat) : ""),
        escapeHtml(worker.total ? String(worker.total) : ""),
      ]),
      `Total Labor Hours: ${escapeHtml((totalLaborHours ?? 0).toFixed(1))}`
    )}
  ` : `
    ${sectionTitle("Crew Log")}
    ${simpleTable(
      ["Day", "# Workers", "Hours", "Activities"],
      crewLog.map((row) => [
        `${escapeHtml(row.day)}<br><span style="color:#6b7280;font-size:11px;">${escapeHtml(getCrewLogDateLabel(update.week_of, row.day))}</span>`,
        escapeHtml(row.workers ? String(row.workers) : ""),
        escapeHtml(row.hours ? String(row.hours) : ""),
        formatEmailText(row.activities || ""),
      ]),
      `Total Man-Hours: ${escapeHtml(totalManHours.toFixed(1))}`
    )}
  `;

  const progressSection = `
    ${sectionTitle("Progress")}
    ${keyValueTable([["Overall % Complete", percentLabel]])}
    ${pocSnapshot.length > 0 ? `
      <div style="height: 10px;"></div>
      ${simpleTable(
        ["Category", "% Complete", "Contribution"],
        pocSnapshot.map((item) => {
          const contribution = totalWeight > 0 ? ((item.weight * item.pct_complete) / totalWeight) * 100 : item.pct_complete * 100;
          return [
            escapeHtml(item.category),
            escapeHtml(`${(item.pct_complete * 100).toFixed(1)}%`),
            escapeHtml(`${contribution.toFixed(1)}%`),
          ];
        })
      )}
    ` : ""}
  `;

  const bomSection = reportData.bomItems.length > 0 ? `
    ${sectionTitle("Bill of Materials")}
    ${simpleTable(
      ["Designation", "Part", "Description", "Req'd", "Rec'd", "Status"],
      reportData.bomItems.slice(0, 40).map((item) => {
        const statusLabel =
          item.status === "received" ? "Received"
          : item.status === "partial" ? "Partial"
          : item.status === "surplus" ? "Surplus"
          : "Missing";
        return [
          escapeHtml(item.designation || "-"),
          escapeHtml(item.code_number || "-"),
          escapeHtml(item.description),
          escapeHtml(String(item.qty_required)),
          escapeHtml(String(item.qty_received)),
          escapeHtml(statusLabel),
        ];
      }),
      reportData.bomItems.length > 40 ? `Showing first 40 of ${reportData.bomItems.length} BOM items. Open printable report for full list.` : undefined
    )}
  ` : "";

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
                  <td style="padding: 18px 28px; background: #017a6f;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                      <tr>
                        <td width="82" style="vertical-align: middle;">
                          <img src="${safeLogoUrl}" width="70" alt="The Controls Company" style="display: block; width: 70px; height: auto; border: 0;">
                        </td>
                        <td style="vertical-align: middle;">
                          <div style="color: #d8f1ee; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; line-height: 1.3; text-transform: uppercase;">
                            The Controls Company, LLC
                          </div>
                          <div style="margin-top: 5px; color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 26px; font-weight: 700; line-height: 1.2;">
                            Weekly Project Report
                          </div>
                          <div style="margin-top: 4px; color: #d8f1ee; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.4;">
                            Service Disabled Veteran Owned Small Business
                          </div>
                        </td>
                      </tr>
                    </table>
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
                  <td style="padding: 4px 28px 8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                      <tr>
                        <td style="padding: 12px 14px; background: #f8fafc; border: 1px solid #d9e2ea; color: #475569; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.45;">
                          This report is sent from an unmonitored mailbox. Please contact your TCC Project Manager with any questions or concerns.
                        </td>
                      </tr>
                    </table>
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
                    ${sectionTitle("Project Details")}
                    ${keyValueTable([
                      ["Company Name", "The Controls Company, LLC"],
                      ["Project Name", customerProjectName(projectName)],
                      ["Site Address", project?.site_address || "Not provided"],
                      ["Customer", customerName || "Not provided"],
                      ["Project Manager", pmName],
                      ["Customer POC", project?.customer_poc || "Not provided"],
                      ["General Contractor", project?.general_contractor || "Not provided"],
                      ["Scheduled Completion", project?.scheduled_completion ? formatDate(project.scheduled_completion) : "Schedule not received"],
                      ["Week Ending", weekLabel],
                      ["Report Date", format(new Date(), "MMMM d, yyyy")],
                    ])}
                    ${billingSummary}
                    ${changeOrders}
                    ${laborSection}
                    ${reportActivityBullets.length > 0 ? `${sectionTitle("Activities")}${bulletList(reportActivityBullets)}` : ""}
                    ${sectionTitle("Notes")}
                    ${notesTable([
                      ["Material Delivered", update.material_delivered],
                      ["Equipment Set", update.equipment_set],
                      ["Safety Incidents", update.safety_incidents],
                      ["Inspections & Tests", update.inspections_tests],
                      ["Delays / Impacts", update.delays_impacts],
                      ["Other Remarks", update.other_remarks || " "],
                    ])}
                    ${progressSection}
                    ${optionalReportBlock("Blockers / Items Requiring Attention", coalesceText(update.blockers))}
                    ${optionalReportBlock("General Notes", coalesceText(update.notes, "") || " ")}
                    ${bomSection}
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
                        <td width="10" style="font-size: 1px; line-height: 1px;">&nbsp;</td>
                        <td bgcolor="#ffffff" style="background: #ffffff; border: 1px solid #017a6f; padding: 11px 17px;">
                          <a href="${safePortalUrl}" style="color: #017a6f; display: inline-block; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; line-height: 1.2; text-decoration: none;">
                            View Customer Portal
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
    update.blockers ? `Blockers / Items Requiring Attention: ${update.blockers}` : null,
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

async function loadEmailReportData(
  admin: ReturnType<typeof adminClient>,
  projectId: string,
  includeBomReport: boolean | null
): Promise<EmailReportData> {
  const [{ data: rawBillingPeriods }, { data: rawChangeOrders }] = await Promise.all([
    admin
      .from("billing_periods")
      .select("id, period_month, actual_billed, invoice_number")
      .eq("project_id", projectId)
      .not("actual_billed", "is", null)
      .order("period_month"),
    admin
      .from("change_orders")
      .select("co_number, title, amount, status, reference_doc")
      .eq("project_id", projectId)
      .not("status", "eq", "void")
      .order("submitted_date"),
  ]);

  const billingPeriods = (rawBillingPeriods ?? []) as Array<{
    id: string;
    period_month: string;
    actual_billed: number;
    invoice_number: string | null;
  }>;
  const changeOrders = (rawChangeOrders ?? []) as ChangeOrderEmailRow[];
  const approvedCoTotal = changeOrders
    .filter((co) => co.status === "approved" || co.status === "approved_po" || co.status === "approved_email")
    .reduce((sum, co) => sum + (co.amount ?? 0), 0);

  let runningTotal = 0;
  const billingRows = billingPeriods.map((period) => {
    runningTotal += period.actual_billed;
    return { ...period, cumulative: runningTotal };
  });

  let bomItems: BomEmailItem[] = [];
  if (includeBomReport) {
    const { data: rawItems } = await admin
      .from("bom_items")
      .select("id, section, designation, code_number, description, qty_required, sort_order")
      .eq("project_id", projectId)
      .order("section")
      .order("sort_order");

    const itemIds = (rawItems ?? []).map((item) => item.id);
    const { data: rawReceipts } = itemIds.length > 0
      ? await admin
          .from("bom_receipts")
          .select("bom_item_id, qty_received")
          .in("bom_item_id", itemIds)
      : { data: [] };

    const receivedByItem = new Map<string, number>();
    for (const receipt of (rawReceipts ?? []) as Array<{ bom_item_id: string; qty_received: number }>) {
      receivedByItem.set(receipt.bom_item_id, (receivedByItem.get(receipt.bom_item_id) ?? 0) + (receipt.qty_received ?? 0));
    }

    bomItems = (rawItems ?? []).map((item) => {
      const qtyReceived = receivedByItem.get(item.id) ?? 0;
      let status: BomEmailItem["status"];
      if (qtyReceived === 0) status = "not_received";
      else if (qtyReceived < item.qty_required) status = "partial";
      else if (qtyReceived === item.qty_required) status = "received";
      else status = "surplus";

      return {
        id: item.id,
        section: item.section,
        designation: item.designation,
        code_number: item.code_number,
        description: item.description,
        qty_required: item.qty_required,
        qty_received: qtyReceived,
        status,
      };
    });
  }

  return {
    billingRows,
    totalBilled: runningTotal,
    remaining: 0,
    contractValue: 0,
    changeOrders,
    approvedCoTotal,
    bomItems,
  };
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
      pm_id,
      pct_complete,
      activity_updates,
      blockers,
      poc_snapshot,
      crew_log,
      labor_hours_pulled,
      labor_hours_override,
      labor_hours_detail,
      material_delivered,
      equipment_set,
      safety_incidents,
      inspections_tests,
      delays_impacts,
      other_remarks,
      notes,
      include_bom_report,
      submitted_at,
      pm:profiles(full_name, email),
      project:projects(
        id,
        name,
        job_number,
        site_address,
        general_contractor,
        customer_poc,
        scheduled_completion,
        estimated_income,
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
  const pmProfile = normalizeSingle(update.pm);
  const pmName = pmProfile?.full_name?.trim() || pmProfile?.email?.trim() || "The Controls Company";
  const reportData = await loadEmailReportData(admin, update.project_id, update.include_bom_report);
  reportData.contractValue = (project.estimated_income ?? 0) + reportData.approvedCoTotal;
  reportData.remaining = Math.max(reportData.contractValue - reportData.totalBilled, 0);
  const baseUrl = appUrl();
  const reportUrl = `${baseUrl}/reports/weekly-update/${encodeURIComponent(update.id)}`;
  const portalUrl = `${baseUrl}/customer`;
  const logoUrl = `${baseUrl}/logo.png`;
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
    pmName,
    reportUrl,
    portalUrl,
    logoUrl,
    reportData,
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

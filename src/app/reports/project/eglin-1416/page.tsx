export const dynamic = "force-dynamic";

import { differenceInCalendarDays, format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { PrintButton } from "@/app/reports/weekly-update/[id]/PrintButton";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { createClient } from "@/lib/supabase/server";
import { normalizeSingle } from "@/lib/utils/normalize";

type PageProps = {
  searchParams: Promise<{
    projectId?: string;
    packetDate?: string;
  }>;
};

type RiskLevel = "low" | "medium" | "high";
type RiskRow = {
  id: string;
  title: string;
  level: RiskLevel;
  dueDate: string;
  mitigation: string;
};

type PacketBody = {
  reportDate: string;
  periodCovered: string;
  statusDate: string;
  contractStart: string;
  contractCompletion: string;
  contractValue: string;
  overallProgressPct: string;
  completedThisPeriod: string;
  lookAheadWeekOneLabel: string;
  lookAheadWeekOnePlan: string;
  lookAheadWeekTwoLabel: string;
  lookAheadWeekTwoPlan: string;
  occupantImpact: string;
  sapfCoordination: string;
  aesUpdate: string;
  greshamUpdate: string;
  financialNotes: string;
  risks: RiskRow[];
};

type PacketRow = {
  id: string;
  packet_date: string;
  title: string;
  body: PacketBody;
  project?:
    | {
        id: string;
        name: string;
        job_number: string | null;
        site_address: string | null;
        general_contractor: string | null;
        customer?: { name: string | null } | Array<{ name: string | null }> | null;
      }
    | Array<{
        id: string;
        name: string;
        job_number: string | null;
        site_address: string | null;
        general_contractor: string | null;
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

function normalizeLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s\-*]+/, "").trim())
    .filter(Boolean);
}

function formatLongDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "MMMM d, yyyy");
}

function formatShortDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "MMM d, yyyy");
}

function formatCurrencyValue(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function clampPercent(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(numeric, 0), 100);
}

function riskLabel(level: RiskLevel) {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}

function customerProjectName(name: string | null | undefined) {
  return (name ?? "").replace(/^\d{4}-\d{3}\s*-\s*/, "").trim() || (name ?? "");
}

async function canAccessProject(
  supabase: ReturnType<typeof adminClient>,
  role: string,
  userId: string,
  projectId: string
) {
  if (role === "admin" || role === "ops_manager") {
    return true;
  }

  const { data } = await supabase
    .from("project_assignments")
    .select("id")
    .eq("project_id", projectId)
    .eq("profile_id", userId)
    .limit(1)
    .maybeSingle();

  return Boolean(data);
}

export default async function Eglin1416GeneratedReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const projectId = params.projectId;
  const packetDate = params.packetDate;

  if (!projectId) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedProfile = await resolveUserRole(user);
  const role = resolvedProfile?.role ?? "customer";
  if (!["admin", "ops_manager", "pm", "lead"].includes(role)) {
    redirect("/login");
  }

  const admin = adminClient();
  const allowed = await canAccessProject(admin, role, user.id, projectId);
  if (!allowed) {
    redirect("/pm");
  }

  let packetQuery = admin
    .from("project_report_packets")
    .select(`
      id,
      packet_date,
      title,
      body,
      project:projects(
        id,
        name,
        job_number,
        site_address,
        general_contractor,
        customer:customers(name)
      )
    `)
    .eq("project_id", projectId)
    .eq("report_type", "eglin_1416_progress")
    .order("packet_date", { ascending: false })
    .limit(1);

  if (packetDate) {
    packetQuery = admin
      .from("project_report_packets")
      .select(`
        id,
        packet_date,
        title,
        body,
        project:projects(
          id,
          name,
          job_number,
          site_address,
          general_contractor,
          customer:customers(name)
        )
      `)
      .eq("project_id", projectId)
      .eq("report_type", "eglin_1416_progress")
      .eq("packet_date", packetDate)
      .limit(1);
  }

  const { data } = await packetQuery.maybeSingle();
  const packet = data as PacketRow | null;
  if (!packet) {
    notFound();
  }

  const project = normalizeSingle(packet.project);
  const customer = normalizeSingle(project?.customer);
  if (!project) {
    notFound();
  }

  const body = packet.body;
  const reportTitle = `${customerProjectName(project.name)} - Progress Report - ${body.reportDate}`;
  const progressPct = clampPercent(body.overallProgressPct);

  const contractStart = new Date(`${body.contractStart}T00:00:00`);
  const contractCompletion = new Date(`${body.contractCompletion}T00:00:00`);
  const statusDate = new Date(`${body.statusDate}T00:00:00`);
  const totalDays = Math.max(differenceInCalendarDays(contractCompletion, contractStart), 0);
  const elapsedDays = Math.min(Math.max(differenceInCalendarDays(statusDate, contractStart), 0), totalDays);
  const remainingDays = Math.max(totalDays - elapsedDays, 0);
  const elapsedPct = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0;

  const executiveBullets = [
    `Overall contract progress is ${progressPct.toFixed(1)}% as of ${formatLongDate(body.statusDate)}.`,
    `Elapsed contract time is ${elapsedPct.toFixed(1)}% (${elapsedDays} of ${totalDays} calendar days), with ${remainingDays} days remaining to completion.`,
    ...normalizeLines(body.completedThisPeriod),
  ];

  const lookAheadBullets = [
    ...(body.lookAheadWeekOnePlan.trim()
      ? [`${body.lookAheadWeekOneLabel || "This Week"}: ${body.lookAheadWeekOnePlan.trim()}`]
      : []),
    ...(body.lookAheadWeekTwoPlan.trim()
      ? [`${body.lookAheadWeekTwoLabel || "Next Week"}: ${body.lookAheadWeekTwoPlan.trim()}`]
      : []),
    ...normalizeLines(body.occupantImpact).map((line) => `Occupant impact: ${line}`),
    ...normalizeLines(body.sapfCoordination).map((line) => `SAPF coordination: ${line}`),
  ];

  const partnerBullets = [
    ...normalizeLines(body.aesUpdate).map((line) => `AES: ${line}`),
    ...normalizeLines(body.greshamUpdate).map((line) => `Gresham Smith: ${line}`),
  ];

  const financialBullets = [
    `Contract value: ${formatCurrencyValue(body.contractValue)}.`,
    `Current report date: ${formatLongDate(body.reportDate)}.`,
    `Overall contract progress: ${progressPct.toFixed(1)}%.`,
    ...normalizeLines(body.financialNotes),
  ];

  const risks = Array.isArray(body.risks) ? body.risks.filter((risk) => risk.title.trim() || risk.mitigation.trim()) : [];

  return (
    <html lang="en">
      <body>
        <style>{`
          :root { color-scheme: light; }
          * { box-sizing: border-box; }
          @page {
            size: letter;
            margin: 0.8in 0.75in 0.9in 0.75in;

            @top-left {
              content: "The Controls Company, LLC";
              font-family: Arial, Helvetica, sans-serif;
              font-size: 8pt;
              color: #4b5563;
              vertical-align: bottom;
              padding-bottom: 6pt;
              border-bottom: 1pt solid #017a6f;
            }

            @top-right {
              content: "${customerProjectName(project.name).replace(/"/g, '\\"')} — Progress Report";
              font-family: Arial, Helvetica, sans-serif;
              font-size: 8pt;
              color: #4b5563;
              vertical-align: bottom;
              padding-bottom: 6pt;
              border-bottom: 1pt solid #017a6f;
            }

            @bottom-left {
              content: "thecontrolscompany.com  |  Service Disabled Veteran Owned Small Business";
              font-family: Arial, Helvetica, sans-serif;
              font-size: 7.5pt;
              color: #9ca3af;
              vertical-align: top;
              padding-top: 6pt;
            }

            @bottom-right {
              content: "Page " counter(page) " of " counter(pages);
              font-family: Arial, Helvetica, sans-serif;
              font-size: 8pt;
              color: #4b5563;
              vertical-align: top;
              padding-top: 6pt;
            }
          }
          body {
            margin: 0;
            background: #eef3f7;
            color: #111827;
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.45;
          }
          .page {
            max-width: 8.5in;
            margin: 16px auto 40px;
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08);
            overflow: hidden;
          }
          .print-actions {
            display: flex;
            justify-content: flex-end;
            padding: 14px 22px 0;
          }
          @media print {
            .print-actions { display: none; }
            .page {
              max-width: none;
              margin: 0;
              border-radius: 0;
              box-shadow: none;
            }
          }
          .report-header {
            background: linear-gradient(135deg, #1e3a5f 0%, #2d5fa3 100%);
            color: #fff;
            padding: 28px 34px 24px;
          }
          .report-header * { color: inherit; }
          .brand-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 18px;
          }
          .logo {
            width: 120px;
            height: 120px;
            object-fit: contain;
            flex-shrink: 0;
          }
          .brand-copy {
            flex: 1;
            text-align: center;
          }
          .brand-copy h1 {
            margin: 0 0 4px;
            font-size: 20px;
            letter-spacing: 0.04em;
          }
          .brand-copy p {
            margin: 0;
            font-size: 12px;
            opacity: 0.9;
          }
          .sdvosb-badge {
            width: 92px;
            height: 92px;
            object-fit: contain;
            flex-shrink: 0;
            border-radius: 50%;
            background: rgba(255,255,255,0.08);
            padding: 4px;
          }
          .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 24px;
          }
          .report-title { font-size: 24px; font-weight: 700; line-height: 1.15; }
          .report-subtitle { font-size: 14px; margin-top: 6px; opacity: 0.88; }
          .report-meta { text-align: right; font-size: 12px; line-height: 1.7; opacity: 0.9; }
          .header-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 16px;
          }
          .badge {
            border: 1px solid rgba(255,255,255,0.28);
            background: rgba(255,255,255,0.16);
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 700;
          }
          .report-body { padding: 28px 34px 32px; }
          .section { margin-bottom: 28px; }
          .section-title {
            margin-bottom: 12px;
            padding-bottom: 5px;
            border-bottom: 2px solid #1e3a5f;
            color: #1e3a5f;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          .metrics {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 18px;
          }
          .metric-card {
            border: 1px solid #dbe3ee;
            border-radius: 8px;
            background: #f8fbff;
            padding: 12px 14px;
          }
          .metric-label {
            color: #6b7280;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          .metric-value {
            margin-top: 6px;
            color: #1e3a5f;
            font-size: 20px;
            font-weight: 700;
          }
          .timeline-card {
            border: 1px solid #dbe3ee;
            border-radius: 8px;
            background: linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%);
            padding: 14px 16px;
          }
          .timeline-bar {
            margin-top: 12px;
            height: 14px;
            border-radius: 999px;
            background: #d9e2ec;
            overflow: hidden;
          }
          .timeline-fill {
            height: 100%;
            width: ${Math.max(0, Math.min(elapsedPct, 100)).toFixed(1)}%;
            background: linear-gradient(90deg, #1e3a5f 0%, #2563eb 100%);
          }
          .timeline-foot {
            display: flex;
            justify-content: space-between;
            gap: 18px;
            margin-top: 12px;
            color: #4b5563;
            font-size: 12px;
          }
          .bullet-list {
            margin: 0;
            padding-left: 18px;
          }
          .bullet-list li { margin: 0 0 8px; }
          .two-col {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
          }
          .subcard {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #fafcff;
            padding: 14px 16px;
          }
          .subcard h3 {
            margin: 0 0 10px;
            color: #1e3a5f;
            font-size: 13px;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th {
            background: #1e3a5f;
            color: #fff;
            padding: 8px 10px;
            text-align: left;
            font-size: 11px;
          }
          td {
            border-bottom: 1px solid #e5e7eb;
            padding: 8px 10px;
            vertical-align: top;
          }
          .risk-pill {
            display: inline-flex;
            border-radius: 999px;
            padding: 3px 8px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .risk-high { background: #fee2e2; color: #991b1b; }
          .risk-medium { background: #fef3c7; color: #92400e; }
          .risk-low { background: #dcfce7; color: #166534; }
          .footer {
            margin-top: 24px;
            padding-top: 14px;
            border-top: 2px solid #017a6f;
            text-align: center;
            font-size: 12px;
            color: #4b5563;
          }
          .footer-note {
            margin-top: 6px;
            color: #6b7280;
            font-size: 11px;
          }
          @media print {
            .footer {
              display: none;
            }
          }
        `}</style>

        <div className="page">
          <PrintButton documentTitle={reportTitle} />

          <header className="report-header">
            <div className="brand-row">
              <img src="/logo.png" alt="The Controls Company" className="logo" />
              <div className="brand-copy">
                <h1>THE CONTROLS COMPANY, LLC</h1>
                <p>Service Disabled Veteran Owned Small Business</p>
              </div>
              <img src="/sdvosb.jpg" alt="SDVOSB badge" className="sdvosb-badge" />
            </div>
            <div className="header-top">
              <div>
                <div className="report-title">Project Progress Report</div>
                <div className="report-subtitle">Upgrade DDC Devices - Eglin AFB Building 1416</div>
              </div>
              <div className="report-meta">
                <div><strong>Report Date:</strong> {formatLongDate(body.reportDate)}</div>
                <div><strong>Status Date:</strong> {formatLongDate(body.statusDate)}</div>
                <div><strong>Report Period:</strong> {body.periodCovered}</div>
                {project.job_number && <div><strong>Job No.:</strong> {project.job_number}</div>}
              </div>
            </div>
            <div className="header-badges">
              <span className="badge">Prime Contractor: TCC</span>
              <span className="badge">Customer: {customer?.name ?? "Unknown"}</span>
              <span className="badge">Contract Value: {formatCurrencyValue(body.contractValue)}</span>
              <span className="badge">Contract Start: {formatShortDate(body.contractStart)}</span>
              <span className="badge">Completion: {formatShortDate(body.contractCompletion)}</span>
            </div>
          </header>

          <main className="report-body">
            <section className="section">
              <div className="metrics">
                <div className="metric-card">
                  <div className="metric-label">Overall Progress</div>
                  <div className="metric-value">{progressPct.toFixed(1)}%</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Elapsed Time</div>
                  <div className="metric-value">{elapsedPct.toFixed(1)}%</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Elapsed Days</div>
                  <div className="metric-value">{elapsedDays}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Remaining Days</div>
                  <div className="metric-value">{remainingDays}</div>
                </div>
              </div>

              <div className="timeline-card">
                <div className="section-title" style={{ borderBottom: "none", marginBottom: "2px", paddingBottom: 0 }}>
                  Contract Duration
                </div>
                <div className="timeline-bar">
                  <div className="timeline-fill" />
                </div>
                <div className="timeline-foot">
                  <div><strong>{elapsedDays} days elapsed</strong> of {totalDays} calendar days</div>
                  <div><strong>{remainingDays} days remaining</strong> to contract completion</div>
                </div>
              </div>
            </section>

            <section className="section">
              <div className="section-title">1. Executive Summary</div>
              <ul className="bullet-list">
                {executiveBullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="section">
              <div className="section-title">2. Two-Week Look-Ahead</div>
              <ul className="bullet-list">
                {lookAheadBullets.length > 0 ? (
                  lookAheadBullets.map((item) => <li key={item}>{item}</li>)
                ) : (
                  <li>Two-week look-ahead has not been entered yet.</li>
                )}
              </ul>
            </section>

            <section className="section">
              <div className="section-title">3. Subcontractor and Partner Updates</div>
              <div className="two-col">
                <div className="subcard">
                  <h3>AES / Controls Hardware</h3>
                  <ul className="bullet-list">
                    {normalizeLines(body.aesUpdate).length > 0 ? (
                      normalizeLines(body.aesUpdate).map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li>No AES update entered yet.</li>
                    )}
                  </ul>
                </div>
                <div className="subcard">
                  <h3>Gresham Smith / Commissioning</h3>
                  <ul className="bullet-list">
                    {normalizeLines(body.greshamUpdate).length > 0 ? (
                      normalizeLines(body.greshamUpdate).map((item) => <li key={item}>{item}</li>)
                    ) : (
                      <li>No commissioning update entered yet.</li>
                    )}
                  </ul>
                </div>
              </div>
            </section>

            <section className="section">
              <div className="section-title">4. Financial and Progress Notes</div>
              <ul className="bullet-list">
                {financialBullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <section className="section">
              <div className="section-title">5. Open Items and Risk Register</div>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Severity</th>
                    <th>Target Date</th>
                    <th>Current Mitigation</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.length > 0 ? (
                    risks.map((risk) => (
                      <tr key={risk.id}>
                        <td>{risk.title || "Open item"}</td>
                        <td>
                          <span className={`risk-pill risk-${risk.level}`}>
                            {riskLabel(risk.level)}
                          </span>
                        </td>
                        <td>{risk.dueDate ? formatShortDate(risk.dueDate) : "Not set"}</td>
                        <td>{risk.mitigation || "Pending update"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>No open items or risks were entered for this packet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="section">
              <div className="section-title">6. Project Reference</div>
              <div className="two-col">
                <div className="subcard">
                  <h3>Project Information</h3>
                  <ul className="bullet-list">
                    <li>Project: {customerProjectName(project.name)}</li>
                    {project.site_address && <li>Site Address: {project.site_address}</li>}
                    {project.general_contractor && <li>General Contractor: {project.general_contractor}</li>}
                    <li>Packet Date: {formatLongDate(packet.packet_date)}</li>
                  </ul>
                </div>
                <div className="subcard">
                  <h3>Prepared From Packet</h3>
                  <ul className="bullet-list">
                    <li>Saved packet title: {packet.title}</li>
                    <li>Generated report date: {formatLongDate(body.reportDate)}</li>
                    <li>Status basis date: {formatLongDate(body.statusDate)}</li>
                  </ul>
                </div>
              </div>
            </section>

            <footer className="footer">
              <div>The Controls Company, LLC | thecontrolscompany.com</div>
              <div>Service Disabled Veteran Owned Small Business</div>
              <div className="footer-note">Prepared from the saved Eglin 1416 report packet in ProjectHub.</div>
            </footer>
          </main>
        </div>
      </body>
    </html>
  );
}

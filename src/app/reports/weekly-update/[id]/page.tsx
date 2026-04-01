export const dynamic = "force-dynamic";

import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/app/reports/weekly-update/[id]/PrintButton";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import type { CrewLogEntry, PocSnapshotEntry, UserRole } from "@/types/database";

type PageProps = {
  params: Promise<{ id: string }>;
};

type UpdateRow = {
  id: string;
  project_id: string;
  pm_id: string | null;
  week_of: string;
  pct_complete: number | null;
  notes: string | null;
  blockers: string | null;
  poc_snapshot: PocSnapshotEntry[] | null;
  crew_log: CrewLogEntry[] | null;
  material_delivered: string | null;
  equipment_set: string | null;
  safety_incidents: string | null;
  inspections_tests: string | null;
  delays_impacts: string | null;
  other_remarks: string | null;
  submitted_at: string | null;
  project?:
    | {
        id: string;
        name: string;
        job_number: string | null;
        site_address: string | null;
        general_contractor: string | null;
        customer_poc: string | null;
        customer?: { name: string | null } | Array<{ name: string | null }> | null;
      }
    | Array<{
        id: string;
        name: string;
        job_number: string | null;
        site_address: string | null;
        general_contractor: string | null;
        customer_poc: string | null;
        customer?: { name: string | null } | Array<{ name: string | null }> | null;
      }>
    | null;
  pm?: { full_name: string | null; email: string | null } | Array<{ full_name: string | null; email: string | null }> | null;
};

type AssignmentPmRow = {
  profile?: { full_name: string | null; email: string | null } | Array<{ full_name: string | null; email: string | null }> | null;
  pm_directory?:
    | { first_name: string | null; last_name: string | null; email: string }
    | Array<{ first_name: string | null; last_name: string | null; email: string }>
    | null;
};

function normalizeSingle<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function emptyCrewLog(): CrewLogEntry[] {
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => ({
    day,
    men: 0,
    hours: 0,
    activities: "",
  })) as CrewLogEntry[];
}

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "0.0%" : `${(value * 100).toFixed(1)}%`;
}

function formatDate(value: string | null | undefined, fallback = "Not submitted") {
  if (!value) return fallback;
  return format(new Date(value), "MMMM d, yyyy");
}

function coalesceText(value: string | null | undefined, fallback = "None") {
  return value && value.trim() ? value : fallback;
}

async function canAccessReport(supabase: Awaited<ReturnType<typeof createClient>>, role: UserRole, userId: string, projectId: string) {
  if (role === "admin" || role === "ops_manager") {
    return true;
  }

  if (role === "pm" || role === "lead") {
    const { data } = await supabase
      .from("project_assignments")
      .select("id")
      .eq("project_id", projectId)
      .eq("profile_id", userId)
      .in("role_on_project", ["pm", "lead"])
      .maybeSingle();

    return Boolean(data);
  }

  if (role === "customer") {
    const { data } = await supabase
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

async function resolvePmName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  submittedPm: UpdateRow["pm"]
) {
  const pmProfile = normalizeSingle(submittedPm);
  if (pmProfile?.full_name?.trim()) {
    return pmProfile.full_name.trim();
  }
  if (pmProfile?.email?.trim()) {
    return pmProfile.email.trim();
  }

  const { data } = await supabase
    .from("project_assignments")
    .select("profile:profiles(full_name, email), pm_directory:pm_directory(first_name, last_name, email)")
    .eq("project_id", projectId)
    .eq("role_on_project", "pm")
    .limit(1)
    .maybeSingle();

  const assignment = data as AssignmentPmRow | null;
  const assignmentProfile = normalizeSingle(assignment?.profile);
  if (assignmentProfile?.full_name?.trim()) {
    return assignmentProfile.full_name.trim();
  }
  if (assignmentProfile?.email?.trim()) {
    return assignmentProfile.email.trim();
  }

  const directory = normalizeSingle(assignment?.pm_directory);
  const fullName = [directory?.first_name, directory?.last_name].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }
  if (directory?.email?.trim()) {
    return directory.email.trim();
  }

  return "The Controls Company";
}

export default async function WeeklyUpdateReportPage({ params }: PageProps) {
  const { id } = await params;

  // Auth check — cookie client only for session verification
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Use service-role client for all data fetching (avoids RLS issues with SSO sessions)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const resolvedProfile = await resolveUserRole(user);
  const role = (resolvedProfile?.role ?? "customer") as UserRole;

  const { data: updateLookup } = await admin
    .from("weekly_updates")
    .select("id, project_id")
    .eq("id", id)
    .maybeSingle();

  if (!updateLookup?.project_id) {
    notFound();
  }

  const allowed = await canAccessReport(admin, role, user.id, updateLookup.project_id);
  if (!allowed) {
    redirect("/login");
  }

  const { data } = await admin
    .from("weekly_updates")
    .select(`
      id,
      project_id,
      pm_id,
      week_of,
      pct_complete,
      notes,
      blockers,
      poc_snapshot,
      crew_log,
      material_delivered,
      equipment_set,
      safety_incidents,
      inspections_tests,
      delays_impacts,
      other_remarks,
      submitted_at,
      pm:profiles(full_name, email),
      project:projects(
        id,
        name,
        job_number,
        site_address,
        general_contractor,
        customer_poc,
        customer:customers(name)
      )
    `)
    .eq("id", id)
    .maybeSingle();

  const update = data as UpdateRow | null;
  if (!update) {
    notFound();
  }

  const project = normalizeSingle(update.project);
  if (!project) {
    notFound();
  }

  const customer = normalizeSingle(project.customer);
  const pmName = await resolvePmName(admin, project.id, update.pm);

  const crewLog = update.crew_log && update.crew_log.length > 0 ? update.crew_log : emptyCrewLog();
  const totalManHours = crewLog.reduce((sum, row) => sum + (Number(row.men) || 0) * (Number(row.hours) || 0), 0);
  const pocSnapshot = Array.isArray(update.poc_snapshot) ? update.poc_snapshot : [];
  const totalWeight = pocSnapshot.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);

  return (
    <html lang="en">
      <body>
        <style>{`
          :root {
            color-scheme: light;
            --tw-prose-body: #111827;
          }

          * {
            box-sizing: border-box;
          }

          @page {
            size: letter;
            margin: 0.75in;
          }

          body {
            margin: 0;
            background: #f4f7f6 !important;
            color: #111827 !important;
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.4;
          }

          body, body * {
            color: #111827;
          }

          .page {
            max-width: 8in;
            margin: 0 auto;
            padding: 24px;
          }

          .print-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-bottom: 18px;
          }

          .print-actions button {
            border: 1px solid #d1d5db;
            background: #ffffff;
            color: #111827;
            border-radius: 999px;
            padding: 10px 16px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          }

          .print-actions button:hover {
            border-color: #017a6f;
            color: #017a6f;
          }

          .report {
            background: #ffffff;
            padding: 28px;
            border: 1px solid #d1d5db;
          }

          .brand-row {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .logo {
            width: 120px;
            height: 120px;
            object-fit: contain;
          }

          .badge {
            width: 120px;
            height: 120px;
            object-fit: contain;
            border: 1px solid #d1d5db;
          }

          .brand-copy h1 {
            margin: 12px 0 4px;
            font-size: 20px;
            color: #017a6f;
            letter-spacing: 0.04em;
          }

          .brand-copy p {
            margin: 0;
            font-size: 12px;
            color: #4b5563;
          }

          .section-divider {
            margin: 22px 0 14px;
            padding-bottom: 8px;
            border-bottom: 2px solid #017a6f;
          }

          .section-divider h2 {
            margin: 0;
            font-size: 16px;
            color: #017a6f;
            letter-spacing: 0.08em;
          }

          .report-title {
            margin: 18px 0 0;
            text-align: center;
            font-size: 22px;
            color: #111827;
            letter-spacing: 0.08em;
          }

          .meta-grid {
            display: grid;
            grid-template-columns: 180px 1fr;
            gap: 8px 14px;
            margin-top: 18px;
            font-size: 14px;
          }

          .meta-label {
            font-weight: 700;
            color: #374151;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th,
          td {
            border: 1px solid #d1d5db;
            padding: 8px 10px;
            vertical-align: top;
            font-size: 13px;
          }

          thead th {
            background: #eef8f6;
            color: #0f172a;
            text-align: left;
            font-size: 12px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .number-cell {
            text-align: center;
            white-space: nowrap;
          }

          .summary-line {
            margin-top: 10px;
            font-size: 14px;
            font-weight: 700;
            text-align: right;
          }

          .notes-grid {
            display: grid;
            gap: 10px;
          }

          .notes-row {
            display: grid;
            grid-template-columns: 180px 1fr;
            gap: 14px;
            font-size: 14px;
          }

          .notes-label {
            font-weight: 700;
            color: #374151;
          }

          .callout {
            margin-top: 14px;
            padding: 12px 14px;
            border: 1px solid #d1d5db;
            background: #fafafa;
            font-size: 14px;
            white-space: pre-wrap;
          }

          .footer {
            margin-top: 24px;
            padding-top: 14px;
            border-top: 2px solid #017a6f;
            text-align: center;
            font-size: 12px;
            color: #4b5563;
          }

          @media print {
            body {
              background: #ffffff;
            }

            .no-print {
              display: none !important;
            }

            .page {
              max-width: none;
              margin: 0;
              padding: 0;
            }

            .report {
              border: 0;
              padding: 0;
            }
          }
        `}</style>

        <main className="page">
          <PrintButton />

          <article className="report">
            <div className="brand-row">
              <div className="brand-copy">
                <img src="/logo.png" alt="The Controls Company" className="logo" />
                <h1>THE CONTROLS COMPANY, LLC</h1>
                <p>Service Disabled Veteran Owned Small Business</p>
              </div>
              <img src="/sdvosb.jpg" alt="SDVOSB badge" className="badge" />
            </div>

            <div className="section-divider">
              <h2>WEEKLY CONSTRUCTION REPORT</h2>
            </div>

            <div className="meta-grid">
              <div className="meta-label">Company Name:</div>
              <div>The Controls Company, LLC</div>
              <div className="meta-label">Project Name:</div>
              <div>{project.name}</div>
              <div className="meta-label">Job Number:</div>
              <div>{project.job_number || "Not assigned"}</div>
              <div className="meta-label">Site Address:</div>
              <div>{project.site_address || "Not provided"}</div>
              <div className="meta-label">Customer:</div>
              <div>{customer?.name || "Not provided"}</div>
              <div className="meta-label">Project Manager:</div>
              <div>{pmName}</div>
              <div className="meta-label">Customer POC:</div>
              <div>{project.customer_poc || "Not provided"}</div>
              <div className="meta-label">General Contractor:</div>
              <div>{project.general_contractor || "Not provided"}</div>
              <div className="meta-label">Report Date:</div>
              <div>{formatDate(update.week_of)}</div>
            </div>

            <div className="section-divider">
              <h2>CREW LOG</h2>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th className="number-cell"># of Men</th>
                  <th className="number-cell">Hours</th>
                  <th>Activities</th>
                </tr>
              </thead>
              <tbody>
                {crewLog.map((row) => (
                  <tr key={row.day}>
                    <td>{row.day}</td>
                    <td className="number-cell">{row.men || ""}</td>
                    <td className="number-cell">{row.hours || ""}</td>
                    <td>{row.activities || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="summary-line">Total Man-Hours: {totalManHours.toFixed(1)}</div>

            <div className="section-divider">
              <h2>NOTES</h2>
            </div>

            <div className="notes-grid">
              <div className="notes-row">
                <div className="notes-label">Material Delivered:</div>
                <div>{coalesceText(update.material_delivered)}</div>
              </div>
              <div className="notes-row">
                <div className="notes-label">Equipment Set:</div>
                <div>{coalesceText(update.equipment_set)}</div>
              </div>
              <div className="notes-row">
                <div className="notes-label">Safety Incidents:</div>
                <div>{coalesceText(update.safety_incidents)}</div>
              </div>
              <div className="notes-row">
                <div className="notes-label">Inspections & Tests:</div>
                <div>{coalesceText(update.inspections_tests)}</div>
              </div>
              <div className="notes-row">
                <div className="notes-label">Delays / Impacts:</div>
                <div>{coalesceText(update.delays_impacts)}</div>
              </div>
              <div className="notes-row">
                <div className="notes-label">Other Remarks:</div>
                <div>{coalesceText(update.other_remarks, "") || " "}</div>
              </div>
            </div>

            <div className="section-divider">
              <h2>PROGRESS</h2>
            </div>

            <div className="notes-row">
              <div className="notes-label">Overall % Complete:</div>
              <div>{formatPercent(update.pct_complete)}</div>
            </div>

            {pocSnapshot.length > 0 && (
              <>
                <div style={{ height: 12 }} />
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th className="number-cell">Weight</th>
                      <th className="number-cell">% Complete</th>
                      <th className="number-cell">Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pocSnapshot.map((item) => {
                      const contribution =
                        totalWeight > 0 ? ((item.weight * item.pct_complete) / totalWeight) * 100 : item.pct_complete * 100;

                      return (
                        <tr key={item.id}>
                          <td>{item.category}</td>
                          <td className="number-cell">{item.weight}</td>
                          <td className="number-cell">{(item.pct_complete * 100).toFixed(1)}%</td>
                          <td className="number-cell">{contribution.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}

            <div className="callout">
              <strong>Blockers / Items Requiring Attention:</strong>
              {"\n"}
              {coalesceText(update.blockers)}
            </div>

            <div className="callout">
              <strong>General Notes:</strong>
              {"\n"}
              {coalesceText(update.notes, "") || " "}
            </div>

            <footer className="footer">
              <div>The Controls Company, LLC | thecontrolsco.com</div>
              <div>Service Disabled Veteran Owned Small Business</div>
              <div>Submitted: {formatDate(update.submitted_at)}</div>
            </footer>
          </article>
        </main>
      </body>
    </html>
  );
}

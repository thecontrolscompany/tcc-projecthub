export const dynamic = "force-dynamic";

import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/app/reports/weekly-update/[id]/PrintButton";
import {
  canReadChangeOrders,
  changeOrderStatusLabel,
  getChangeOrderRequestContext,
  loadProjectChangeOrders,
} from "@/lib/change-orders/server";
import { normalizeSingle } from "@/lib/utils/normalize";
import { fmtCurrency } from "@/lib/utils/format";
import type { Project } from "@/types/database";

type PageProps = {
  searchParams: Promise<{
    projectId?: string;
  }>;
};

type ProjectRow = Pick<Project, "id" | "name" | "job_number"> & {
  customer?: { name: string | null } | Array<{ name: string | null }> | null;
};

const VISIBLE_STATUSES = new Set([
  "submitted",
  "in_review",
  "approved",
  "executed",
  "billed",
  "paid",
  "rejected",
]);

function customerProjectName(name: string | null | undefined) {
  return (name ?? "").replace(/^\d{4}-\d{3}\s*-\s*/, "").trim() || (name ?? "");
}

function fileSafeName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return format(new Date(value), "MMM d, yyyy");
  } catch {
    return value;
  }
}

export default async function CustomerChangeOrdersReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const projectId = params.projectId;

  if (!projectId) {
    notFound();
  }

  const context = await getChangeOrderRequestContext();
  if (!context.ok) {
    redirect("/login");
  }

  const allowed = await canReadChangeOrders(context.adminClient, projectId, context.user.id, context.role);
  if (!allowed) {
    redirect("/login");
  }

  const { data: projectRow, error: projectError } = await context.adminClient
    .from("projects")
    .select("id, name, job_number, customer:customers(name)")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    throw new Error(projectError.message);
  }

  if (!projectRow) {
    notFound();
  }

  const project = projectRow as ProjectRow;
  const customer = normalizeSingle(project.customer);

  const allChangeOrders = await loadProjectChangeOrders(context.adminClient, projectId, context.role);
  const changeOrders = allChangeOrders.filter((changeOrder) => VISIBLE_STATUSES.has(changeOrder.status));

  const generatedAt = new Date();
  const printableTitle = fileSafeName(`${customerProjectName(project.name)} - Change Order Log`);
  const requestedTotal = changeOrders.reduce(
    (sum, co) => sum + (co.requested_amount ?? co.amount ?? 0),
    0
  );
  const approvedTotal = changeOrders.reduce((sum, co) => sum + (co.approved_amount ?? 0), 0);

  return (
    <html lang="en">
      <body>
        <style>{`
          :root {
            color-scheme: light;
          }

          * {
            box-sizing: border-box;
          }

          @page {
            size: letter;
            margin: 1in 0.75in 0.9in 0.75in;

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
              content: "${customerProjectName(project.name).replace(/"/g, '\\"')} — Change Order Log";
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
            overflow: visible;
          }

          .brand-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }

          .logo {
            width: 160px;
            height: 160px;
            object-fit: contain;
          }

          .badge {
            width: 120px;
            height: 120px;
            object-fit: contain;
          }

          .brand-copy {
            flex: 1;
            text-align: center;
          }

          .brand-copy h1 {
            margin: 0 0 4px;
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

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin: 18px 0;
          }

          .summary-card {
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 12px 14px;
            text-align: center;
          }

          .summary-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b7280;
            margin-bottom: 4px;
          }

          .summary-value {
            font-size: 17px;
            font-weight: 700;
            color: #017a6f;
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
            text-align: right;
            white-space: nowrap;
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
          <div className="no-print">
            <PrintButton documentTitle={printableTitle} />
          </div>

          <article className="report">
            <div className="brand-row">
              <img src="/logo.png" alt="The Controls Company" className="logo" />
              <div className="brand-copy">
                <h1>THE CONTROLS COMPANY, LLC</h1>
                <p>Service Disabled Veteran Owned Small Business</p>
              </div>
              <img src="/sdvosb.jpg" alt="SDVOSB badge" className="badge" />
            </div>

            <div className="section-divider">
              <h2>CHANGE ORDER LOG</h2>
            </div>

            <div className="meta-grid">
              <div className="meta-label">Company Name:</div>
              <div>The Controls Company, LLC</div>
              <div className="meta-label">Project Name:</div>
              <div>{customerProjectName(project.name)}</div>
              <div className="meta-label">Job #:</div>
              <div>{project.job_number ?? "Not provided"}</div>
              <div className="meta-label">Customer:</div>
              <div>{customer?.name || "Not provided"}</div>
              <div className="meta-label">Report Date:</div>
              <div>{format(generatedAt, "MMMM d, yyyy")}</div>
            </div>

            <div className="section-divider">
              <h2>CHANGE ORDERS</h2>
            </div>

            <table>
              <thead>
                <tr>
                  <th>CO #</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Reference</th>
                  <th className="number-cell">Amount</th>
                </tr>
              </thead>
              <tbody>
                {changeOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No change orders have been recorded for this project yet.</td>
                  </tr>
                ) : (
                  changeOrders.map((changeOrder) => {
                    const amount = changeOrder.requested_amount ?? changeOrder.amount ?? 0;
                    return (
                      <tr key={changeOrder.id}>
                        <td>{changeOrder.co_number || "—"}</td>
                        <td>{changeOrder.title}</td>
                        <td>{changeOrderStatusLabel(changeOrder.status)}</td>
                        <td>{formatDate(changeOrder.submitted_at ?? changeOrder.submitted_date)}</td>
                        <td>{changeOrder.reference_doc ?? "—"}</td>
                        <td className="number-cell" style={amount < 0 ? { color: "#dc2626" } : undefined}>
                          {fmtCurrency(amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div className="summary-grid">
              <div className="summary-card">
                <div className="summary-label">Total Requested</div>
                <div className="summary-value">{fmtCurrency(requestedTotal)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Total Approved</div>
                <div className="summary-value">{fmtCurrency(approvedTotal)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Total Outstanding</div>
                <div className="summary-value">{fmtCurrency(requestedTotal - approvedTotal)}</div>
              </div>
            </div>

            <footer className="footer">
              <div>The Controls Company, LLC | thecontrolscompany.com</div>
              <div>Service Disabled Veteran Owned Small Business</div>
            </footer>
          </article>
        </main>
      </body>
    </html>
  );
}

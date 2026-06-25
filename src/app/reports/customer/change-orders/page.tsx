export const dynamic = "force-dynamic";

import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/app/reports/weekly-update/[id]/PrintButton";
import {
  canReadChangeOrders,
  changeOrderStatusLabel,
  displayChangeOrderNumber,
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

const CUSTOMER_VISIBLE_STATUSES = new Set([
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
  const changeOrders =
    context.role === "customer"
      ? allChangeOrders.filter((changeOrder) => CUSTOMER_VISIBLE_STATUSES.has(changeOrder.status))
      : allChangeOrders;

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
          :root { color-scheme: light; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #f4f7f6 !important;
            color: #111827 !important;
            font-family: Arial, Helvetica, sans-serif;
          }
          body, body * {
            color: #111827;
          }
          @page {
            size: letter;
            margin: 0.75in 0.6in 0.7in 0.6in;
            @top-left {
              content: "The Controls Company, LLC";
              font-size: 8pt;
              color: #4b5563;
              border-bottom: 1pt solid #017a6f;
              padding-bottom: 6pt;
            }
            @top-right {
              content: "${customerProjectName(project.name).replace(/"/g, '\\"')} - Change Order Log";
              font-size: 8pt;
              color: #4b5563;
              border-bottom: 1pt solid #017a6f;
              padding-bottom: 6pt;
            }
            @bottom-left {
              content: "thecontrolscompany.com | Service Disabled Veteran Owned Small Business";
              font-size: 7.5pt;
              color: #9ca3af;
              padding-top: 6pt;
            }
            @bottom-right {
              content: "Page " counter(page) " of " counter(pages);
              font-size: 8pt;
              color: #4b5563;
              padding-top: 6pt;
            }
          }
          .page {
            max-width: 1100px;
            margin: 0 auto;
            padding: 24px 24px 40px;
          }
          .card {
            border: 1px solid #d7dfde;
            border-radius: 18px;
            background: #ffffff;
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            align-items: flex-start;
            margin-bottom: 20px;
          }
          .label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b7280;
            font-weight: 700;
          }
          .header-title {
            font-size: 26px;
            margin: 8px 0 10px;
            line-height: 1.1;
          }
          .header-meta {
            font-size: 14px;
            color: #4b5563;
            line-height: 1.5;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
            margin-top: 18px;
          }
          .summary-card {
            border: 1px solid #dfe7e6;
            border-radius: 16px;
            padding: 16px;
            background: linear-gradient(180deg, #ffffff, #f8fbfb);
          }
          .summary-value {
            margin-top: 8px;
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
          }
          .table-wrap {
            overflow: auto;
            border-radius: 16px;
            border: 1px solid #d7dfde;
            margin-top: 22px;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
          }
          .table thead th {
            background: #f8fafc;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b7280;
            text-align: left;
            padding: 12px 10px;
            border-bottom: 1px solid #d7dfde;
          }
          .table td {
            vertical-align: top;
            padding: 12px 10px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 13px;
          }
          .muted {
            color: #6b7280;
            font-size: 12px;
          }
          .badge {
            display: inline-flex;
            align-items: center;
            padding: 5px 10px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
          }
          .badge-submitted { background: rgba(59, 130, 246, 0.12); color: #2563eb; }
          .badge-in_review { background: rgba(245, 158, 11, 0.12); color: #b45309; }
          .badge-approved { background: rgba(16, 185, 129, 0.12); color: #047857; }
          .badge-rejected { background: rgba(239, 68, 68, 0.12); color: #b91c1c; }
          .badge-executed { background: rgba(22, 163, 74, 0.12); color: #15803d; }
          .badge-billed { background: rgba(79, 70, 229, 0.12); color: #4338ca; }
          .badge-paid { background: rgba(34, 197, 94, 0.12); color: #15803d; }
          .footer-note {
            margin-top: 14px;
            font-size: 12px;
            color: #6b7280;
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
            border-radius: 10px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
          }
          .print-actions button:hover {
            border-color: #017a6f;
            color: #017a6f;
          }
          @media print {
            body { background: #ffffff; }
            .no-print { display: none !important; }
          }
        `}</style>
        <main className="page">
          <div className="print-actions no-print">
            <PrintButton documentTitle={printableTitle} />
          </div>

          <header className="card" style={{ padding: 24 }}>
            <div className="header-row">
              <div>
                <p className="label">The Controls Company, LLC</p>
                <h1 className="header-title">{customerProjectName(project.name)} — Change Order Log</h1>
                <div className="header-meta">
                  <div>Project: {customerProjectName(project.name)}</div>
                  <div>Job #: {project.job_number ?? "—"}</div>
                  <div>Customer: {customer?.name ?? "—"}</div>
                </div>
              </div>
            </div>

            <div className="summary-grid">
              <div className="summary-card">
                <div className="label">Change orders</div>
                <div className="summary-value">{changeOrders.length}</div>
              </div>
              <div className="summary-card">
                <div className="label">Requested total</div>
                <div className="summary-value">{fmtCurrency(requestedTotal)}</div>
              </div>
              <div className="summary-card">
                <div className="label">Approved total</div>
                <div className="summary-value">{fmtCurrency(approvedTotal)}</div>
              </div>
            </div>
          </header>

          <div className="table-wrap card">
            <table className="table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ textAlign: "center" }}>Days</th>
                  <th>Submitted</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {changeOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 18, color: "#6b7280" }}>
                      No change orders have been recorded for this project yet.
                    </td>
                  </tr>
                ) : (
                  changeOrders.map((changeOrder) => (
                    <tr key={changeOrder.id}>
                      <td style={{ fontWeight: 700 }}>{displayChangeOrderNumber(changeOrder)}</td>
                      <td>{changeOrder.title}</td>
                      <td>
                        <span className={`badge badge-${changeOrder.status}`}>
                          {changeOrderStatusLabel(changeOrder.status)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {fmtCurrency(changeOrder.requested_amount ?? changeOrder.amount ?? 0)}
                      </td>
                      <td style={{ textAlign: "center" }}>{changeOrder.requested_days ?? 0}</td>
                      <td className="muted">{formatDate(changeOrder.submitted_at ?? changeOrder.submitted_date)}</td>
                      <td className="muted">{changeOrder.reference_doc ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="footer-note">
            Generated {format(new Date(), "MMMM d, yyyy h:mm a")}.
          </p>
        </main>
      </body>
    </html>
  );
}

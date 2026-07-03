export const dynamic = "force-dynamic";

import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/app/reports/weekly-update/[id]/PrintButton";
import {
  canReadChangeOrders,
  changeOrderStatusLabel,
  displayChangeOrderNumber,
  getChangeOrderRequestContext,
  loadChangeOrderBundle,
} from "@/lib/change-orders/server";
import { normalizeSingle } from "@/lib/utils/normalize";

type PageProps = {
  params: Promise<{ id: string }>;
};

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return format(new Date(value), "MMMM d, yyyy");
  } catch {
    return value;
  }
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return null;
  try {
    return format(new Date(value), "MMMM d, yyyy h:mm a");
  } catch {
    return value;
  }
}

function customerProjectName(name: string | null | undefined) {
  return (name ?? "").replace(/^\d{4}-\d{3}\s*-\s*/, "").trim() || (name ?? "");
}

function fileSafeName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
}

function lineItemDetails(item: {
  category: string;
  role: string | null;
  people_count: number | null;
  hours_per_person: number | null;
  days: number | null;
  hourly_rate: number | null;
  quantity: number | null;
  unit: string | null;
  unit_cost: number | null;
  lump_sum: number | null;
  markup_percent: number;
  base_amount: number;
}) {
  if (item.category === "labor") {
    const people = item.people_count ?? 0;
    const hours = item.hours_per_person ?? 0;
    const days = item.days ?? 0;
    const rate = item.hourly_rate ?? 0;
    return [
      item.role ? `Role: ${item.role}` : null,
      `Crew: ${people} people`,
      `Hours/Person: ${hours}`,
      `Days: ${days}`,
      `Rate: ${fmtCurrency(rate)}`,
      `Base: ${fmtCurrency(item.base_amount)}`,
      `Markup: ${item.markup_percent.toFixed(2)}%`,
    ]
      .filter(Boolean)
      .join(" | ");
  }

  if (item.category === "material") {
    const qty = item.quantity ?? 0;
    const unit = item.unit?.trim() || "ea";
    const unitCost = item.unit_cost ?? 0;
    return [
      `Qty: ${qty} ${unit}`,
      `Unit Cost: ${fmtCurrency(unitCost)}`,
      `Base: ${fmtCurrency(item.base_amount)}`,
      `Markup: ${item.markup_percent.toFixed(2)}%`,
    ].join(" | ");
  }

  const qtyText = item.quantity != null ? `Qty: ${item.quantity}` : null;
  const costText = item.lump_sum != null
    ? `Lump Sum: ${fmtCurrency(item.lump_sum)}`
    : item.unit_cost != null
      ? `Unit Cost: ${fmtCurrency(item.unit_cost)}`
      : null;

  return [qtyText, costText, `Base: ${fmtCurrency(item.base_amount)}`, `Markup: ${item.markup_percent.toFixed(2)}%`]
    .filter(Boolean)
    .join(" | ");
}

function attachmentLabel(kind: string) {
  switch (kind) {
    case "backup":
      return "Backup";
    case "supporting":
      return "Supporting";
    case "photo":
      return "Photo";
    case "pdf":
      return "PDF";
    case "signed":
      return "Signed";
    case "customer":
      return "Customer";
    default:
      return kind;
  }
}

function milestoneLabel(key: string) {
  switch (key) {
    case "submitted_at":
      return "Submitted";
    case "approved_at":
      return "Approved";
    case "executed_at":
      return "Executed";
    case "billed_at":
      return "Billed";
    case "paid_at":
      return "Paid";
    case "voided_at":
      return "Voided";
    case "rejected_at":
      return "Rejected";
    case "superseded_at":
      return "Superseded";
    case "combined_at":
      return "Combined";
    default:
      return key;
  }
}

export default async function ChangeOrderReportPage({ params }: PageProps) {
  const { id } = await params;
  const context = await getChangeOrderRequestContext();
  if (!context.ok) redirect("/login");

  const { data: lookup, error: lookupError } = await context.adminClient
    .from("change_orders")
    .select("id, project_id")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!lookup?.project_id) notFound();

  const allowed = await canReadChangeOrders(context.adminClient, lookup.project_id, context.user.id, context.role);
  if (!allowed) redirect("/login");

  const bundle = await loadChangeOrderBundle(context.adminClient, id, context.role);
  if (!bundle) notFound();

  const changeOrder = bundle.change_order;

  if (changeOrder.reference_doc) {
    redirect(changeOrder.reference_doc);
  }

  const project = normalizeSingle(bundle.project ?? changeOrder.project);
  if (!project) notFound();

  const customer = normalizeSingle(project.customer);
  const printableTitle = fileSafeName(
    `${customerProjectName(project.name)} - Change Order - ${displayChangeOrderNumber(changeOrder)}`
  );
  const now = new Date();
  const timeline = [
    { key: "submitted_at", value: changeOrder.submitted_at },
    { key: "approved_at", value: changeOrder.approved_at },
    { key: "executed_at", value: changeOrder.executed_at },
    { key: "billed_at", value: changeOrder.billed_at },
    { key: "paid_at", value: changeOrder.paid_at },
    { key: "voided_at", value: changeOrder.voided_at },
    { key: "rejected_at", value: changeOrder.rejected_at },
    { key: "superseded_at", value: changeOrder.superseded_at },
    { key: "combined_at", value: changeOrder.combined_at },
  ].filter((entry) => Boolean(entry.value));

  const totalRequested = bundle.summary.requested_amount || changeOrder.requested_amount || changeOrder.amount;
  const totalApproved = bundle.summary.approved_amount || changeOrder.approved_amount || 0;
  const internalVisible = context.role === "admin" || context.role === "ops_manager";
  const currencyDelta = totalApproved - totalRequested;

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
              content: "${customerProjectName(project.name).replace(/"/g, '\\"')} - Change Order ${displayChangeOrderNumber(changeOrder).replace(/"/g, '\\"')}";
              font-family: Arial, Helvetica, sans-serif;
              font-size: 8pt;
              color: #4b5563;
              vertical-align: bottom;
              padding-bottom: 6pt;
              border-bottom: 1pt solid #017a6f;
            }

            @bottom-left {
              content: "thecontrolscompany.com | Service Disabled Veteran Owned Small Business";
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
            line-height: 1.45;
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
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }

          .logo { width: 140px; height: 140px; object-fit: contain; }
          .badge { width: 110px; height: 110px; object-fit: contain; }

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

          .doc-title {
            margin: 18px 0 0;
            text-align: center;
            font-size: 22px;
            font-weight: 700;
            color: #111827;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .status-badge {
            display: inline-block;
            margin: 8px auto 0;
            padding: 3px 14px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .status-draft,
          .status-voided,
          .status-superseded {
            background: #f3f4f6;
            color: #6b7280;
          }

          .status-needs_pricing,
          .status-in_review {
            background: #fef3c7;
            color: #92400e;
          }

          .status-ready_to_submit,
          .status-submitted {
            background: #dbeafe;
            color: #1d4ed8;
          }

          .status-approved,
          .status-executed,
          .status-billed,
          .status-paid {
            background: #d1fae5;
            color: #065f46;
          }

          .status-rejected {
            background: #fee2e2;
            color: #991b1b;
          }

          .section-divider {
            margin: 22px 0 14px;
            padding-bottom: 8px;
            border-bottom: 2px solid #017a6f;
          }

          .section-divider h2 {
            margin: 0;
            font-size: 15px;
            font-weight: 700;
            color: #017a6f;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .meta-grid {
            display: grid;
            grid-template-columns: 180px 1fr 180px 1fr;
            gap: 10px 18px;
            margin-top: 16px;
            font-size: 13px;
          }

          .meta-label { font-weight: 700; color: #374151; }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-top: 14px;
          }

          .summary-card {
            border: 1px solid #d1d5db;
            border-radius: 10px;
            padding: 10px 12px;
            background: #fafafa;
          }

          .summary-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b7280;
          }

          .summary-value {
            margin-top: 4px;
            font-size: 15px;
            font-weight: 700;
            color: #111827;
          }

          .summary-value.positive {
            color: #065f46;
          }

          .summary-value.negative {
            color: #991b1b;
          }

          .desc-block {
            font-size: 14px;
            line-height: 1.6;
            color: #111827;
            white-space: pre-wrap;
          }

          .desc-block p {
            margin: 0 0 10px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-top: 4px;
          }

          th, td {
            border: 1px solid #d1d5db;
            padding: 8px 10px;
            vertical-align: top;
          }

          thead th {
            background: #eef8f6;
            color: #0f172a;
            font-size: 11px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            text-align: left;
          }

          .amount-cell {
            text-align: right;
            white-space: nowrap;
            font-variant-numeric: tabular-nums;
          }

          .line-item-category {
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-size: 10px;
            color: #6b7280;
            margin-bottom: 4px;
          }

          .line-item-detail {
            margin-top: 4px;
            font-size: 12px;
            color: #4b5563;
            line-height: 1.45;
          }

          .callout {
            margin-top: 14px;
            padding: 12px 16px;
            border: 1px solid #d1d5db;
            background: #fafafa;
            font-size: 13px;
            line-height: 1.6;
            white-space: pre-wrap;
          }

          .callout strong {
            display: inline-block;
            margin-bottom: 6px;
          }

          .sig-block {
            margin-top: 24px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            font-size: 13px;
          }

          .sig-line {
            border-top: 1px solid #9ca3af;
            padding-top: 6px;
            margin-top: 40px;
            color: #374151;
          }

          .status-history {
            font-size: 12px;
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

            .footer {
              display: none;
            }
          }
        `}</style>

        <main className="page">
          <div className="print-actions no-print">
            <PrintButton documentTitle={printableTitle} />
          </div>

          <article className="report">
            <div className="brand-row">
              <img src="/logo.png" alt="The Controls Company" className="logo" />
              <div className="brand-copy">
                <h1>THE CONTROLS COMPANY, LLC</h1>
                <p>Service Disabled Veteran Owned Small Business</p>
                <p style={{ marginTop: 4 }}>thecontrolscompany.com</p>
              </div>
              <img src="/sdvosb.jpg" alt="SDVOSB" className="badge" />
            </div>

            <h2 className="doc-title">Change Order Request</h2>
            <div style={{ textAlign: "center" }}>
              <span className={`status-badge status-${changeOrder.status}`}>{changeOrderStatusLabel(changeOrder.status)}</span>
            </div>

            <div className="section-divider" style={{ marginTop: 20 }}>
              <h2>Project Information</h2>
            </div>
            <div className="meta-grid">
              <span className="meta-label">Project:</span>
              <span>{customerProjectName(project.name)}</span>
              <span className="meta-label">Customer:</span>
              <span>{customer?.name ?? "—"}</span>

              <span className="meta-label">Project Number:</span>
              <span>{project.job_number ?? "—"}</span>
              <span className="meta-label">Legacy CO #:</span>
              <span>{changeOrder.co_number || "—"}</span>

              <span className="meta-label">Source:</span>
              <span>{changeOrder.source || "—"}</span>
              <span className="meta-label">Requested By:</span>
              <span>{changeOrder.requested_by_name || "—"}</span>

              <span className="meta-label">Customer Contact:</span>
              <span>{changeOrder.customer_contact_name || "—"}</span>
              <span className="meta-label">Contact Email:</span>
              <span>{changeOrder.customer_contact_email || "—"}</span>

              <span className="meta-label">Submitted:</span>
              <span>{fmtDateTime(changeOrder.submitted_at) || fmtDate(changeOrder.submitted_date)}</span>
              <span className="meta-label">Approved:</span>
              <span>{fmtDateTime(changeOrder.approved_at) || fmtDate(changeOrder.approved_date)}</span>
            </div>

            <div className="summary-grid">
              <div className="summary-card">
                <div className="summary-label">Requested Amount</div>
                <div className={`summary-value ${totalRequested < 0 ? "negative" : "positive"}`}>{fmtCurrency(totalRequested)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Approved Amount</div>
                <div className={`summary-value ${totalApproved < 0 ? "negative" : "positive"}`}>{fmtCurrency(totalApproved)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Requested Days</div>
                <div className="summary-value">{changeOrder.requested_days}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Approved Days</div>
                <div className="summary-value">{changeOrder.approved_days}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Labor</div>
                <div className="summary-value">{fmtCurrency(changeOrder.labor_amount)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Material</div>
                <div className="summary-value">{fmtCurrency(changeOrder.material_amount)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Equipment</div>
                <div className="summary-value">{fmtCurrency(changeOrder.equipment_amount)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Other</div>
                <div className="summary-value">{fmtCurrency(changeOrder.other_amount + changeOrder.subcontractor_amount)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Delta</div>
                <div className={`summary-value ${currencyDelta < 0 ? "negative" : currencyDelta > 0 ? "positive" : ""}`}>
                  {fmtCurrency(currencyDelta)}
                </div>
              </div>
            </div>

            {changeOrder.what_happened || changeOrder.work_required || changeOrder.reason || changeOrder.terms_note ? (
              <>
                <div className="section-divider">
                  <h2>Change Summary</h2>
                </div>

                {changeOrder.what_happened && (
                  <div className="callout">
                    <strong>What Happened</strong>
                    <div>{changeOrder.what_happened}</div>
                  </div>
                )}

                {changeOrder.work_required && (
                  <div className="callout">
                    <strong>Work Required</strong>
                    <div>{changeOrder.work_required}</div>
                  </div>
                )}

                {changeOrder.reason && (
                  <div className="callout">
                    <strong>Reason</strong>
                    <div>{changeOrder.reason}</div>
                  </div>
                )}

                {changeOrder.terms_note && (
                  <div className="callout">
                    <strong>Terms Note</strong>
                    <div>{changeOrder.terms_note}</div>
                  </div>
                )}
              </>
            ) : null}

            {changeOrder.description && (
              <>
                <div className="section-divider">
                  <h2>Description</h2>
                </div>
                <div className="desc-block">
                  {changeOrder.description.split("\n").map((line, index) => (
                    <p key={`${index}-${line}`}>{line}</p>
                  ))}
                </div>
              </>
            )}

            {(bundle.line_items.length > 0 || changeOrder.pricing_mode === "detailed") && (
              <div className="section-divider">
                <h2>Line Items</h2>
              </div>
            )}

            {bundle.line_items.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "18%" }}>Category</th>
                    <th>Description / Inputs</th>
                    <th style={{ width: "16%" }} className="amount-cell">
                      Base
                    </th>
                    <th style={{ width: "12%" }} className="amount-cell">
                      Markup
                    </th>
                    <th style={{ width: "16%" }} className="amount-cell">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.line_items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="line-item-category">{item.category}</div>
                        <div>{item.role || item.category}</div>
                      </td>
                      <td>
                        <div>{item.description}</div>
                        <div className="line-item-detail">{lineItemDetails(item)}</div>
                      </td>
                      <td className="amount-cell">{fmtCurrency(item.base_amount)}</td>
                      <td className="amount-cell">{item.markup_percent.toFixed(2)}%</td>
                      <td className="amount-cell" style={item.total < 0 ? { color: "#991b1b" } : undefined}>
                        {fmtCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} style={{ textAlign: "right", fontWeight: 700 }}>
                      Requested Total
                    </td>
                    <td className="amount-cell" style={{ fontWeight: 700 }}>
                      {fmtCurrency(totalRequested)}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : changeOrder.pricing_mode === "detailed" ? (
              <div className="callout">
                <strong>No detailed line items</strong>
                <div>This change order is marked detailed, but no calculator line items were saved.</div>
              </div>
            ) : null}

            {bundle.attachments.length > 0 && (
              <>
                <div className="section-divider">
                  <h2>{internalVisible ? "Attachments and Backup" : "Attachments"}</h2>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "18%" }}>Type</th>
                      <th>File</th>
                      <th>Description</th>
                      <th style={{ width: "18%" }}>Visible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.attachments.map((attachment) => (
                      <tr key={attachment.id}>
                        <td>{attachmentLabel(attachment.attachment_kind)}</td>
                        <td>
                          {attachment.storage_web_url ? (
                            <a href={attachment.storage_web_url} target="_blank" rel="noreferrer" style={{ color: "#017a6f", textDecoration: "underline" }}>
                              {attachment.title || attachment.file_name}
                            </a>
                          ) : (
                            attachment.title || attachment.file_name
                          )}
                        </td>
                        <td>{attachment.description || "—"}</td>
                        <td>{attachment.is_customer_visible ? "Customer visible" : "Internal"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {internalVisible && changeOrder.internal_notes && (
              <div className="callout">
                <strong>Internal Notes</strong>
                <div>{changeOrder.internal_notes}</div>
              </div>
            )}

            {timeline.length > 0 && (
              <>
                <div className="section-divider">
                  <h2>Status Timeline</h2>
                </div>
                <table className="status-history">
                  <thead>
                    <tr>
                      <th style={{ width: "18%" }}>Event</th>
                      <th style={{ width: "22%" }}>When</th>
                      <th>Reason / Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((entry) => (
                      <tr key={entry.key}>
                        <td>{milestoneLabel(entry.key)}</td>
                        <td>{fmtDateTime(entry.value) ?? "—"}</td>
                        <td>{changeOrder.status_reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {internalVisible && bundle.status_history.length > 0 && (
              <>
                <div className="section-divider">
                  <h2>Audit History</h2>
                </div>
                <table className="status-history">
                  <thead>
                    <tr>
                      <th style={{ width: "18%" }}>When</th>
                      <th style={{ width: "18%" }}>From</th>
                      <th style={{ width: "18%" }}>To</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundle.status_history.map((row) => (
                      <tr key={row.id}>
                        <td>{fmtDateTime(row.changed_at) ?? "—"}</td>
                        <td>{row.previous_status ? changeOrderStatusLabel(row.previous_status) : "—"}</td>
                        <td>{changeOrderStatusLabel(row.new_status)}</td>
                        <td>{row.reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {internalVisible && (changeOrder.superseded_by_change_order_id || changeOrder.combined_into_change_order_id) && (
              <div className="callout">
                <strong>Lineage</strong>
                <div>
                  {changeOrder.superseded_by_change_order_id
                    ? `Superseded by: ${changeOrder.superseded_by_change_order_id}`
                    : null}
                  {changeOrder.superseded_by_change_order_id && changeOrder.combined_into_change_order_id ? " | " : null}
                  {changeOrder.combined_into_change_order_id
                    ? `Combined into: ${changeOrder.combined_into_change_order_id}`
                    : null}
                </div>
              </div>
            )}

            <div className="section-divider">
              <h2>Authorization</h2>
            </div>
            <div className="sig-block">
              <div>
                <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Prepared By</p>
                <p style={{ margin: "0 0 2px" }}>{changeOrder.requested_by_name || "The Controls Company"}</p>
                <p style={{ margin: 0, color: "#6b7280", fontSize: 12 }}>Change request prepared from database record</p>
                <div className="sig-line">Signature &amp; Date</div>
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Approved By</p>
                <p style={{ margin: "0 0 2px", color: "#9ca3af" }}>{changeOrder.approved_by || "—"}</p>
                <p style={{ margin: 0, color: "#9ca3af", fontSize: 12 }}>
                  {changeOrder.approved_date ? fmtDateTime(changeOrder.approved_at) ?? fmtDate(changeOrder.approved_date) : "—"}
                </p>
                <div className="sig-line">Signature &amp; Date</div>
              </div>
            </div>

            <footer className="footer">
              <div>The Controls Company, LLC | thecontrolscompany.com</div>
              <div>Service Disabled Veteran Owned Small Business</div>
              <div>Generated: {fmtDateTime(now.toISOString())}</div>
              <div>Change Order Request: {displayChangeOrderNumber(changeOrder)}</div>
            </footer>
          </article>
        </main>
      </body>
    </html>
  );
}

export const dynamic = "force-dynamic";

import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/app/reports/weekly-update/[id]/PrintButton";
import { createClient } from "@/lib/supabase/server";
import { normalizeSingle } from "@/lib/utils/normalize";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import type { UserRole } from "@/types/database";

type PageProps = { params: Promise<{ id: string }> };

type CoRow = {
  id: string;
  project_id: string;
  co_number: string;
  title: string;
  description: string | null;
  amount: number;
  status: string;
  submitted_date: string | null;
  approved_date: string | null;
  reference_doc: string | null;
  notes: string | null;
  project?:
    | { id: string; name: string; job_number: string | null; customer?: { name: string | null } | Array<{ name: string | null }> | null }
    | Array<{ id: string; name: string; job_number: string | null; customer?: { name: string | null } | Array<{ name: string | null }> | null }>
    | null;
};

type LineItem = { label: string; amount: number };

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  try { return format(new Date(s), "MMMM d, yyyy"); } catch { return s; }
}

function statusLabel(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tryParseLineItems(notes: string | null): LineItem[] | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    if (Array.isArray(parsed) && parsed.every((i) => typeof i.label === "string" && typeof i.amount === "number")) {
      return parsed as LineItem[];
    }
  } catch { /* not JSON */ }
  return null;
}

async function canAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  role: UserRole,
  userId: string,
  projectId: string
): Promise<boolean> {
  if (role === "admin" || role === "ops_manager") return true;

  if (role === "pm" || role === "lead") {
    const { data } = await admin
      .from("project_assignments")
      .select("id")
      .eq("project_id", projectId)
      .eq("profile_id", userId)
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

export default async function ChangeOrderReportPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const resolved = await resolveUserRole(user);
  const role = (resolved?.role ?? "customer") as UserRole;

  const { data } = await admin
    .from("change_orders")
    .select(`
      id, project_id, co_number, title, description, amount, status,
      submitted_date, approved_date, reference_doc, notes,
      project:projects(id, name, job_number, customer:customers(name))
    `)
    .eq("id", id)
    .maybeSingle();

  const co = data as CoRow | null;
  if (!co) notFound();

  const project = normalizeSingle(co.project);
  if (!project) notFound();

  const allowed = await canAccess(admin, role, user.id, project.id);
  if (!allowed) redirect("/login");

  const customer = normalizeSingle(project.customer);
  const lineItems = tryParseLineItems(co.notes);
  const subtotal = lineItems ? lineItems.reduce((s, i) => s + i.amount, 0) : null;
  // 10% overhead + 10% profit on top of subtotal (matching the document)
  const overhead = subtotal !== null ? Math.round(subtotal * 0.1) : null;
  const profit = subtotal !== null && overhead !== null ? Math.round((subtotal + overhead) * 0.1) : null;

  const coDateStr = co.submitted_date
    ? format(new Date(co.submitted_date), "MMM d, yyyy")
    : "—";

  return (
    <html lang="en">
      <body>
        <style>{`
          :root { color-scheme: light; }
          * { box-sizing: border-box; }

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
              content: "${(project.name ?? "").replace(/"/g, '\\"')} — Change Order ${(co.co_number ?? "").replace(/"/g, '\\"')}";
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
            font-size: 14px;
            line-height: 1.5;
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

          .brand-copy { flex: 1; text-align: center; }
          .brand-copy h1 { margin: 0 0 4px; font-size: 20px; color: #017a6f; letter-spacing: 0.04em; }
          .brand-copy p { margin: 0; font-size: 12px; color: #4b5563; }

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
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .status-pending  { background: #fef3c7; color: #92400e; }
          .status-approved { background: #d1fae5; color: #065f46; }
          .status-rejected { background: #fee2e2; color: #991b1b; }
          .status-void     { background: #f3f4f6; color: #6b7280; }

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
            grid-template-columns: 200px 1fr 200px 1fr;
            gap: 10px 20px;
            margin-top: 16px;
            font-size: 13px;
          }

          .meta-label { font-weight: 700; color: #374151; }

          .desc-block { font-size: 14px; line-height: 1.6; color: #111827; }
          .desc-block p { margin: 0 0 10px; }
          .desc-block ol { margin: 0 0 10px; padding-left: 20px; }
          .desc-block li { margin-bottom: 6px; }
          .desc-block strong { font-weight: 700; }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-top: 4px;
          }

          th, td {
            border: 1px solid #d1d5db;
            padding: 8px 12px;
            vertical-align: middle;
          }

          thead th {
            background: #eef8f6;
            color: #0f172a;
            font-size: 11px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .amount-cell { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
          .subtotal-row td { background: #f9fafb; font-weight: 600; }
          .total-row td { background: #017a6f; color: #ffffff; font-weight: 700; font-size: 14px; }

          .callout {
            margin-top: 14px;
            padding: 12px 16px;
            border: 1px solid #d1d5db;
            background: #fafafa;
            font-size: 13px;
            line-height: 1.6;
            white-space: pre-wrap;
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

          .footer {
            margin-top: 24px;
            padding-top: 14px;
            border-top: 2px solid #017a6f;
            text-align: center;
            font-size: 12px;
            color: #4b5563;
          }

          @media print {
            body { background: #ffffff; }
            .no-print { display: none !important; }
            .page { max-width: none; margin: 0; padding: 0; }
            .report { border: 0; padding: 0; }
            .footer { display: none; }
          }
        `}</style>

        <main className="page">
          <div className="print-actions no-print">
            <PrintButton />
          </div>

          <article className="report">
            {/* Branding */}
            <div className="brand-row">
              <img src="/logo.png" alt="The Controls Company" className="logo" />
              <div className="brand-copy">
                <h1>THE CONTROLS COMPANY, LLC</h1>
                <p>Service Disabled Veteran Owned Small Business</p>
                <p style={{ marginTop: 4 }}>thecontrolscompany.com</p>
              </div>
              <img src="/badge.png" alt="SDVOSB" className="badge" />
            </div>

            <h2 className="doc-title">Change Order Request</h2>
            <div style={{ textAlign: "center" }}>
              <span className={`status-badge status-${co.status}`}>{statusLabel(co.status)}</span>
            </div>

            {/* Metadata */}
            <div className="section-divider" style={{ marginTop: 20 }}>
              <h2>Project Information</h2>
            </div>
            <div className="meta-grid">
              <span className="meta-label">Project:</span>
              <span>{project.name}{project.job_number ? ` (${project.job_number})` : ""}</span>
              <span className="meta-label">Change Order #:</span>
              <span>{co.co_number || "—"}</span>

              <span className="meta-label">Customer:</span>
              <span>{customer?.name ?? "—"}</span>
              <span className="meta-label">Date Submitted:</span>
              <span>{fmtDate(co.submitted_date)}</span>

              {co.reference_doc && (
                <>
                  <span className="meta-label">Contract Reference:</span>
                  <span>{co.reference_doc}</span>
                  <span />
                  <span />
                </>
              )}

              {co.approved_date && (
                <>
                  <span className="meta-label">Date Approved:</span>
                  <span>{fmtDate(co.approved_date)}</span>
                  <span />
                  <span />
                </>
              )}
            </div>

            {/* Subject */}
            <div className="section-divider">
              <h2>Subject</h2>
            </div>
            <p style={{ fontWeight: 700, fontSize: 15, margin: "8px 0" }}>{co.title}</p>

            {/* Description */}
            {co.description && (
              <>
                <div className="section-divider">
                  <h2>Description</h2>
                </div>
                <div className="desc-block">
                  {co.description.split("\n").map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </>
            )}

            {/* Cost Breakdown */}
            {lineItems && lineItems.length > 0 && (
              <>
                <div className="section-divider">
                  <h2>Cost Breakdown</h2>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="amount-cell">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, i) => (
                      <tr key={i}>
                        <td>{item.label}</td>
                        <td className="amount-cell">{fmtCurrency(item.amount)}</td>
                      </tr>
                    ))}
                    {subtotal !== null && (
                      <tr className="subtotal-row">
                        <td>Subtotal</td>
                        <td className="amount-cell">{fmtCurrency(subtotal)}</td>
                      </tr>
                    )}
                    {overhead !== null && (
                      <tr>
                        <td>Overhead (10%)</td>
                        <td className="amount-cell">{fmtCurrency(overhead)}</td>
                      </tr>
                    )}
                    {profit !== null && (
                      <tr>
                        <td>Profit (10%)</td>
                        <td className="amount-cell">{fmtCurrency(profit)}</td>
                      </tr>
                    )}
                    <tr className="total-row">
                      <td>TOTAL CHANGE ORDER</td>
                      <td className="amount-cell">{fmtCurrency(co.amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {/* Notes as text if not JSON line items */}
            {co.notes && !lineItems && (
              <>
                <div className="section-divider">
                  <h2>Notes</h2>
                </div>
                <div className="callout">{co.notes}</div>
              </>
            )}

            {/* Signature block */}
            <div className="section-divider">
              <h2>Authorization</h2>
            </div>
            <div className="sig-block">
              <div>
                <p style={{ margin: "0 0 4px", fontWeight: 600 }}>Submitted By</p>
                <p style={{ margin: "0 0 2px" }}>Timothy J. Collins, MBA</p>
                <p style={{ margin: 0, color: "#6b7280", fontSize: 12 }}>President, The Controls Company, LLC</p>
                <div className="sig-line">Signature &amp; Date</div>
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontWeight: 600 }}>Approved By</p>
                <p style={{ margin: "0 0 2px", color: "#9ca3af" }}>&nbsp;</p>
                <p style={{ margin: 0, color: "#9ca3af", fontSize: 12 }}>&nbsp;</p>
                <div className="sig-line">Signature &amp; Date</div>
              </div>
            </div>

            <footer className="footer">
              <div>The Controls Company, LLC | thecontrolscompany.com</div>
              <div>Service Disabled Veteran Owned Small Business</div>
              <div>Generated: {coDateStr}</div>
            </footer>
          </article>
        </main>
      </body>
    </html>
  );
}

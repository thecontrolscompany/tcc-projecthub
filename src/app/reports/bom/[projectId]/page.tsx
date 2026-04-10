export const dynamic = "force-dynamic";

import { format } from "date-fns";
import { notFound, redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { PrintButton } from "@/app/reports/weekly-update/[id]/PrintButton";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { createClient } from "@/lib/supabase/server";
import { normalizeSingle } from "@/lib/utils/normalize";
import type { UserRole } from "@/types/database";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

type ProjectRow = {
  id: string;
  name: string;
  job_number: string | null;
  site_address: string | null;
  general_contractor: string | null;
  customer?: { name: string | null } | Array<{ name: string | null }> | null;
};

type BomItemRow = {
  id: string;
  section: string | null;
  designation: string | null;
  code_number: string | null;
  description: string;
  qty_required: number;
  sort_order: number | null;
};

type ReceiptRow = {
  bom_item_id: string;
  qty_received: number;
};

type BomReportItem = {
  id: string;
  section: string;
  designation: string | null;
  code_number: string | null;
  description: string;
  qty_required: number;
  qty_received: number;
  status: "missing" | "partial" | "received" | "surplus";
};

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

export default async function BomReportPage({ params }: PageProps) {
  const { projectId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const resolved = await resolveUserRole(user);
  const role = (resolved?.role ?? "customer") as UserRole;

  const { data: projectRaw } = await admin
    .from("projects")
    .select("id, name, job_number, site_address, general_contractor, customer:customers(name)")
    .eq("id", projectId)
    .maybeSingle();

  const project = projectRaw as ProjectRow | null;
  if (!project) {
    notFound();
  }

  const allowed = await canAccess(admin, role, user.id, projectId);
  if (!allowed) {
    redirect("/login");
  }

  const { data: rawItems } = await admin
    .from("bom_items")
    .select("id, section, designation, code_number, description, qty_required, sort_order")
    .eq("project_id", projectId)
    .order("sort_order")
    .order("section");

  const itemIds = (rawItems ?? []).map((item: { id: string }) => item.id);
  const receiptResult = itemIds.length
    ? await admin
        .from("material_receipts")
        .select("bom_item_id, qty_received")
        .in("bom_item_id", itemIds)
    : { data: [] as ReceiptRow[] };
  const rawReceipts = (receiptResult.data ?? []) as ReceiptRow[];

  const receivedMap = new Map<string, number>();
  for (const receipt of rawReceipts) {
    receivedMap.set(receipt.bom_item_id, (receivedMap.get(receipt.bom_item_id) ?? 0) + (receipt.qty_received ?? 0));
  }

  const items = ((rawItems ?? []) as BomItemRow[]).map((item) => {
    const qtyRequired = Number(item.qty_required) || 0;
    const qtyReceived = receivedMap.get(item.id) ?? 0;
    let status: BomReportItem["status"];

    if (qtyReceived === 0) status = "missing";
    else if (qtyReceived < qtyRequired) status = "partial";
    else if (qtyReceived === qtyRequired) status = "received";
    else status = "surplus";

    return {
      id: item.id,
      section: item.section?.trim() || "General",
      designation: item.designation,
      code_number: item.code_number,
      description: item.description,
      qty_required: qtyRequired,
      qty_received: qtyReceived,
      status,
    };
  });

  const customer = normalizeSingle(project.customer);
  const totalItems = items.length;
  const receivedCount = items.filter((item) => item.status === "received").length;
  const partialCount = items.filter((item) => item.status === "partial").length;
  const missingCount = items.filter((item) => item.status === "missing").length;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{project.name} - Bill of Materials</title>
        <style>{`
          :root { color-scheme: light; }
          * { box-sizing: border-box; }

          @page {
            size: letter landscape;
            margin: 0.6in 0.75in 0.8in 0.75in;

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
              content: "${project.name.replace(/"/g, '\\"')} - Bill of Materials";
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
            background: #f4f7f6;
            color: #111827;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 13px;
            line-height: 1.4;
          }

          .page {
            max-width: 10in;
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

          .logo { width: 120px; height: 120px; object-fit: contain; }
          .badge { width: 90px; height: 90px; object-fit: contain; }

          .brand-copy { flex: 1; text-align: center; }
          .brand-copy h1 { margin: 0 0 4px; font-size: 18px; color: #017a6f; letter-spacing: 0.04em; }
          .brand-copy p { margin: 0; font-size: 12px; color: #4b5563; }

          .section-divider {
            margin: 18px 0 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #017a6f;
          }

          .section-divider h2 { margin: 0; font-size: 15px; color: #017a6f; letter-spacing: 0.08em; }

          .meta-grid {
            display: grid;
            grid-template-columns: 160px 1fr 160px 1fr;
            gap: 6px 14px;
            margin-top: 14px;
            font-size: 13px;
          }

          .meta-label { font-weight: 700; color: #374151; }

          .summary-bar {
            display: flex;
            gap: 24px;
            margin: 14px 0;
            padding: 10px 16px;
            background: #eef8f6;
            border-radius: 6px;
            font-size: 13px;
          }

          .summary-stat { display: flex; flex-direction: column; }
          .summary-stat .label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #4b5563; }
          .summary-stat .value { font-size: 18px; font-weight: 700; color: #017a6f; }
          .summary-stat.danger .value { color: #dc2626; }
          .summary-stat.warn .value { color: #d97706; }

          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 7px 9px; vertical-align: top; font-size: 12px; }

          thead th {
            background: #eef8f6;
            color: #0f172a;
            text-align: left;
            font-size: 11px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .number-cell { text-align: center; white-space: nowrap; }
          .status-received { color: #15803d; font-weight: 600; }
          .status-partial { color: #d97706; font-weight: 600; }
          .status-missing { color: #dc2626; font-weight: 600; }
          .status-surplus { color: #92400e; font-weight: 600; }

          .footer {
            margin-top: 24px;
            padding-top: 10px;
            border-top: 2px solid #017a6f;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
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
      </head>
      <body>
        <main className="page">
          <PrintButton />

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
              <h2>BILL OF MATERIALS</h2>
            </div>

            <div className="meta-grid">
              <div className="meta-label">Project Name:</div>
              <div>{project.name}</div>
              <div className="meta-label">Job Number:</div>
              <div>{project.job_number || "Not assigned"}</div>

              <div className="meta-label">Customer:</div>
              <div>{customer?.name || "Not provided"}</div>
              <div className="meta-label">Generated:</div>
              <div>{format(new Date(), "MMMM d, yyyy")}</div>

              <div className="meta-label">Site Address:</div>
              <div>{project.site_address || "Not provided"}</div>
              <div className="meta-label">General Contractor:</div>
              <div>{project.general_contractor || "Not provided"}</div>
            </div>

            <div className="summary-bar">
              <div className="summary-stat">
                <span className="label">Total Items</span>
                <span className="value">{totalItems}</span>
              </div>
              <div className="summary-stat">
                <span className="label">Received</span>
                <span className="value">{receivedCount}</span>
              </div>
              <div className="summary-stat warn">
                <span className="label">Partial</span>
                <span className="value">{partialCount}</span>
              </div>
              <div className="summary-stat danger">
                <span className="label">Missing</span>
                <span className="value">{missingCount}</span>
              </div>
            </div>

            {items.length === 0 ? (
              <p style={{ color: "#6b7280", marginTop: 24 }}>No BOM items on file for this project.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Section</th>
                    <th>Designation</th>
                    <th>Code Number</th>
                    <th>Description</th>
                    <th className="number-cell">Qty Req&apos;d</th>
                    <th className="number-cell">Qty Rec&apos;d</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.flatMap((item, index) => {
                    const previousSection = index > 0 ? items[index - 1].section : "";
                    const rows = [];

                    if (item.section !== previousSection) {
                      rows.push(
                        <tr key={`section-${index}`} style={{ background: "#e8f0fa" }}>
                          <td
                            colSpan={7}
                            style={{
                              fontWeight: 700,
                              fontSize: 11,
                              letterSpacing: "0.15em",
                              textTransform: "uppercase",
                              color: "#1e3a5f",
                            }}
                          >
                            {item.section}
                          </td>
                        </tr>
                      );
                    }

                    rows.push(
                      <tr key={item.id}>
                        <td>{item.section}</td>
                        <td>{item.designation || "-"}</td>
                        <td>{item.code_number || "-"}</td>
                        <td>{item.description}</td>
                        <td className="number-cell">{item.qty_required}</td>
                        <td className="number-cell">{item.qty_received}</td>
                        <td
                          className={
                            item.status === "received"
                              ? "status-received"
                              : item.status === "partial"
                                ? "status-partial"
                                : item.status === "surplus"
                                  ? "status-surplus"
                                  : "status-missing"
                          }
                        >
                          {item.status === "received"
                            ? "Received"
                            : item.status === "partial"
                              ? "Partial"
                              : item.status === "surplus"
                                ? "Surplus"
                                : "Missing"}
                        </td>
                      </tr>
                    );

                    return rows;
                  })}
                </tbody>
              </table>
            )}

            <footer className="footer">
              <div>The Controls Company, LLC | thecontrolscompany.com</div>
              <div>Service Disabled Veteran Owned Small Business</div>
              <div>Generated: {format(new Date(), "MMMM d, yyyy")}</div>
            </footer>
          </article>
        </main>
      </body>
    </html>
  );
}

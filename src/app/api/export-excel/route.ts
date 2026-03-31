import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import ExcelJS from "exceljs";
import { format } from "date-fns";
import { uploadToOneDrive } from "@/lib/graph/client";

/**
 * GET /api/export-excel?month=2026-03-01
 *
 * Generates a billing period Excel file matching the legacy tracker format.
 * - Returns the file as a download response
 * - Optionally also uploads to OneDrive under Projects/_Billing Archives/
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  if (!month) {
    return NextResponse.json({ error: "month parameter required" }, { status: 400 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: rows } = await supabase
    .from("billing_rows")
    .select("*")
    .eq("period_month", month)
    .order("customer_name");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TCC ProjectHub";
  workbook.created = new Date();

  const monthLabel = format(new Date(month), "MMMM yyyy");
  const sheet = workbook.addWorksheet(monthLabel);

  // Column headers — matches legacy Excel tracker columns A–K
  sheet.columns = [
    { header: "Customer", key: "customer_name", width: 22 },
    { header: "Project Name", key: "project_name", width: 30 },
    { header: "PM Email", key: "pm_email", width: 28 },
    { header: "Estimated Income", key: "estimated_income", width: 18 },
    { header: "Backlog", key: "backlog", width: 16 },
    { header: "Prior % Complete", key: "prior_pct", width: 16 },
    { header: "% Complete", key: "pct_complete", width: 14 },
    { header: "Previously Billed", key: "prev_billed", width: 18 },
    { header: "Previously Billed %", key: "prev_billed_pct", width: 18 },
    { header: "To Bill This Period", key: "to_bill", width: 20 },
    { header: "Actual Billed Amount", key: "actual_billed", width: 20 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1e3a5f" } };
  headerRow.alignment = { vertical: "middle" };

  const currencyFmt = '"$"#,##0.00';
  const pctFmt = "0.0%";

  for (const row of rows ?? []) {
    const dataRow = sheet.addRow({
      customer_name: row.customer_name,
      project_name: row.project_name,
      pm_email: row.pm_email,
      estimated_income: row.estimated_income,
      backlog: row.backlog,
      prior_pct: row.prior_pct,
      pct_complete: row.pct_complete,
      prev_billed: row.prev_billed,
      prev_billed_pct: row.prev_billed_pct,
      to_bill: row.to_bill,
      actual_billed: row.actual_billed ?? "",
    });

    // Apply currency/percentage formats
    (["estimated_income", "backlog", "prev_billed", "to_bill", "actual_billed"] as const).forEach(
      (key) => {
        const colIdx = sheet.columns.findIndex((c) => c.key === key) + 1;
        dataRow.getCell(colIdx).numFmt = currencyFmt;
      }
    );
    (["prior_pct", "pct_complete", "prev_billed_pct"] as const).forEach((key) => {
      const colIdx = sheet.columns.findIndex((c) => c.key === key) + 1;
      dataRow.getCell(colIdx).numFmt = pctFmt;
    });

    // Highlight editable cells (% Complete, Actual Billed) in yellow
    [7, 11].forEach((col) => {
      dataRow.getCell(col).fill = {
        type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9C4" },
      };
    });

    // Gray out 100% complete rows
    if (row.pct_complete >= 1) {
      dataRow.font = { color: { argb: "FF9e9e9e" } };
    }
  }

  // Totals row
  const lastDataRow = (rows?.length ?? 0) + 1;
  const totalsRow = sheet.addRow({
    customer_name: "TOTALS",
    project_name: "",
    pm_email: "",
    estimated_income: { formula: `SUM(D2:D${lastDataRow})` },
    backlog: { formula: `SUM(E2:E${lastDataRow})` },
    prior_pct: "",
    pct_complete: "",
    prev_billed: { formula: `SUM(H2:H${lastDataRow})` },
    prev_billed_pct: "",
    to_bill: { formula: `SUM(J2:J${lastDataRow})` },
    actual_billed: { formula: `SUM(K2:K${lastDataRow})` },
  });
  totalsRow.font = { bold: true };
  totalsRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFf1f5f9" } };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `TCC_Billing_${format(new Date(month), "yyyy-MM")}.xlsx`;

  // Optionally upload to OneDrive if provider token available
  const providerToken = session.provider_token;
  if (providerToken) {
    await uploadToOneDrive(
      providerToken,
      `Projects/_Billing Archives/${fileName}`,
      buffer as ArrayBuffer
    ).catch(() => {
      // Non-fatal — download still works
    });
  }

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

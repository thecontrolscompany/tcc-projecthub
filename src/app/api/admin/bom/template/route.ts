import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const profile = await resolveUserRole(user);
  if (!["admin", "ops_manager"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("BOM");

  // Column widths
  ws.columns = [
    { key: "designation", width: 18 },
    { key: "qty_required", width: 12 },
    { key: "code_number", width: 18 },
    { key: "description", width: 40 },
  ];

  // Header row
  const headerRow = ws.addRow(["Designation", "Qty Required", "Code Number", "Description"]);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 20;

  // Instructions row
  const instrRow = ws.addRow([
    "Leave blank if N/A",
    "Required",
    "Leave blank if N/A",
    "Required — item description",
  ]);
  instrRow.font = { italic: true, color: { argb: "FF888888" }, size: 9 };

  // Example section header (only col 1 filled = treated as section by importer)
  const sectionRow = ws.addRow(["Panel Components", "", "", ""]);
  sectionRow.font = { bold: true, color: { argb: "FF1E3A5F" } };
  sectionRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0FA" } };

  // Example data rows
  ws.addRow(["CB1", 1, "ABB S201-C10", "10A Circuit Breaker"]);
  ws.addRow(["PS1", 2, "24VDC-5A", "24VDC Power Supply"]);
  ws.addRow(["", 1, "", "DIN Rail, 35mm x 500mm"]);

  // Blank rows for user to fill in
  for (let i = 0; i < 20; i++) {
    ws.addRow(["", "", "", ""]);
  }

  // Freeze header rows
  ws.views = [{ state: "frozen", ySplit: 2 }];

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="BOM_Template.xlsx"',
    },
  });
}

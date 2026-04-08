import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import type { BomItem, MaterialReceipt } from "@/types/database";

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("BOM");

  ws.columns = [
    { key: "designation", width: 18 },
    { key: "qty_required", width: 12 },
    { key: "code_number", width: 18 },
    { key: "description", width: 40 },
    { key: "qty_received", width: 14 },
  ];

  // Header row
  const headerRow = ws.addRow(["Designation", "Qty Required", "Code Number", "Description", "Qty Received"]);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 20;

  // If a projectId was provided, try to load existing BOM items
  if (projectId) {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: items } = await admin
      .from("bom_items")
      .select("*")
      .eq("project_id", projectId)
      .order("section")
      .order("sort_order");

    const itemIds = (items ?? []).map((i: BomItem) => i.id);
    const { data: receipts } = itemIds.length > 0
      ? await admin.from("material_receipts").select("bom_item_id, qty_received").in("bom_item_id", itemIds)
      : { data: [] };

    if (items && items.length > 0) {
      // Compute total qty received per bom item
      const receivedByItem = new Map<string, number>();
      for (const r of (receipts ?? []) as MaterialReceipt[]) {
        receivedByItem.set(r.bom_item_id, (receivedByItem.get(r.bom_item_id) ?? 0) + r.qty_received);
      }

      let currentSection = "";
      for (const item of items as BomItem[]) {
        const section = item.section || "General";
        if (section !== currentSection) {
          // Section header row — only col 1 filled (matches import logic)
          const sectionRow = ws.addRow([section, "", "", "", ""]);
          sectionRow.font = { bold: true, color: { argb: "FF1E3A5F" } };
          sectionRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0FA" } };
          currentSection = section;
        }
        ws.addRow([
          item.designation ?? "",
          item.qty_required,
          item.code_number ?? "",
          item.description,
          receivedByItem.get(item.id) ?? "",
        ]);
      }

      ws.views = [{ state: "frozen", ySplit: 1 }];
      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="BOM_Export.xlsx"',
        },
      });
    }
  }

  // No existing BOM — return blank template
  const instrRow = ws.addRow([
    "Leave blank if N/A",
    "Required",
    "Leave blank if N/A",
    "Required — item description",
    "Leave blank — fill in on delivery",
  ]);
  instrRow.font = { italic: true, color: { argb: "FF888888" }, size: 9 };

  // Example section header
  const sectionRow = ws.addRow(["Panel Components", "", "", "", ""]);
  sectionRow.font = { bold: true, color: { argb: "FF1E3A5F" } };
  sectionRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0FA" } };

  // Example data rows
  ws.addRow(["CB1", 1, "ABB S201-C10", "10A Circuit Breaker", ""]);
  ws.addRow(["PS1", 2, "24VDC-5A", "24VDC Power Supply", ""]);
  ws.addRow(["", 1, "", "DIN Rail, 35mm x 500mm", ""]);

  // Blank rows for user to fill in
  for (let i = 0; i < 20; i++) {
    ws.addRow(["", "", "", "", ""]);
  }

  ws.views = [{ state: "frozen", ySplit: 2 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="BOM_Template.xlsx"',
    },
  });
}

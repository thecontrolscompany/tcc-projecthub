import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Buffer } from "node:buffer";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

export async function POST(request: Request) {
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

  const formData = await request.formData();
  const file = formData.get("file");
  const projectId = formData.get("projectId");
  if (!(file instanceof File) || typeof projectId !== "string") {
    return NextResponse.json({ error: "Project id and file are required." }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  const fileBuffer = Buffer.from(await file.arrayBuffer()) as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(fileBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return NextResponse.json({ error: "No worksheet found in workbook." }, { status: 400 });
  }

  const rowsToInsert: Array<{
    project_id: string;
    section: string;
    designation: string | null;
    code_number: string | null;
    description: string;
    qty_required: number;
    notes: null;
    sort_order: number;
  }> = [];
  const qtyReceivedByIndex: number[] = []; // parallel array — qty received per rowsToInsert entry

  let currentSection = "General";
  let skipped = 0;

  worksheet.eachRow((row) => {
    const designation = String(row.getCell(1).text ?? "").trim();
    const qtyText = String(row.getCell(2).text ?? "").trim();
    const codeNumber = String(row.getCell(3).text ?? "").trim();
    const description = String(row.getCell(4).text ?? "").trim();
    const qtyReceivedText = String(row.getCell(5).text ?? "").trim();
    const qtyRequired = Number(qtyText || 0);
    const qtyReceived = Number(qtyReceivedText || 0);

    const isSectionHeader = designation && !qtyText && !codeNumber && !description;
    if (isSectionHeader) {
      currentSection = designation;
      return;
    }

    const isEmptyRow = !designation && !qtyText && !codeNumber && !description;
    if (isEmptyRow) {
      skipped += 1;
      return;
    }

    if ((!qtyText || qtyRequired === 0) && !codeNumber && !description) {
      skipped += 1;
      return;
    }

    if (!description) {
      skipped += 1;
      return;
    }

    rowsToInsert.push({
      project_id: projectId,
      section: currentSection,
      designation: designation || null,
      code_number: codeNumber || null,
      description,
      qty_required: Number.isFinite(qtyRequired) ? qtyRequired : 0,
      notes: null,
      sort_order: rowsToInsert.length,
    });
    qtyReceivedByIndex.push(Number.isFinite(qtyReceived) && qtyReceived > 0 ? qtyReceived : 0);
  });

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: insertedItems, error } = await adminClient
    .from("bom_items")
    .insert(rowsToInsert)
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create bulk receipt entries for any rows that had qty received > 0
  const receiptsToInsert = (insertedItems ?? [])
    .map((item: { id: string }, i: number) => ({ id: item.id, qty: qtyReceivedByIndex[i] ?? 0 }))
    .filter((r) => r.qty > 0)
    .map((r) => ({
      bom_item_id: r.id,
      qty_received: r.qty,
      date_received: new Date().toISOString().slice(0, 10),
      received_by: null,
      packing_slip: "Imported",
      notes: "Bulk import",
    }));

  if (receiptsToInsert.length > 0) {
    const { error: receiptError } = await adminClient.from("material_receipts").insert(receiptsToInsert);
    if (receiptError) {
      return NextResponse.json({ error: receiptError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ imported: rowsToInsert.length, receipts: receiptsToInsert.length, skipped, errors: [] });
}

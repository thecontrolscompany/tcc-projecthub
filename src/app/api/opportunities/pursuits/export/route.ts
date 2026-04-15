import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/opportunity-import-server";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("pursuits")
    .select("id, project_name, owner_name, project_location, status, sharepoint_folder")
    .order("project_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const header = "id,project_name,owner_name,project_location,status,sharepoint_folder";
  const body = rows
    .map((row) =>
      [
        row.id,
        row.project_name,
        row.owner_name ?? "",
        row.project_location ?? "",
        row.status,
        row.sharepoint_folder ?? "",
      ]
        .map(csvEscape)
        .join(",")
    )
    .join("\n");

  return new NextResponse(`${header}\n${body}`, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="pursuits-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function csvEscape(value: string) {
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

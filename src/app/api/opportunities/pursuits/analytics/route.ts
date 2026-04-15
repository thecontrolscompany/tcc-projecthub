import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/opportunity-import-server";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { supabase } = auth;
  const { data, error } = await supabase
    .from("pursuits")
    .select(`
      id,
      project_name,
      owner_name,
      project_location,
      status,
      created_at,
      bid_year,
      quote_requests (estimated_value)
    `);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pursuits = (data ?? []).map((pursuit) => ({
    id: pursuit.id,
    project_name: pursuit.project_name,
    owner_name: pursuit.owner_name,
    project_location: pursuit.project_location,
    status: pursuit.status,
    created_at: pursuit.created_at,
    bid_year: pursuit.bid_year ?? null,
    estimated_value:
      (pursuit.quote_requests as Array<{ estimated_value: number | null }>)
        .reduce((max, quote) => Math.max(max, quote.estimated_value ?? 0), 0) || null,
  }));

  return NextResponse.json({ pursuits });
}

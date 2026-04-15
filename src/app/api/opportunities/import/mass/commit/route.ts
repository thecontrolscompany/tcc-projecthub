import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ManifestEntry } from "@/lib/onedrive-archive-scanner";

export const maxDuration = 60;

type MassCommitBody = {
  entries?: ManifestEntry[];
  bid_year?: number | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as MassCommitBody | null;
  const entries = body?.entries ?? [];

  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "No entries provided." }, { status: 400 });
  }

  const itemIds = entries.map((entry) => entry.pursuit_item_id).filter(Boolean);
  const { data: existing } = await supabase
    .from("pursuits")
    .select("onedrive_item_id")
    .in("onedrive_item_id", itemIds);

  const alreadyImported = new Set((existing ?? []).map((pursuit) => pursuit.onedrive_item_id).filter(Boolean));

  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (alreadyImported.has(entry.pursuit_item_id)) {
      skipped++;
      continue;
    }

    const firstQuote = entry.quotes[0];
    const ownerName = firstQuote?.gc_name ?? null;
    const pursuitStatus: "active" | "awarded" | "lost" =
      entry.pursuit_status === "won" ? "awarded" : entry.pursuit_status === "active" ? "active" : "lost";

    const { data: pursuit, error: pursuitError } = await supabase
      .from("pursuits")
      .insert({
        project_name: entry.pursuit_name,
        owner_name: ownerName,
        status: pursuitStatus,
        created_by: user.id,
        onedrive_item_id: entry.pursuit_item_id,
        bid_year: body?.bid_year ?? null,
      })
      .select("id")
      .single();

    if (pursuitError || !pursuit) {
      if (pursuitError?.code === "23505") {
        skipped++;
        alreadyImported.add(entry.pursuit_item_id);
        continue;
      }

      console.error(`Failed to create pursuit "${entry.pursuit_name}":`, pursuitError?.message);
      skipped++;
      continue;
    }

    for (const quote of entry.quotes) {
      const gcName = quote.gc_name;
      const { error: quoteRequestError } = await supabase.from("quote_requests").insert({
        pursuit_id: pursuit.id,
        company_name: gcName ?? entry.pursuit_name,
        contact_name: "",
        contact_email: "",
        project_description: entry.pursuit_name,
        site_address: null,
        estimated_value: null,
        bid_date: null,
        proposal_date: null,
        opportunity_number: null,
        project_id: null,
        notes: null,
        status: pursuitStatus === "awarded" ? "won" : "new",
      });

      if (quoteRequestError) {
        console.error(
          `Failed to create quote request for "${entry.pursuit_name}" (${gcName ?? "direct"}):`,
          quoteRequestError.message
        );
      }
    }

    created++;
    alreadyImported.add(entry.pursuit_item_id);
  }

  return NextResponse.json({ ok: true, created, skipped });
}

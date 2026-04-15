import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: pursuit, error } = await supabase
    .from("pursuits")
    .select(`
      id,
      project_name,
      owner_name,
      project_location,
      status,
      created_at,
      onedrive_item_id,
      sharepoint_folder,
      sharepoint_item_id,
      linked_project_id,
      quote_requests (
        id,
        company_name,
        contact_name,
        contact_email,
        project_description,
        site_address,
        estimated_value,
        bid_date,
        proposal_date,
        opportunity_number,
        status,
        notes,
        created_at
      )
    `)
    .eq("id", id)
    .single();

  if (error || !pursuit) {
    return NextResponse.json({ error: "Pursuit not found." }, { status: 404 });
  }

  return NextResponse.json({ pursuit });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const allowedPursuitFields = ["project_name", "owner_name", "project_location", "status"];
  const pursuitPatch = Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedPursuitFields.includes(key))
  );

  if (Object.keys(pursuitPatch).length > 0) {
    const { error } = await supabase.from("pursuits").update(pursuitPatch).eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  if (body.quote_request && typeof body.quote_request === "object") {
    const allowedQuoteRequestFields = [
      "company_name",
      "contact_name",
      "contact_email",
      "project_description",
      "site_address",
      "estimated_value",
      "bid_date",
      "proposal_date",
      "opportunity_number",
      "notes",
      "status",
    ];

    const quoteRequestPatch = Object.fromEntries(
      Object.entries(body.quote_request as Record<string, unknown>).filter(([key]) =>
        allowedQuoteRequestFields.includes(key)
      )
    );

    if (Object.keys(quoteRequestPatch).length > 0) {
      const { data: quoteRequests, error: quoteRequestFetchError } = await supabase
        .from("quote_requests")
        .select("id")
        .eq("pursuit_id", id)
        .order("created_at", { ascending: true })
        .limit(1);

      if (quoteRequestFetchError) {
        return NextResponse.json({ error: quoteRequestFetchError.message }, { status: 400 });
      }

      if (quoteRequests && quoteRequests.length > 0) {
        const { error: quoteRequestUpdateError } = await supabase
          .from("quote_requests")
          .update(quoteRequestPatch)
          .eq("id", quoteRequests[0].id);

        if (quoteRequestUpdateError) {
          return NextResponse.json({ error: quoteRequestUpdateError.message }, { status: 400 });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

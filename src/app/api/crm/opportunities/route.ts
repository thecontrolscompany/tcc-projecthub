import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { z } from "zod";

const CRM_WRITE_ROLES = ["admin", "ops_manager"] as const;
const CRM_READ_ROLES = ["admin", "ops_manager", "pm", "lead"] as const;

const opportunityCreateSchema = z.object({
  account_id: z.string().uuid(),
  project_name: z.string().min(1),
  primary_contact_id: z.string().uuid().nullish(),
  estimator_profile_id: z.string().uuid().nullish(),
  pm_profile_id: z.string().uuid().nullish(),
  internal_owner_profile_id: z.string().uuid().nullish(),
  estimated_value: z.number().nullish(),
  estimated_gross_margin: z.number().nullish(),
  estimated_margin_pct: z.number().nullish(),
  probability: z.number().int().min(0).max(100).nullish(),
  expected_close_date: z.string().nullish(),
  bid_due_date: z.string().nullish(),
  market_type: z.string().nullish(),
  stage: z.enum(["target_account","initial_contact","relationship_building","opportunity_identified","request_for_pricing","estimating","proposal_sent","follow_up_negotiation","verbal_award","po_received","closed_lost","on_hold"]).default("target_account"),
  next_step: z.string().nullish(),
  lead_source: z.string().nullish(),
  notes: z.string().nullish(),
  linked_pursuit_id: z.string().uuid().nullish(),
  linked_quote_request_id: z.string().uuid().nullish(),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!(CRM_READ_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage");
  const accountId = searchParams.get("account_id");
  const estimatorId = searchParams.get("estimator_id");
  const search = searchParams.get("search");

  let query = supabase
    .from("crm_opportunities")
    .select(`
      id, opportunity_number, project_name, stage, estimated_value,
      estimated_gross_margin, probability, bid_due_date, expected_close_date,
      last_activity_date, market_type, next_step, lead_source, created_at,
      account:crm_accounts!crm_opportunities_account_id_fkey(id, company_name),
      primary_contact:crm_contacts!crm_opportunities_primary_contact_id_fkey(id, display_name, role_type)
    `)
    .order("created_at", { ascending: false });

  if (stage) query = query.eq("stage", stage);
  if (accountId) query = query.eq("account_id", accountId);
  if (estimatorId) query = query.eq("estimator_profile_id", estimatorId);
  if (search) query = query.ilike("project_name", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ opportunities: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!(CRM_WRITE_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = opportunityCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("crm_opportunities")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ opportunity: data }, { status: 201 });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { z } from "zod";

const CRM_WRITE_ROLES = ["admin", "ops_manager"] as const;
const CRM_READ_ROLES = ["admin", "ops_manager", "pm", "lead"] as const;

const opportunityUpdateSchema = z.object({
  project_name: z.string().min(1).optional(),
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
  stage: z.enum(["target_account","initial_contact","relationship_building","opportunity_identified","request_for_pricing","estimating","proposal_sent","follow_up_negotiation","verbal_award","po_received","closed_lost","on_hold"]).optional(),
  next_step: z.string().nullish(),
  lead_source: z.string().nullish(),
  notes: z.string().nullish(),
  linked_pursuit_id: z.string().uuid().nullish(),
  linked_quote_request_id: z.string().uuid().nullish(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!(CRM_READ_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const [oppResult, activitiesResult] = await Promise.all([
    supabase
      .from("crm_opportunities")
      .select(`
        *,
        account:crm_accounts!crm_opportunities_account_id_fkey(id, company_name, relationship_health),
        primary_contact:crm_contacts!crm_opportunities_primary_contact_id_fkey(id, display_name, role_type, email, phone),
        estimator:profiles!crm_opportunities_estimator_profile_id_fkey(id, full_name, email),
        pm:profiles!crm_opportunities_pm_profile_id_fkey(id, full_name, email),
        internal_owner:profiles!crm_opportunities_internal_owner_profile_id_fkey(id, full_name, email),
        opportunity_contacts:crm_opportunity_contacts(
          id, contact_role_on_opportunity,
          contact:crm_contacts!crm_opportunity_contacts_contact_id_fkey(id, display_name, role_type, confidence_level, email)
        )
      `)
      .eq("id", id)
      .single(),
    supabase
      .from("crm_activities")
      .select(`
        id, activity_type, activity_date, summary, key_decisions,
        follow_up_actions, follow_up_due_date, attendees_text, created_at,
        logged_by:profiles!crm_activities_logged_by_profile_id_fkey(id, full_name),
        contact:crm_contacts!crm_activities_contact_id_fkey(id, display_name)
      `)
      .eq("opportunity_id", id)
      .order("activity_date", { ascending: false })
      .limit(30),
  ]);

  if (oppResult.error) {
    if (oppResult.error.code === "PGRST116") return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ error: oppResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    opportunity: oppResult.data,
    activities: activitiesResult.data ?? [],
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!(CRM_WRITE_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = opportunityUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("crm_opportunities")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ opportunity: data });
}

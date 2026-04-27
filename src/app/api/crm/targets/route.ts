import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { z } from "zod";

const CRM_WRITE_ROLES = ["admin", "ops_manager"] as const;

const targetUpsertSchema = z.object({
  profile_id: z.string().uuid(),
  period_start: z.string(),
  period_end: z.string(),
  target_customer_meetings_per_week: z.number().int().nullish(),
  target_outreach_touches_per_week: z.number().int().nullish(),
  target_active_opportunities: z.number().int().nullish(),
  target_proposals_requested: z.number().int().nullish(),
  target_proposals_sent: z.number().int().nullish(),
  target_closed_won_revenue: z.number().nullish(),
  target_gross_margin: z.number().nullish(),
  strategic_notes: z.string().nullish(),
});

export async function GET(_request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!(CRM_WRITE_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("crm_salesperson_targets")
    .select(`
      *,
      profile:profiles!crm_salesperson_targets_profile_id_fkey(id, full_name, email)
    `)
    .order("period_start", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ targets: data ?? [] });
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
  const parsed = targetUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("crm_salesperson_targets")
    .upsert(parsed.data, { onConflict: "profile_id,period_start" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ target: data });
}

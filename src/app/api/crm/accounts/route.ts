import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { z } from "zod";

const CRM_WRITE_ROLES = ["admin", "ops_manager"] as const;
const CRM_READ_ROLES = ["admin", "ops_manager", "pm", "lead"] as const;

const accountCreateSchema = z.object({
  organization_id: z.string().uuid().nullish(),
  company_name: z.string().min(1),
  type: z.enum(["general_contractor","mechanical_contractor","controls_contractor","hvac_oem","controls_oem","owner","other"]).default("other"),
  territory: z.string().nullish(),
  status: z.enum(["active","inactive","prospect"]).default("prospect"),
  notes: z.string().nullish(),
  relationship_owner_profile_id: z.string().uuid().nullish(),
  tags: z.array(z.string()).default([]),
  website: z.string().nullish(),
  address: z.string().nullish(),
  relationship_health: z.enum(["strong","good","at_risk","dormant","unknown"]).default("unknown"),
  last_meaningful_contact_date: z.string().nullish(),
  next_scheduled_followup_date: z.string().nullish(),
  who_buys: z.string().nullish(),
  who_issues_po: z.string().nullish(),
  who_influences_spec: z.string().nullish(),
  who_owns_estimating_relationship: z.string().nullish(),
  handoff_notes: z.string().nullish(),
  linked_customer_id: z.string().uuid().nullish(),
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
  const status = searchParams.get("status");
  const health = searchParams.get("health");
  const type = searchParams.get("type");
  const search = searchParams.get("search");

  let query = supabase
    .from("crm_accounts")
    .select(`
      id, company_name, type, territory, status, relationship_health,
      last_meaningful_contact_date, next_scheduled_followup_date,
      relationship_owner_profile_id, tags, website, address,
      who_buys, who_issues_po, who_influences_spec,
      who_owns_estimating_relationship, handoff_notes, notes,
      linked_customer_id, created_at, updated_at,
      relationship_owner:profiles!crm_accounts_relationship_owner_profile_id_fkey(id, full_name, email)
    `)
    .order("company_name", { ascending: true });

  if (status) query = query.eq("status", status);
  if (health) query = query.eq("relationship_health", health);
  if (type) query = query.eq("type", type);
  if (search) query = query.ilike("company_name", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ accounts: data ?? [] });
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
  const parsed = accountCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: defaultOrganizationId } = await supabase.rpc("current_user_default_organization_id");
  const payload = {
    ...parsed.data,
    organization_id:
      parsed.data.organization_id ?? (typeof defaultOrganizationId === "string" ? defaultOrganizationId : null),
  };

  const { data, error } = await supabase
    .from("crm_accounts")
    .insert(payload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data }, { status: 201 });
}

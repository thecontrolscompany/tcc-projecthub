import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

const CRM_WRITE_ROLES = ["admin", "ops_manager"] as const;

function generateToken(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let token = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (const b of bytes) token += chars[b % chars.length];
  return token;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  if (!(CRM_WRITE_ROLES as readonly string[]).includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title: string = body.title ?? "Contact Directory";

  // Fetch all active contacts with their account
  const { data: contacts, error } = await supabase
    .from("crm_contacts")
    .select(`
      id, display_name, first_name, last_name, title, role_type,
      email, phone, mobile,
      is_active,
      account:crm_accounts!crm_contacts_account_id_fkey(
        id, company_name, type, types, territory, website
      )
    `)
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const token = generateToken();

  // 7-day expiry
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: exported, error: insertErr } = await supabase
    .from("crm_shared_exports")
    .insert({
      token,
      type: "contact_directory",
      title,
      snapshot: { contacts: contacts ?? [], generated_at: new Date().toISOString() },
      created_by: user.id,
      expires_at,
    })
    .select("id, token")
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://internal.thecontrolscompany.com";
  const shareUrl = `${baseUrl}/share/${exported.token}`;

  return NextResponse.json({ token: exported.token, url: shareUrl, contact_count: contacts?.length ?? 0 });
}

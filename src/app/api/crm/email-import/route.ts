import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { graphFetch } from "@/lib/graph/client";
import {
  parseEmailBody,
  extractPhones,
  extractTitle,
  extractDomainHint,
  guessAccountId,
} from "@/lib/crm/email-extract";

const INTERNAL_DOMAINS = ["controlsco.net", "thecontrolscompany.com"];
const MAX_MESSAGES = 500;

interface GraphMessage {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  body: { content: string; contentType: string };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const profile = await resolveUserRole(user);
  const role = profile?.role ?? "";
  if (!["admin", "ops_manager"].includes(role)) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { data: { session } } = await supabase.auth.getSession();
  const providerToken = session?.provider_token;
  if (!providerToken) {
    return NextResponse.json({
      error: "Microsoft access token not available. Sign out and sign back in with Microsoft to use this feature.",
      code: "NO_PROVIDER_TOKEN",
    }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const domainFilter = searchParams.get("domain")?.toLowerCase() ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "200", 10), MAX_MESSAGES);

  // Fetch recent received messages (not drafts, not sent)
  const graphUrl = `/me/messages?$select=id,subject,from,receivedDateTime,body&$top=${limit}&$orderby=receivedDateTime desc&$filter=isDraft eq false`;
  const graphRes = await graphFetch(graphUrl, providerToken);

  if (!graphRes.ok) {
    const errText = await graphRes.text();
    if (graphRes.status === 401) {
      return NextResponse.json({
        error: "Microsoft token expired. Sign out and sign back in.",
        code: "TOKEN_EXPIRED",
      }, { status: 400 });
    }
    return NextResponse.json({ error: `Microsoft Graph error: ${errText}` }, { status: 502 });
  }

  const graphData = await graphRes.json();
  const messages: GraphMessage[] = graphData.value ?? [];

  // Filter to external senders only
  const external = messages.filter((m) => {
    const addr = m.from?.emailAddress?.address?.toLowerCase() ?? "";
    if (!addr || addr.includes("noreply") || addr.includes("no-reply")) return false;
    if (INTERNAL_DOMAINS.some((d) => addr.endsWith(`@${d}`))) return false;
    if (domainFilter && !addr.includes(domainFilter)) return false;
    return true;
  });

  // Deduplicate: keep the most recent message per sender email
  const byEmail = new Map<string, GraphMessage>();
  for (const msg of external) {
    const addr = msg.from.emailAddress.address.toLowerCase();
    if (!byEmail.has(addr)) byEmail.set(addr, msg);
  }

  // Load accounts for domain matching
  const { data: accounts } = await supabase
    .from("crm_accounts")
    .select("id, company_name")
    .order("company_name");

  // Check which sender emails already exist in crm_contacts
  const senderEmails = [...byEmail.keys()];
  const { data: existingContacts } = await supabase
    .from("crm_contacts")
    .select("email, display_name, account_id")
    .in("email", senderEmails);

  const existingSet = new Set(
    (existingContacts ?? []).map((c) => c.email?.toLowerCase()).filter(Boolean)
  );

  // Extract contact info from each unique sender
  const candidates = [...byEmail.values()].map((msg) => {
    const addr = msg.from.emailAddress.address.toLowerCase();
    const bodyText = parseEmailBody(msg.body);
    const { phone, mobile } = extractPhones(bodyText);
    const title = extractTitle(bodyText, msg.from.emailAddress.name);
    const domainHint = extractDomainHint(addr);
    const suggestedAccountId = guessAccountId(addr, accounts ?? []);

    return {
      name: msg.from.emailAddress.name,
      email: addr,
      phone,
      mobile,
      title,
      domain_hint: domainHint,
      suggested_account_id: suggestedAccountId,
      last_email_date: msg.receivedDateTime,
      sample_subject: msg.subject,
      already_imported: existingSet.has(addr),
    };
  });

  // Sort: not-yet-imported first, then alphabetical by domain
  candidates.sort((a, b) => {
    if (a.already_imported !== b.already_imported) return a.already_imported ? 1 : -1;
    return (a.domain_hint ?? "").localeCompare(b.domain_hint ?? "");
  });

  return NextResponse.json({
    candidates,
    accounts: accounts ?? [],
    total_fetched: messages.length,
    total_external: external.length,
    total_unique: byEmail.size,
  });
}

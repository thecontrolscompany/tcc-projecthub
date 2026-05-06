import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";

type Source = "portal" | "directory" | "relationship";

type UnifiedPerson = {
  key: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  companyNames: string[];
  roles: string[];
  sources: Source[];
  profileIds: string[];
  directoryIds: string[];
  crmContactIds: string[];
};

const EMAIL_DOMAIN_COMPANIES: Record<string, string> = {
  "controlsco.net": "The Controls Company",
  "jci.com": "Johnson Controls",
  "siemens.com": "Siemens",
  "trane.com": "Trane",
  "tranetechnologies.com": "Trane",
  "engcool.com": "Engineered Cooling Services",
  "engineeredcooling.com": "Engineered Cooling Services",
};

function normalizeEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase();
  return email || null;
}

function normalizeName(value: string | null | undefined) {
  return standardizePersonName(value)?.toLowerCase() || null;
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? null;
}

function standardizePersonName(value: string | null | undefined) {
  const collapsed = value?.trim().replace(/\s+/g, " ");
  if (!collapsed) return null;

  const commaParts = collapsed.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length === 2) {
    return `${commaParts[1]} ${commaParts[0]}`.replace(/\s+/g, " ");
  }

  return collapsed;
}

function addUnique<T>(items: T[], value: T | null | undefined) {
  if (value && !items.includes(value)) items.push(value);
}

function companyForEmail(email: string | null) {
  const domain = email?.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  return EMAIL_DOMAIN_COMPANIES[domain] ?? (domain.startsWith("trane.") ? "Trane" : null);
}

function personKey(email: string | null, name: string | null, id: string, source: Source) {
  if (email) return `email:${email}`;
  if (name) return `name:${name}`;
  return `${source}:${id}`;
}

export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const profile = await resolveUserRole(user);
  if (!["admin", "ops_manager"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Admin or ops manager access required." }, { status: 403 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [profilesResult, directoryResult, crmResult] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, role, phone, pm_directory_id").order("email"),
    admin.from("pm_directory").select("id, email, first_name, last_name, phone, intended_role, profile_id").order("email"),
    admin
      .from("crm_contacts")
      .select("id, display_name, first_name, last_name, role_type, title, email, phone, account:crm_accounts!crm_contacts_account_id_fkey(company_name)")
      .order("display_name"),
  ]);

  const error = profilesResult.error || directoryResult.error || crmResult.error;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const people = new Map<string, UnifiedPerson>();

  function getPerson(args: {
    id: string;
    source: Source;
    email: string | null;
    name: string | null;
    displayName: string | null;
    phone: string | null;
  }) {
    const key = personKey(args.email, args.name, args.id, args.source);
    const existing = people.get(key);
    if (existing) {
      existing.displayName = standardizePersonName(firstNonEmpty(existing.displayName, args.displayName, args.email, "Unknown")) ?? "Unknown";
      existing.email = existing.email ?? args.email;
      existing.phone = existing.phone ?? args.phone;
      addUnique(existing.sources, args.source);
      return existing;
    }

    const person: UnifiedPerson = {
      key,
      displayName: standardizePersonName(firstNonEmpty(args.displayName, args.email, "Unknown")) ?? "Unknown",
      email: args.email,
      phone: args.phone,
      companyNames: [],
      roles: [],
      sources: [args.source],
      profileIds: [],
      directoryIds: [],
      crmContactIds: [],
    };
    people.set(key, person);
    return person;
  }

  for (const row of profilesResult.data ?? []) {
    const email = normalizeEmail(row.email);
    const fullName = standardizePersonName(row.full_name);
    const name = normalizeName(fullName);
    const person = getPerson({
      id: row.id,
      source: "portal",
      email,
      name,
      displayName: fullName ?? row.email,
      phone: row.phone,
    });
    addUnique(person.profileIds, row.id);
    addUnique(person.roles, row.role);
    addUnique(person.companyNames, companyForEmail(email));
  }

  for (const row of directoryResult.data ?? []) {
    const email = normalizeEmail(row.email);
    const fullName = standardizePersonName([row.first_name, row.last_name].filter(Boolean).join(" ").trim());
    const name = normalizeName(fullName);
    const person = getPerson({
      id: row.id,
      source: "directory",
      email,
      name,
      displayName: fullName || row.email,
      phone: row.phone,
    });
    const emailCompany = companyForEmail(email);
    addUnique(person.directoryIds, row.id);
    addUnique(person.roles, row.intended_role ?? null);
    addUnique(person.companyNames, emailCompany);
  }

  for (const row of crmResult.data ?? []) {
    const email = normalizeEmail(row.email);
    const fullName = standardizePersonName(firstNonEmpty(row.display_name, [row.first_name, row.last_name].filter(Boolean).join(" ")));
    const name = normalizeName(fullName);
    const person = getPerson({
      id: row.id,
      source: "relationship",
      email,
      name,
      displayName: fullName,
      phone: row.phone,
    });
    const account = Array.isArray(row.account) ? row.account[0] : row.account;
    const emailCompany = companyForEmail(email);
    addUnique(person.crmContactIds, row.id);
    addUnique(person.roles, row.role_type);
    addUnique(person.companyNames, emailCompany);
    if (!emailCompany) {
      addUnique(person.companyNames, account?.company_name ?? null);
    }
  }

  return NextResponse.json({
    people: Array.from(people.values()).sort((a, b) => a.displayName.localeCompare(b.displayName)),
  });
}

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const vcfPath = path.join(process.cwd(), "project-resources", "Troy Abell and 320 others.vcf");
const reportPath = path.join(process.cwd(), "project-resources", "icloud-existing-people-enrichment-report.json");
const applyChanges = process.argv.includes("--apply");

const EMAIL_DOMAIN_COMPANIES: Record<string, string> = {
  "controlsco.net": "The Controls Company",
  "jci.com": "Johnson Controls",
  "siemens.com": "Siemens",
  "trane.com": "Trane",
  "tranetechnologies.com": "Trane",
  "engcool.com": "Engineered Cooling Services",
  "engineeredcooling.com": "Engineered Cooling Services",
};

type VCardContact = {
  name: string | null;
  emails: string[];
  phones: string[];
  org: string | null;
  title: string | null;
};

type ExistingPerson = {
  table: "profiles" | "pm_directory" | "crm_contacts";
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  title?: string | null;
};

type PlannedUpdate = {
  table: ExistingPerson["table"];
  id: string;
  matchedBy: string;
  existingName: string | null;
  vcardName: string | null;
  company: string | null;
  updates: Record<string, string>;
};

function cleanValue(value: string | null | undefined) {
  return value?.replace(/\\n/g, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").trim() || null;
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function normalizeName(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim() || null;
}

function normalizeCompany(value: string | null | undefined) {
  const cleaned = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  if (cleaned === "jci" || cleaned.includes("johnson controls")) return "johnson controls";
  if (cleaned.includes("siemens")) return "siemens";
  if (cleaned.includes("trane")) return "trane";
  if (cleaned.includes("engineered cooling") || cleaned.includes("engcool")) return "engineered cooling services";
  if (cleaned.includes("controls company") || cleaned.includes("controlsco")) return "the controls company";
  return cleaned;
}

function companyForEmail(email: string | null) {
  const domain = email?.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  return EMAIL_DOMAIN_COMPANIES[domain] ?? (domain.startsWith("trane.") ? "Trane" : null);
}

function normalizePhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits || null;
}

function formatPhone(value: string) {
  const digits = normalizePhone(value);
  if (!digits) return value.trim();
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value.trim();
}

function cardNameFromN(value: string | null) {
  if (!value) return null;
  const [last, first, middle] = value.split(";").map((part) => cleanValue(part));
  return [first, middle, last].filter(Boolean).join(" ").trim() || null;
}

function parseVCard(file: string): VCardContact[] {
  const rawLines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const lines: string[] = [];

  for (const line of rawLines) {
    if (/^[ \t]/.test(line) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }

  const contacts: VCardContact[] = [];
  let current: VCardContact | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VCARD") {
      current = { name: null, emails: [], phones: [], org: null, title: null };
      continue;
    }
    if (line === "END:VCARD") {
      if (current) contacts.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).split(";")[0].toUpperCase();
    const value = cleanValue(line.slice(separator + 1));

    if (key === "FN" && value) current.name = value;
    if (key === "N" && !current.name) current.name = cardNameFromN(value);
    if (key === "EMAIL" && value) {
      const email = normalizeEmail(value);
      if (email && !current.emails.includes(email)) current.emails.push(email);
    }
    if (key === "TEL" && value) {
      const phone = formatPhone(value);
      if (normalizePhone(phone) && !current.phones.some((item) => normalizePhone(item) === normalizePhone(phone))) current.phones.push(phone);
    }
    if (key === "ORG" && value) current.org = value.replace(/;+$/, "").trim() || null;
    if (key === "TITLE" && value) current.title = value;
  }

  return contacts;
}

function choosePhone(contact: VCardContact) {
  return contact.phones.find((phone) => normalizePhone(phone)?.length === 10) ?? contact.phones[0] ?? null;
}

function companyMatches(contact: VCardContact, person: ExistingPerson) {
  const contactCompany = normalizeCompany(contact.org) ?? normalizeCompany(companyForEmail(contact.emails[0] ?? null));
  const personCompany = normalizeCompany(person.company) ?? normalizeCompany(companyForEmail(person.email));
  return Boolean(contactCompany && personCompany && contactCompany === personCompany);
}

async function loadExistingPeople(): Promise<ExistingPerson[]> {
  const [profilesResult, directoryResult, crmResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, phone"),
    supabase.from("pm_directory").select("id, first_name, last_name, email, phone"),
    supabase
      .from("crm_contacts")
      .select("id, display_name, first_name, last_name, email, phone, title, account:crm_accounts!crm_contacts_account_id_fkey(company_name)"),
  ]);

  const error = profilesResult.error || directoryResult.error || crmResult.error;
  if (error) throw new Error(error.message);

  return [
    ...(profilesResult.data ?? []).map((row) => ({
      table: "profiles" as const,
      id: row.id,
      name: cleanValue(row.full_name),
      email: normalizeEmail(row.email),
      phone: row.phone,
      company: companyForEmail(normalizeEmail(row.email)),
    })),
    ...(directoryResult.data ?? []).map((row) => ({
      table: "pm_directory" as const,
      id: row.id,
      name: cleanValue([row.first_name, row.last_name].filter(Boolean).join(" ")),
      email: normalizeEmail(row.email),
      phone: row.phone,
      company: companyForEmail(normalizeEmail(row.email)),
    })),
    ...(crmResult.data ?? []).map((row) => {
      const account = Array.isArray(row.account) ? row.account[0] : row.account;
      return {
        table: "crm_contacts" as const,
        id: row.id,
        name: cleanValue(row.display_name || [row.first_name, row.last_name].filter(Boolean).join(" ")),
        email: normalizeEmail(row.email),
        phone: row.phone,
        company: account?.company_name ?? companyForEmail(normalizeEmail(row.email)),
        title: row.title,
      };
    }),
  ];
}

function planUpdates(contacts: VCardContact[], people: ExistingPerson[]) {
  const byEmail = new Map<string, ExistingPerson[]>();
  const byName = new Map<string, ExistingPerson[]>();

  for (const person of people) {
    if (person.email) byEmail.set(person.email, [...(byEmail.get(person.email) ?? []), person]);
    const name = normalizeName(person.name);
    if (name) byName.set(name, [...(byName.get(name) ?? []), person]);
  }

  const plans: PlannedUpdate[] = [];
  const skipped: Array<{ vcardName: string | null; reason: string; emails: string[]; phones: string[]; org: string | null }> = [];
  const plannedKeys = new Set<string>();

  for (const contact of contacts) {
    const phone = choosePhone(contact);
    const emailMatches = contact.emails.flatMap((email) => byEmail.get(email) ?? []);
    const normalizedContactName = normalizeName(contact.name);
    const nameMatches = normalizedContactName ? byName.get(normalizedContactName) ?? [] : [];
    const companyNameMatches = nameMatches.filter((person) => companyMatches(contact, person));
    const uniqueNameMatches = nameMatches.length === 1 ? nameMatches : [];
    const matches = emailMatches.length > 0 ? emailMatches : companyNameMatches.length > 0 ? companyNameMatches : uniqueNameMatches;
    const matchedBy = emailMatches.length > 0 ? "email" : companyNameMatches.length > 0 ? "name+company" : uniqueNameMatches.length > 0 ? "unique-name" : null;

    if (matches.length === 0) {
      skipped.push({ vcardName: contact.name, reason: "no existing match", emails: contact.emails, phones: contact.phones, org: contact.org });
      continue;
    }

    for (const person of matches) {
      const updates: Record<string, string> = {};
      if (phone && !normalizePhone(person.phone)) updates.phone = phone;
      if (person.table === "crm_contacts" && contact.title && !person.title?.trim()) updates.title = contact.title;
      if (Object.keys(updates).length === 0) {
        skipped.push({ vcardName: contact.name, reason: `matched ${person.table} but no missing supported fields`, emails: contact.emails, phones: contact.phones, org: contact.org });
        continue;
      }

      const key = `${person.table}:${person.id}`;
      if (plannedKeys.has(key)) continue;
      plannedKeys.add(key);
      plans.push({
        table: person.table,
        id: person.id,
        matchedBy: matchedBy ?? "unknown",
        existingName: person.name,
        vcardName: contact.name,
        company: person.company ?? contact.org,
        updates,
      });
    }
  }

  return { plans, skipped };
}

async function applyPlans(plans: PlannedUpdate[]) {
  for (const plan of plans) {
    const { error } = await supabase.from(plan.table).update(plan.updates).eq("id", plan.id);
    if (error) throw new Error(`${plan.table}:${plan.id} ${error.message}`);
  }
}

async function main() {
  const contacts = parseVCard(vcfPath);
  const people = await loadExistingPeople();
  const { plans, skipped } = planUpdates(contacts, people);

  if (applyChanges) await applyPlans(plans);

  const report = {
    mode: applyChanges ? "applied" : "dry-run",
    source: vcfPath,
    contactsInVcf: contacts.length,
    existingRowsConsidered: people.length,
    plannedOrAppliedUpdates: plans.length,
    skipped: skipped.length,
    updatesByTable: plans.reduce<Record<string, number>>((acc, plan) => {
      acc[plan.table] = (acc[plan.table] ?? 0) + 1;
      return acc;
    }, {}),
    updates: plans,
    skippedSamples: skipped.slice(0, 50),
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    mode: report.mode,
    contactsInVcf: report.contactsInVcf,
    existingRowsConsidered: report.existingRowsConsidered,
    plannedOrAppliedUpdates: report.plannedOrAppliedUpdates,
    updatesByTable: report.updatesByTable,
    reportPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

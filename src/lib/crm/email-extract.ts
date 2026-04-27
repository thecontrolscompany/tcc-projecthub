// Utilities for extracting contact information from email signatures.
// Used by the /api/crm/email-import route.

export interface ExtractedSender {
  name: string;
  email: string;
  phone: string | null;
  mobile: string | null;
  title: string | null;
  domain_hint: string | null;
  last_email_date: string;
  sample_subject: string;
}

// Phone regex — matches US formats: (205) 555-1234, 205.555.1234, +1-205-555-1234, etc.
const PHONE_RE = /(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}(?:\s*(?:ext|x|ext\.)?\s*\d{1,5})?/gi;

// Lines likely to contain a job title
const TITLE_KEYWORDS = [
  "president", "owner", "ceo", "cfo", "coo", "controller",
  "director", "manager", "estimator", "engineer",
  "project manager", "senior", "vice president", "vp",
  "sales", "operations", "account executive", "account manager",
  "procurement", "principal", "partner", "superintendent",
  "coordinator", "administrator", "technician", "foreman",
];

export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseEmailBody(body: { content: string; contentType: string }): string {
  return body.contentType === "html" ? stripHtml(body.content) : body.content;
}

// Find all phone numbers in text, return first two (main + mobile)
export function extractPhones(text: string): { phone: string | null; mobile: string | null } {
  const matches = [...text.matchAll(PHONE_RE)].map((m) => m[0].trim());
  const unique = [...new Set(matches)].slice(0, 2);
  return { phone: unique[0] ?? null, mobile: unique[1] ?? null };
}

// Look for a job title in the last ~30 lines of the email body.
// Titles typically appear just below the sender's name in the signature block.
export function extractTitle(bodyText: string, senderName: string): string | null {
  const lines = bodyText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Focus on the last 30 lines (signature area)
  const sigLines = lines.slice(-30);

  // First: look for a line that contains a title keyword, is short (<100 chars),
  // and does NOT look like a URL or email address.
  for (const line of sigLines) {
    if (line.length > 100) continue;
    if (line.includes("@") || line.includes("http") || line.includes("www.")) continue;
    const lower = line.toLowerCase();
    if (TITLE_KEYWORDS.some((kw) => lower.includes(kw))) {
      return line;
    }
  }

  return null;
}

// Extract the primary domain label (e.g., "johnsoncontrols" from "user@johnsoncontrols.com")
export function extractDomainHint(email: string): string | null {
  const at = email.indexOf("@");
  if (at === -1) return null;
  const domain = email.slice(at + 1).toLowerCase(); // e.g., "johnsoncontrols.com"
  const label = domain.split(".")[0]; // e.g., "johnsoncontrols"
  return label || null;
}

// Given a list of account names, find the best match for a sender's email domain.
// Returns the account id with the highest overlap, or null.
export function guessAccountId(
  email: string,
  accounts: Array<{ id: string; company_name: string }>
): string | null {
  const domain = extractDomainHint(email) ?? "";
  if (!domain) return null;

  // Normalize: strip punctuation and lowercase
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const domainNorm = normalize(domain);

  let bestId: string | null = null;
  let bestScore = 0;

  for (const acc of accounts) {
    const nameNorm = normalize(acc.company_name);
    // Score: how many chars of the domain appear in the company name (or vice versa)
    const overlap = domainNorm.length >= 4 && nameNorm.includes(domainNorm)
      ? domainNorm.length
      : nameNorm.length >= 4 && domainNorm.includes(nameNorm)
      ? nameNorm.length
      : 0;
    if (overlap > bestScore) {
      bestScore = overlap;
      bestId = acc.id;
    }
  }

  return bestScore >= 4 ? bestId : null;
}

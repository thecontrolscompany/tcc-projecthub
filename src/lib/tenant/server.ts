import { headers } from "next/headers";
import { ORG_HEADERS, type OrgContext } from "./context";

export async function getOrgContext(): Promise<OrgContext | null> {
  const h = await headers();
  const id = h.get(ORG_HEADERS.id);
  const slug = h.get(ORG_HEADERS.slug);
  const name = h.get(ORG_HEADERS.name);

  if (!id || !slug || !name) return null;

  return {
    id,
    slug,
    name,
    status: "active",
    logo_url: null,
    brand_primary: null,
    is_demo: h.get(ORG_HEADERS.isDemo) === "true",
  };
}

export async function requireOrgContext(): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (!ctx) throw new Error("No org context — request is missing tenant headers.");
  return ctx;
}

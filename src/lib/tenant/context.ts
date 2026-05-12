import { createClient } from "@supabase/supabase-js";

const RESERVED = new Set([
  "www", "app", "api", "superadmin", "mail", "status", "cdn", "assets",
]);

export type OrgContext = {
  id: string;
  slug: string;
  name: string;
  status: string;
  logo_url: string | null;
  brand_primary: string | null;
  is_demo: boolean;
};

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function extractSlug(host: string): string | null {
  // Allow an env override for single-tenant deployments (e.g. internal.thecontrolscompany.com)
  if (process.env.ORG_SLUG_OVERRIDE) return process.env.ORG_SLUG_OVERRIDE;

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "trimrespond.com";

  // Strip port
  const hostname = host.split(":")[0];

  if (hostname.endsWith(`.${rootDomain}`)) {
    const sub = hostname.slice(0, hostname.length - rootDomain.length - 1);
    if (sub && !RESERVED.has(sub)) return sub;
  }

  return null;
}

export async function resolveOrgFromRequest(
  host: string,
  devOrgParam?: string | null
): Promise<OrgContext | null> {
  let slug: string | null = null;

  if (process.env.NODE_ENV === "development" && devOrgParam) {
    slug = devOrgParam;
  } else {
    slug = extractSlug(host);
  }

  if (!slug) return null;

  const { data } = await adminClient()
    .from("organizations")
    .select("id, slug, name, status, logo_url, brand_primary")
    .eq("slug", slug)
    .in("status", ["active", "trial"])
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    status: data.status,
    logo_url: (data as Record<string, unknown>).logo_url as string | null ?? null,
    brand_primary: (data as Record<string, unknown>).brand_primary as string | null ?? null,
    is_demo: data.slug === "demo",
  };
}

export const ORG_HEADERS = {
  id: "x-org-id",
  slug: "x-org-slug",
  name: "x-org-name",
  isDemo: "x-is-demo",
} as const;

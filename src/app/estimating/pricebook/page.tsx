import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { mapCatalogRows } from "@/modules/hvac-estimator/shared/catalogStore";
import PriceBookPage from "@/modules/hvac-estimator/components/pricebook/PriceBookPage";

async function resolveDefaultOrganizationId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string | null) {
  const { data: defaultOrgId } = await supabase.rpc("current_user_default_organization_id");
  if (typeof defaultOrgId === "string") return defaultOrgId;

  if (userId) {
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("profile_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membership?.organization_id) return membership.organization_id as string;
  }

  const { data: tccOrganization } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "tcc")
    .maybeSingle();

  return typeof tccOrganization?.id === "string" ? tccOrganization.id : null;
}

export default async function EstimatingPriceBookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const organizationId = await resolveDefaultOrganizationId(supabase, user.id);
  if (!organizationId) notFound();

  const [installCatalogResult, controlsCatalogResult] = await Promise.all([
    supabase
      .from("install_assembly_catalog")
      .select("id, description, mtl_unit, mtl_per, hrs_unit, hrs_per, category, freq, alternate_ids")
      .eq("organization_id", organizationId)
      .order("id", { ascending: true }),
    supabase
      .from("controls_assembly_catalog")
      .select("id, description, mtl_unit, mtl_per, hrs_unit, hrs_per, category, alternate_ids, part_number, manufacturer")
      .eq("organization_id", organizationId)
      .order("id", { ascending: true }),
  ]);

  const installCatalog = mapCatalogRows(installCatalogResult.data ?? []);
  const controlsCatalog = mapCatalogRows(controlsCatalogResult.data ?? []);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/estimating" className="text-sm font-semibold text-text-secondary hover:text-text-primary">
          Back to Estimating
        </Link>
      </div>
      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-raised">
        <PriceBookPage
          installCatalog={installCatalog}
          controlsCatalog={controlsCatalog}
          organizationId={organizationId}
        />
      </div>
    </div>
  );
}

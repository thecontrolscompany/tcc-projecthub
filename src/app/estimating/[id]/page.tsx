import { notFound } from "next/navigation";
import { OpportunityHubSubnav } from "@/components/opportunity-hub-subnav";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { canReadEstimates, ESTIMATE_SELECT } from "@/lib/estimates/api";
import type { EstimateRecord } from "@/types/database";
import { EstimateDetailClient } from "./estimate-detail-client";
import { mapCatalogRows } from "@/modules/hvac-estimator/shared/catalogStore";

export const dynamic = "force-dynamic";

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const profile = await resolveUserRole(user);
  if (!canReadEstimates(profile?.role ?? "")) notFound();

  const { data: estimate, error } = await supabase
    .from("estimates")
    .select(ESTIMATE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !estimate) notFound();

  const [linkedProjectResult, fallbackProjectResult, installCatalogResult, controlsCatalogResult] = await Promise.all([
    estimate.linked_project_id
      ? supabase
          .from("projects")
          .select("id, name, job_number, sharepoint_folder, sharepoint_item_id")
          .eq("id", estimate.linked_project_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("projects")
      .select("id, name, job_number, sharepoint_folder, sharepoint_item_id")
      .eq("source_estimate_id", estimate.id)
      .maybeSingle(),
    supabase
      .from("install_assembly_catalog")
      .select("id, description, mtl_unit, mtl_per, hrs_unit, hrs_per, category, freq, alternate_ids")
      .eq("organization_id", estimate.organization_id)
      .order("id", { ascending: true }),
    supabase
      .from("controls_assembly_catalog")
      .select("id, description, mtl_unit, mtl_per, hrs_unit, hrs_per, category, freq, alternate_ids")
      .eq("organization_id", estimate.organization_id)
      .order("id", { ascending: true }),
  ]);

  const sourceProject = linkedProjectResult.data ?? fallbackProjectResult.data ?? null;
  const installCatalog = mapCatalogRows(installCatalogResult.data ?? []);
  const controlsCatalog = mapCatalogRows(controlsCatalogResult.data ?? []);

  const projectRootFolder =
    typeof sourceProject?.sharepoint_folder === "string" && sourceProject.sharepoint_folder.trim()
      ? sourceProject.sharepoint_folder.trim()
      : typeof sourceProject?.name === "string" && sourceProject.name.trim()
        ? `Active Projects/${sourceProject.name.trim()}`
        : "";
  const canonicalEstimateFolder = projectRootFolder ? `${projectRootFolder}/02 Estimate` : null;

  const hydratedEstimate = canonicalEstimateFolder
    ? {
        ...estimate,
        body: {
          ...(estimate.body as Record<string, unknown>),
          sharepointFolder: canonicalEstimateFolder,
          sharepointItemId: (estimate.body as Record<string, unknown>).sharepointItemId ?? null,
        },
      }
    : estimate;

  return (
    <div className="mx-auto w-full max-w-none px-2 py-2 md:px-3 md:py-3">
      <OpportunityHubSubnav />
      <EstimateDetailClient
        estimate={hydratedEstimate as EstimateRecord}
        installCatalog={installCatalog}
        controlsCatalog={controlsCatalog}
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { VAV_COMPS } from "@/modules/hvac-estimator/components/vav/vavData";
import { AHU_COMPS } from "@/modules/hvac-estimator/components/ahu/ahuData";
import { RTU_COMPS } from "@/modules/hvac-estimator/components/rtu/rtuData";
import { FCU_COMPS } from "@/modules/hvac-estimator/components/fcu/fcuData";
import { UH_COMPS } from "@/modules/hvac-estimator/components/uh/uhData";
import { DX_COMPS } from "@/modules/hvac-estimator/components/dx/dxData";
import { VRF_COMPS } from "@/modules/hvac-estimator/components/vrf/vrfData";
import { NETWORK_COMPS } from "@/modules/hvac-estimator/components/network/networkData";
import { EXHAUST_FAN_COMPS } from "@/modules/hvac-estimator/components/exhaustFan/exhaustFanData";
import { resolveAssemblyCatalogMatch } from "@/modules/hvac-estimator/ai/assemblyResolver";
import { AssemblyTrainingClient } from "./assembly-training-client";

export const dynamic = "force-dynamic";

export type CatalogOption = {
  componentId: string;
  emtAID: string;
  plnAID: string;
  name: string;
  cat: string;
  equipmentType: string;
};

type RawComp = { id: string; emtAID?: unknown; plnAID?: unknown; name?: unknown; cat?: unknown; hidden?: boolean };

function buildOptions(comps: RawComp[], type: string): CatalogOption[] {
  return comps
    .filter((c) => c.emtAID && c.name && !c.hidden)
    .map((c) => ({
      componentId: c.id,
      emtAID: String(c.emtAID),
      plnAID: String(c.plnAID ?? c.emtAID),
      name: String(c.name),
      cat: String(c.cat ?? ""),
      equipmentType: type,
    }));
}

export async function resolveAssemblyAction(sourceText: string, equipmentType: string): Promise<{ id: string; name: string; matchedBy: string } | null> {
  "use server";
  return resolveAssemblyCatalogMatch({ assemblyName: sourceText, sourceText });
}

export default async function AssemblyTrainingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const profile = await resolveUserRole(user);
  if (!["admin", "estimator"].includes(profile?.role ?? "")) notFound();

  const asRaw = (arr: unknown) => arr as RawComp[];
  const catalogByType: Record<string, CatalogOption[]> = {
    vav: buildOptions(asRaw(VAV_COMPS), "vav"),
    ahu: buildOptions(asRaw(AHU_COMPS), "ahu"),
    rtu: buildOptions(asRaw(RTU_COMPS), "rtu"),
    fcu: buildOptions(asRaw(FCU_COMPS), "fcu"),
    uh: buildOptions(asRaw(UH_COMPS), "uh"),
    dx: buildOptions(asRaw(DX_COMPS), "dx"),
    vrf: buildOptions(asRaw(VRF_COMPS), "vrf"),
    network: buildOptions(asRaw(NETWORK_COMPS), "network"),
    "exhaust-fan": buildOptions(asRaw(EXHAUST_FAN_COMPS), "exhaust-fan"),
  };

  return <AssemblyTrainingClient catalogByType={catalogByType} resolveAssembly={resolveAssemblyAction} />;
}

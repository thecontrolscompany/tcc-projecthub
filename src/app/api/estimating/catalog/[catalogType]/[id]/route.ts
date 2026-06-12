import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function resolveTable(catalogType: string) {
  if (catalogType === "install") return "install_assembly_catalog";
  if (catalogType === "controls") return "controls_assembly_catalog";
  return null;
}

async function resolveOrganizationId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  explicitOrganizationId?: string | null,
) {
  if (explicitOrganizationId) return explicitOrganizationId;

  const { data: defaultOrgId } = await supabase.rpc("current_user_default_organization_id");
  if (typeof defaultOrgId === "string" && defaultOrgId.trim()) {
    return defaultOrgId;
  }

  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ catalogType: string; id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { catalogType, id } = await params;
  const table = resolveTable(catalogType);
  if (!table) {
    return NextResponse.json({ error: "Invalid catalog type." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        organizationId?: string | null;
        mtlUnit?: number | string | null;
        hrsUnit?: number | string | null;
        alternateIds?: string[] | null;
        partNumber?: string | null;
        manufacturer?: string | null;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const organizationId = await resolveOrganizationId(supabase, body.organizationId ?? null);
  if (!organizationId) {
    return NextResponse.json({ error: "No organization selected." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (body.mtlUnit !== undefined && body.mtlUnit !== null && body.mtlUnit !== "") {
    const mtlUnit = Number(body.mtlUnit);
    if (!Number.isFinite(mtlUnit) || mtlUnit < 0) {
      return NextResponse.json({ error: "Invalid material unit price." }, { status: 400 });
    }
    patch.mtl_unit = mtlUnit;
  }

  if (body.hrsUnit !== undefined && body.hrsUnit !== null && body.hrsUnit !== "") {
    const hrsUnit = Number(body.hrsUnit);
    if (!Number.isFinite(hrsUnit) || hrsUnit < 0) {
      return NextResponse.json({ error: "Invalid labor unit price." }, { status: 400 });
    }
    patch.hrs_unit = hrsUnit;
  }

  if (Array.isArray(body.alternateIds)) {
    patch.alternate_ids = body.alternateIds.filter((value) => typeof value === "string");
  }

  if (catalogType === "controls") {
    if (body.partNumber !== undefined) {
      patch.part_number = typeof body.partNumber === "string" && body.partNumber.trim() ? body.partNumber.trim() : null;
    }
    if (body.manufacturer !== undefined) {
      patch.manufacturer = typeof body.manufacturer === "string" && body.manufacturer.trim() ? body.manufacturer.trim() : null;
    }
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const selectColumns =
    catalogType === "install"
      ? "id, organization_id, description, mtl_unit, mtl_per, hrs_unit, hrs_per, category, freq, alternate_ids"
      : "id, organization_id, description, mtl_unit, mtl_per, hrs_unit, hrs_per, category, alternate_ids, part_number, manufacturer, io_type";

  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select(selectColumns)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "Catalog item not found." }, { status: 404 });
  }

  return NextResponse.json({ row: data });
}

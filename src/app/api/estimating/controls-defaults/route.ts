import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type OverrideRow = {
  component_key: string;
  controls_catalog_id: string;
};

async function resolveOrganizationId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  explicitOrganizationId?: string | null,
) {
  if (typeof explicitOrganizationId === "string" && explicitOrganizationId.trim()) {
    return explicitOrganizationId.trim();
  }

  const { data: defaultOrgId } = await supabase.rpc("current_user_default_organization_id");
  if (typeof defaultOrgId === "string" && defaultOrgId.trim()) {
    return defaultOrgId.trim();
  }

  return null;
}

async function loadOverrides(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string) {
  const { data, error } = await supabase
    .from("estimator_controls_defaults")
    .select("component_key, controls_catalog_id")
    .eq("organization_id", organizationId)
    .order("component_key", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as OverrideRow[];
}

function buildOverridesPayload(rows: OverrideRow[]) {
  return rows.reduce<Record<string, string>>((acc, row) => {
    if (typeof row.component_key !== "string" || !row.component_key.trim()) return acc;
    if (typeof row.controls_catalog_id !== "string" || !row.controls_catalog_id.trim()) return acc;
    acc[row.component_key.trim()] = row.controls_catalog_id.trim();
    return acc;
  }, {});
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const organizationId = await resolveOrganizationId(supabase, new URL(request.url).searchParams.get("organizationId"));
  if (!organizationId) {
    return NextResponse.json({ error: "No organization selected." }, { status: 400 });
  }

  try {
    const overrides = buildOverridesPayload(await loadOverrides(supabase, organizationId));
    return NextResponse.json({ overrides });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load controls defaults." },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        organizationId?: string | null;
        componentKey?: string | null;
        controlsCatalogId?: string | null;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const organizationId = await resolveOrganizationId(supabase, body.organizationId ?? null);
  if (!organizationId) {
    return NextResponse.json({ error: "No organization selected." }, { status: 400 });
  }

  const componentKey = typeof body.componentKey === "string" ? body.componentKey.trim() : "";
  const controlsCatalogId = typeof body.controlsCatalogId === "string" ? body.controlsCatalogId.trim() : "";
  if (!componentKey || !controlsCatalogId) {
    return NextResponse.json({ error: "componentKey and controlsCatalogId are required." }, { status: 400 });
  }

  const { data: controlsCatalogRow, error: controlsCatalogError } = await supabase
    .from("controls_assembly_catalog")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", controlsCatalogId)
    .maybeSingle();

  if (controlsCatalogError) {
    return NextResponse.json({ error: controlsCatalogError.message }, { status: 400 });
  }

  if (!controlsCatalogRow) {
    return NextResponse.json({ error: "Controls catalog item not found." }, { status: 404 });
  }

  const { error: upsertError } = await supabase
    .from("estimator_controls_defaults")
    .upsert(
      {
        organization_id: organizationId,
        component_key: componentKey,
        controls_catalog_id: controlsCatalogId,
      },
      { onConflict: "organization_id,component_key" },
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 });
  }

  try {
    const overrides = buildOverridesPayload(await loadOverrides(supabase, organizationId));
    return NextResponse.json({ overrides });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load controls defaults." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        organizationId?: string | null;
        componentKey?: string | null;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const organizationId = await resolveOrganizationId(supabase, body.organizationId ?? null);
  if (!organizationId) {
    return NextResponse.json({ error: "No organization selected." }, { status: 400 });
  }

  const componentKey = typeof body.componentKey === "string" ? body.componentKey.trim() : "";
  if (!componentKey) {
    return NextResponse.json({ error: "componentKey is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("estimator_controls_defaults")
    .delete()
    .eq("organization_id", organizationId)
    .eq("component_key", componentKey);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    const overrides = buildOverridesPayload(await loadOverrides(supabase, organizationId));
    return NextResponse.json({ overrides });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load controls defaults." },
      { status: 400 },
    );
  }
}

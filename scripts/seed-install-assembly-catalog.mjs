import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { UNIT_ITEMS } from "../src/modules/hvac-estimator/shared/assemblyData.js";

config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { data: organization, error: organizationError } = await supabase
  .from("organizations")
  .select("id")
  .eq("slug", "tcc")
  .maybeSingle();

if (organizationError) {
  console.error("Failed to load tcc organization:", organizationError.message);
  process.exit(1);
}

if (!organization?.id) {
  console.error("Could not find the tcc organization.");
  process.exit(1);
}

const rows = Object.values(UNIT_ITEMS).map((item) => ({
  id: item.id,
  organization_id: organization.id,
  description: item.desc,
  mtl_unit: item.mtlUnit,
  mtl_per: item.mtlPer,
  hrs_unit: item.hrsUnit,
  hrs_per: item.hrsPer,
  category: item.category ?? null,
  freq: Boolean(item.freq),
  alternate_ids: [],
}));

const chunkSize = 100;
let upserted = 0;

for (let index = 0; index < rows.length; index += chunkSize) {
  const chunk = rows.slice(index, index + chunkSize);
  const { data, error } = await supabase
    .from("install_assembly_catalog")
    .upsert(chunk, { onConflict: "organization_id,id" })
    .select("id");

  if (error) {
    console.error("Seed upsert failed:", error.message);
    process.exit(1);
  }

  upserted += data?.length ?? chunk.length;
}

console.log(`Upserted ${upserted} install catalog rows for tcc (${organization.id}).`);

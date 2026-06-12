import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const CONTROLS_CATALOG_ITEMS = [
  { id: "CTL-DDC-08", desc: "DDC Controller - 8 Point Capacity", mtlUnit: 650, hrsUnit: 3.0, category: "DDC Controllers", alternateIds: ["CTL-DDC-16", "CTL-DDC-32", "CTL-DDC-64"] },
  { id: "CTL-DDC-16", desc: "DDC Controller - 16 Point Capacity", mtlUnit: 950, hrsUnit: 4.0, category: "DDC Controllers", alternateIds: ["CTL-DDC-08", "CTL-DDC-32", "CTL-DDC-64"] },
  { id: "CTL-DDC-32", desc: "DDC Controller - 32 Point Capacity", mtlUnit: 1450, hrsUnit: 5.0, category: "DDC Controllers", alternateIds: ["CTL-DDC-08", "CTL-DDC-16", "CTL-DDC-64"] },
  { id: "CTL-DDC-64", desc: "DDC Controller - 64 Point Capacity", mtlUnit: 2400, hrsUnit: 6.0, category: "DDC Controllers", alternateIds: ["CTL-DDC-08", "CTL-DDC-16", "CTL-DDC-32"] },
  { id: "CTL-IO-08", desc: "IO Expansion Module - 8 Point", mtlUnit: 285, hrsUnit: 1.0, category: "IO Modules", alternateIds: ["CTL-IO-16"] },
  { id: "CTL-IO-16", desc: "IO Expansion Module - 16 Point", mtlUnit: 485, hrsUnit: 1.5, category: "IO Modules", alternateIds: ["CTL-IO-08"] },
  { id: "CTL-PNL-SM", desc: "Control Panel Enclosure - Small (1-2 Controllers)", mtlUnit: 385, hrsUnit: 4.0, category: "Panels", alternateIds: ["CTL-PNL-MD", "CTL-PNL-LG"] },
  { id: "CTL-PNL-MD", desc: "Control Panel Enclosure - Medium (3-5 Controllers)", mtlUnit: 685, hrsUnit: 6.0, category: "Panels", alternateIds: ["CTL-PNL-SM", "CTL-PNL-LG"] },
  { id: "CTL-PNL-LG", desc: "Control Panel Enclosure - Large (6+ Controllers)", mtlUnit: 1150, hrsUnit: 9.0, category: "Panels", alternateIds: ["CTL-PNL-SM", "CTL-PNL-MD"] },
  { id: "CTL-NET-SUP", desc: "Supervisory Controller - BACnet/IP Building Controller", mtlUnit: 2850, hrsUnit: 8.0, category: "Network", alternateIds: [] },
  { id: "CTL-NET-SW8", desc: "Managed Network Switch - 8 Port", mtlUnit: 285, hrsUnit: 1.0, category: "Network", alternateIds: ["CTL-NET-SW16"] },
  { id: "CTL-NET-SW16", desc: "Managed Network Switch - 16 Port", mtlUnit: 485, hrsUnit: 1.5, category: "Network", alternateIds: ["CTL-NET-SW8"] },
  { id: "CTL-ENG-PROGRAM", desc: "Sequence of Operations Programming - per Controller", mtlUnit: 0, hrsUnit: 4.0, category: "Engineering Labor", alternateIds: [] },
  { id: "CTL-ENG-COMMISSION", desc: "System Commissioning & Functional Test - per Controller", mtlUnit: 0, hrsUnit: 3.0, category: "Engineering Labor", alternateIds: [] },
  { id: "CTL-ENG-SUBMITTAL", desc: "Controls Submittal Package - per Project", mtlUnit: 0, hrsUnit: 8.0, category: "Engineering Labor", alternateIds: [] },
  { id: "CTL-GFX-EQUIP", desc: "Equipment Graphic - per Unit", mtlUnit: 0, hrsUnit: 1.5, category: "Graphics", alternateIds: [] },
  { id: "CTL-GFX-FLOORPLAN", desc: "Floor Plan / Summary Graphic - per Page", mtlUnit: 0, hrsUnit: 2.5, category: "Graphics", alternateIds: [] },
  { id: "CTL-LIC-DEVICE", desc: "Device Connection License - per Controller", mtlUnit: 125, hrsUnit: 0, category: "Software", alternateIds: [] },
  { id: "CTL-LIC-WORKSTATION", desc: "Engineering/Operator Workstation License", mtlUnit: 1850, hrsUnit: 0, category: "Software", alternateIds: [] },
];

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

const rows = CONTROLS_CATALOG_ITEMS.map((item) => ({
  id: item.id,
  organization_id: organization.id,
  description: item.desc,
  mtl_unit: item.mtlUnit,
  mtl_per: "E",
  hrs_unit: item.hrsUnit,
  hrs_per: "E",
  category: item.category,
  alternate_ids: item.alternateIds,
}));

const { data, error } = await supabase
  .from("controls_assembly_catalog")
  .upsert(rows, { onConflict: "organization_id,id" })
  .select("id");

if (error) {
  console.error("Seed upsert failed:", error.message);
  process.exit(1);
}

console.log(`Upserted ${data?.length ?? rows.length} controls catalog rows for tcc (${organization.id}).`);

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

const FIELD_DEVICE_ROWS = [
  { id: "CTL-DEV-TEMP-DUCT", description: "Duct-Mount Temperature Sensor", category: "Temperature", io_type: "AI", part_number: "TE-6311M-1", manufacturer: "Johnson Controls", mtl_unit: 30.00, hrs_unit: 0.5 },
  { id: "CTL-DEV-TEMP-SPACE", description: "Wall-Mount Space/Zone Temperature Sensor", category: "Temperature", io_type: "AI", part_number: "NSB8BTN240-0G", manufacturer: "Johnson Controls", mtl_unit: 150.00, hrs_unit: 0.75 },
  { id: "CTL-DEV-TEMP-PIPE", description: "Pipe-Mount/Immersion Hydronic Temperature Sensor", category: "Temperature", io_type: "AI", part_number: "TE-631AP-1", manufacturer: "Johnson Controls", mtl_unit: 90.00, hrs_unit: 1.0 },
  { id: "CTL-DEV-TEMP-STEAM", description: "High-Temp Steam Pipe Sensor", category: "Temperature", io_type: "AI", part_number: null, manufacturer: null, mtl_unit: 120.00, hrs_unit: 1.0 },
  { id: "CTL-DEV-TEMP-CO2", description: "Zone Temp + CO2 Combo Sensor", category: "Air Quality", io_type: "AI", part_number: "NSB8BTC240-0G", manufacturer: "Johnson Controls", mtl_unit: 490.00, hrs_unit: 1.0 },
  { id: "CTL-DEV-HUMID-DUCT", description: "Duct-Mount Humidity Sensor", category: "Humidity", io_type: "AI", part_number: "HE-69130NP-0", manufacturer: "Honeywell", mtl_unit: 350.00, hrs_unit: 0.75 },
  { id: "CTL-DEV-PRESS-DUCT", description: "Duct/Building Static Pressure Transmitter", category: "Pressure", io_type: "AI", part_number: "DP140005U11D", manufacturer: "Johnson Controls", mtl_unit: 205.00, hrs_unit: 1.0 },
  { id: "CTL-DEV-PRESS-FILTER", description: "Filter Differential Pressure Switch", category: "Pressure", io_type: "AI", part_number: "A/DLP-010-W-U-D-A-3", manufacturer: "ACI", mtl_unit: 256.00, hrs_unit: 0.75 },
  { id: "CTL-DEV-PRESS-FLOW", description: "VAV Flow/Velocity Sensor (DP pickup)", category: "Pressure", io_type: "AI", part_number: null, manufacturer: null, mtl_unit: 150.00, hrs_unit: 0.75 },
  { id: "CTL-DEV-PRESS-DP-SYS", description: "Hydronic System Differential Pressure Transmitter", category: "Pressure", io_type: "AI", part_number: "A/WPR2-100-20-LCD", manufacturer: "ACI", mtl_unit: 608.00, hrs_unit: 1.5 },
  { id: "CTL-DEV-PRESS-STEAM", description: "Steam Pressure Transmitter", category: "Pressure", io_type: "AI", part_number: null, manufacturer: null, mtl_unit: 450.00, hrs_unit: 1.5 },
  { id: "CTL-DEV-FLOW-METER", description: "Insertion Flow Meter", category: "Pressure", io_type: "AI", part_number: "F-1134-10-00-32", manufacturer: "ONICON", mtl_unit: 965.00, hrs_unit: 4.0 },
  { id: "CTL-DEV-ACT-DAMPER-MOD", description: "Modulating Damper Actuator (spring return)", category: "Actuators", io_type: "AO", part_number: "M9220-GGA-3", manufacturer: "Johnson Controls", mtl_unit: 470.00, hrs_unit: 1.5 },
  { id: "CTL-DEV-ACT-DAMPER-2POS", description: "Two-Position Damper Actuator", category: "Actuators", io_type: "BO", part_number: "M9220-BGC-3", manufacturer: "Johnson Controls", mtl_unit: 465.00, hrs_unit: 1.0 },
  { id: "CTL-DEV-ACT-VALVE-MOD", description: "Modulating Coil/Bypass Valve Actuator", category: "Actuators", io_type: "AO", part_number: null, manufacturer: null, mtl_unit: 350.00, hrs_unit: 1.5 },
  { id: "CTL-DEV-ACT-VALVE-2POS", description: "Two-Position/Incremental Valve Actuator", category: "Actuators", io_type: "BO", part_number: null, manufacturer: null, mtl_unit: 250.00, hrs_unit: 1.0 },
  { id: "CTL-DEV-ACT-ISO-VALVE", description: "Isolation Valve with End Switch", category: "Actuators", io_type: "BO", part_number: null, manufacturer: null, mtl_unit: 750.00, hrs_unit: 2.0 },
  { id: "CTL-DEV-VFD-INTERFACE", description: "VFD Analog Speed Reference Interface", category: "Drives", io_type: "AO", part_number: null, manufacturer: null, mtl_unit: 75.00, hrs_unit: 1.0 },
  { id: "CTL-DEV-STAGE-RELAY", description: "Staged/Binary Output Relay Interface", category: "Actuators", io_type: "BO", part_number: "RIBU1C", manufacturer: "Functional Devices", mtl_unit: 25.00, hrs_unit: 0.5 },
  { id: "CTL-DEV-FREEZESTAT", description: "Freezestat (Low-Limit Sensor)", category: "Safety", io_type: "BI", part_number: "A70HA-1G", manufacturer: "Johnson Controls", mtl_unit: 350.00, hrs_unit: 1.0 },
  { id: "CTL-DEV-SMOKE", description: "Duct Smoke Detector", category: "Safety", io_type: "BI", part_number: null, manufacturer: null, mtl_unit: 250.00, hrs_unit: 1.5 },
  { id: "CTL-DEV-CONDENSATE", description: "Condensate Float Switch/Alarm", category: "Safety", io_type: "BI", part_number: null, manufacturer: null, mtl_unit: 45.00, hrs_unit: 0.5 },
  { id: "CTL-DEV-FAN-STATUS", description: "Fan Current/Status Switch", category: "Safety", io_type: "BI", part_number: "CSD-CA1G1-1", manufacturer: "Johnson Controls", mtl_unit: 182.00, hrs_unit: 0.75 },
  { id: "CTL-DEV-REFRIG-LEAK", description: "Refrigerant Leak Sensor", category: "Safety", io_type: "BI", part_number: null, manufacturer: null, mtl_unit: 350.00, hrs_unit: 1.0 },
  { id: "CTL-DEV-WHEEL-SPD", description: "ERV Wheel Speed Controller", category: "Actuators", io_type: "AO", part_number: null, manufacturer: null, mtl_unit: 450.00, hrs_unit: 1.5 },
  { id: "CTL-DEV-RAC-PUMP", description: "Run-Around Pump Controller", category: "Actuators", io_type: "AO", part_number: null, manufacturer: null, mtl_unit: 200.00, hrs_unit: 1.0 },
  { id: "CTL-DEV-VRF-BRANCH", description: "VRF Branch Selector Interface", category: "Actuators", io_type: "BO", part_number: null, manufacturer: null, mtl_unit: 400.00, hrs_unit: 1.5 },
  { id: "CTL-DEV-VAV-CTRL", description: "VAV Box Controller w/ Integral Actuator, DPT, BACnet", category: "DDC Controllers", io_type: null, part_number: "M4-CVM03050-0", manufacturer: "Johnson Controls", mtl_unit: 1306.79, hrs_unit: 1.0 },
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

const rows = FIELD_DEVICE_ROWS.map((item) => ({
  id: item.id,
  organization_id: organization.id,
  description: item.description,
  mtl_unit: item.mtl_unit,
  mtl_per: "E",
  hrs_unit: item.hrs_unit,
  hrs_per: "E",
  category: item.category,
  io_type: item.io_type,
  alternate_ids: [],
  part_number: item.part_number,
  manufacturer: item.manufacturer,
}));

const { data, error } = await supabase
  .from("controls_assembly_catalog")
  .upsert(rows, { onConflict: "organization_id,id" })
  .select("id");

if (error) {
  console.error("Seed upsert failed:", error.message);
  process.exit(1);
}

console.log(`Upserted ${data?.length ?? rows.length} field device catalog rows for tcc (${organization.id}).`);

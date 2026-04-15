import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminWithMicrosoft } from "@/lib/opportunity-import-server";
import { scanOneDriveArchive } from "@/lib/onedrive-archive-scanner";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireAdminWithMicrosoft();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const yearFilter = typeof body?.yearFilter === "string" ? body.yearFilter : undefined;

  try {
    const manifest = await scanOneDriveArchive(auth.providerToken, yearFilter);

    const supabase = await createClient();
    const { data: existingPursuits } = await supabase
      .from("pursuits")
      .select("project_name");

    const existingNames = new Set(
      (existingPursuits ?? []).map((pursuit) => pursuit.project_name.toLowerCase().trim())
    );

    const enriched = manifest.map((entry) => ({
      ...entry,
      already_imported: existingNames.has(entry.pursuit_name.toLowerCase().trim()),
    }));

    return NextResponse.json({
      manifest: enriched,
      total: enriched.length,
      warnings: enriched.filter((entry) => entry.warnings.length > 0).length,
      alreadyImported: enriched.filter((entry) => entry.already_imported).length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scan failed." },
      { status: 500 }
    );
  }
}

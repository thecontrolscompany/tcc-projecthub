import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/opportunity-import-server";
import { normalizePursuitStatus } from "@/lib/pursuit-status";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { supabase } = auth;
  const text = await request.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV has no data rows." }, { status: 400 });
  }

  const header = lines[0]!.split(",").map((column) => column.trim().replace(/^"|"$/g, ""));
  const idIndex = header.indexOf("id");
  const ownerIndex = header.indexOf("owner_name");
  const locationIndex = header.indexOf("project_location");
  const statusIndex = header.indexOf("status");

  if (idIndex === -1) {
    return NextResponse.json({ error: "CSV must have an 'id' column." }, { status: 400 });
  }

  let updated = 0;
  let skipped = 0;

  for (const line of lines.slice(1)) {
    const columns = parseCsvLine(line);
    const id = columns[idIndex]?.trim();
    if (!id) {
      skipped++;
      continue;
    }

    const patch: Record<string, string | null> = {};

    if (ownerIndex !== -1) {
      const value = columns[ownerIndex]?.trim() ?? "";
      patch.owner_name = value === "" ? null : value;
    }

    if (locationIndex !== -1) {
      const value = columns[locationIndex]?.trim() ?? "";
      patch.project_location = value === "" ? null : value;
    }

    if (statusIndex !== -1) {
      const value = columns[statusIndex]?.trim() ?? "";
      const normalized = normalizePursuitStatus(value);
      if (normalized) {
        patch.status = normalized;
      }
    }

    if (Object.keys(patch).length === 0) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from("pursuits").update(patch).eq("id", id);
    if (error) skipped++;
    else updated++;
  }

  return NextResponse.json({ ok: true, updated, skipped });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += character;
    }
  }

  result.push(current);
  return result;
}

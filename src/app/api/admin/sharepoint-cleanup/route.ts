import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getSharePointSiteId,
  getSharePointDriveId,
  listSharePointFolders,
  deleteSharePointItem,
} from "@/lib/graph/client";

const DUPLICATE_PATTERN = / \d+$/;

async function requireAdminWithToken() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.provider_token) {
    return {
      error: NextResponse.json(
        { error: "Microsoft access token not available for SharePoint cleanup." },
        { status: 400 }
      ),
    };
  }

  return { providerToken: session.provider_token };
}

export async function GET() {
  const auth = await requireAdminWithToken();
  if ("error" in auth) return auth.error;

  try {
    const siteId = await getSharePointSiteId(auth.providerToken);
    const driveId = await getSharePointDriveId(auth.providerToken, siteId);
    const libraries = ["Active Projects", "Completed Projects", "Bids"] as const;

    const duplicates: Array<{ id: string; name: string; library: string; itemId: string }> = [];

    const rootItems = await listSharePointFolders(auth.providerToken, driveId, "");
    for (const item of rootItems) {
      if (DUPLICATE_PATTERN.test(item.name)) {
        duplicates.push({
          id: `${item.id}:${item.name}`,
          name: item.name,
          library: "Root",
          itemId: item.id,
        });
      }
    }

    for (const library of libraries) {
      const items = await listSharePointFolders(auth.providerToken, driveId, library);
      for (const item of items) {
        if (DUPLICATE_PATTERN.test(item.name)) {
          duplicates.push({
            id: `${library}:${item.id}`,
            name: item.name,
            library,
            itemId: item.id,
          });
        }
      }
    }

    return NextResponse.json({ driveId, duplicates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cleanup scan failed." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdminWithToken();
  if ("error" in auth) return auth.error;

  const { driveId, itemIds } = await request.json() as { driveId: string; itemIds: string[] };

  if (!driveId || !Array.isArray(itemIds)) {
    return NextResponse.json({ error: "driveId and itemIds are required." }, { status: 400 });
  }

  const result = {
    deleted: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const itemId of itemIds) {
    try {
      await deleteSharePointItem(auth.providerToken, driveId, itemId);
      result.deleted += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(
        `${itemId}: ${error instanceof Error ? error.message : "Delete failed."}`
      );
    }
  }

  return NextResponse.json(result);
}

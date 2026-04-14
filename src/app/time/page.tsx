export const dynamic = "force-dynamic";

import { TimeModuleError, TimeModuleHome } from "@/components/time/time-module";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWeekBounds, getTimeModuleSnapshot, getWeeklyTimeSummary } from "@/lib/time/data";

export default async function TimeHomePage() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const resolvedProfile = user ? await resolveUserRole(user) : null;
    const { weekStart } = getCurrentWeekBounds();
    const [snapshot, weeklySummary] = await Promise.all([
      getTimeModuleSnapshot(),
      getWeeklyTimeSummary(supabase, weekStart).catch(() => null)
    ]);

    return (
      <TimeModuleHome
        snapshot={snapshot}
        weeklySummary={weeklySummary}
        isAdmin={resolvedProfile?.role === "admin"}
      />
    );
  } catch (error) {
    return (
      <TimeModuleError
        message={error instanceof Error ? error.message : "Unable to load the TCC Time module."}
      />
    );
  }
}

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { TimeReconciliationPage } from "@/components/time/time-reconciliation-page";
import { TimeModuleError } from "@/components/time/time-module";
import { resolveUserRole } from "@/lib/auth/resolve-user-role";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";
import { roleHome } from "@/lib/auth/role-routes";
import { getQuickBooksTimeConnectionStatus } from "@/lib/qb-time/tokens";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentWeekBounds,
  getProjectReconcileSnapshot,
  getTimeModuleSnapshot,
  getTimeReconcileSnapshot,
  getWeeklyTimeSummary,
} from "@/lib/time/data";

export default async function TimeReconciliationRoute({
  searchParams,
}: {
  searchParams?: Promise<{
    tab?: string;
    qb_time_oauth?: string;
    qb_time_oauth_message?: string;
  }>;
}) {
  const identity = await getShellIdentity("admin");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const resolvedProfile = user ? await resolveUserRole(user) : null;

  if (identity.role !== "admin" && identity.role !== "ops_manager") {
    redirect(roleHome(identity.role));
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeTab =
    resolvedSearchParams.tab === "projects"
      ? "projects"
      : resolvedSearchParams.tab === "employees"
        ? "employees"
        : "overview";
  const qbTimeOAuthState = resolvedSearchParams.qb_time_oauth === "success"
    ? "success"
    : resolvedSearchParams.qb_time_oauth === "error"
      ? "error"
      : null;
  const qbTimeOAuthMessage = resolvedSearchParams.qb_time_oauth_message ?? null;

  try {
    const { weekStart } = getCurrentWeekBounds();
    const [moduleSnapshot, employeeSnapshot, projectSnapshot, weeklySummary, qbTimeConnectionStatus] = await Promise.all([
      getTimeModuleSnapshot(),
      getTimeReconcileSnapshot(),
      getProjectReconcileSnapshot(),
      getWeeklyTimeSummary(weekStart).catch(() => null),
      getQuickBooksTimeConnectionStatus().catch(() => ({
        connected: false,
        realmId: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        refreshTokenExpiringSoon: false,
      })),
    ]);

    return (
      <TimeReconciliationPage
        moduleSnapshot={moduleSnapshot}
        employeeSnapshot={employeeSnapshot}
        projectSnapshot={projectSnapshot}
        weeklySummary={weeklySummary}
        isAdmin={resolvedProfile?.role === "admin"}
        activeTab={activeTab}
        qbTimeConnectionStatus={qbTimeConnectionStatus}
        qbTimeOAuthState={qbTimeOAuthState}
        qbTimeOAuthMessage={qbTimeOAuthMessage}
      />
    );
  } catch (error) {
    return (
      <TimeModuleError
        message={error instanceof Error ? error.message : "Unable to load the reconciliation workspace."}
      />
    );
  }
}

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { TimeReconciliationPage } from "@/components/time/time-reconciliation-page";
import { TimeModuleError } from "@/components/time/time-module";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";
import { roleHome } from "@/lib/auth/role-routes";
import { getProjectReconcileSnapshot, getTimeReconcileSnapshot } from "@/lib/time/data";

export default async function TimeReconciliationRoute({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const identity = await getShellIdentity("admin");

  if (identity.role !== "admin") {
    redirect(roleHome(identity.role));
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeTab = resolvedSearchParams.tab === "projects" ? "projects" : "employees";

  try {
    const [employeeSnapshot, projectSnapshot] = await Promise.all([
      getTimeReconcileSnapshot(),
      getProjectReconcileSnapshot(),
    ]);

    return (
      <TimeReconciliationPage
        employeeSnapshot={employeeSnapshot}
        projectSnapshot={projectSnapshot}
        activeTab={activeTab}
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

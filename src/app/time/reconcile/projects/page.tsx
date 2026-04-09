export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { TimeModuleError } from "@/components/time/time-module";
import { TimeReconcileProjectsPage } from "@/components/time/time-reconcile-projects-page";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";
import { roleHome } from "@/lib/auth/role-routes";
import { getProjectReconcileSnapshot } from "@/lib/time/data";

export default async function TimeReconcileProjectsRoute() {
  const identity = await getShellIdentity("admin");

  if (identity.role !== "admin") {
    redirect(roleHome(identity.role));
  }

  try {
    const snapshot = await getProjectReconcileSnapshot();
    return <TimeReconcileProjectsPage snapshot={snapshot} />;
  } catch (error) {
    return (
      <TimeModuleError
        message={error instanceof Error ? error.message : "Unable to load the project reconciliation queue."}
      />
    );
  }
}

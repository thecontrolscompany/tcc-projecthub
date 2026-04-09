export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { TimeModuleError } from "@/components/time/time-module";
import { TimeReconcilePage } from "@/components/time/time-reconcile-page";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";
import { roleHome } from "@/lib/auth/role-routes";
import { getTimeReconcileSnapshot } from "@/lib/time/data";

export default async function TimeReconcileRoute() {
  const identity = await getShellIdentity("admin");

  if (identity.role !== "admin") {
    redirect(roleHome(identity.role));
  }

  try {
    const snapshot = await getTimeReconcileSnapshot();
    return <TimeReconcilePage snapshot={snapshot} />;
  } catch (error) {
    return (
      <TimeModuleError
        message={error instanceof Error ? error.message : "Unable to load the employee reconciliation queue."}
      />
    );
  }
}

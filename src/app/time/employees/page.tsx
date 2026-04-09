export const dynamic = "force-dynamic";

import { TimeEmployeesPage, TimeModuleError } from "@/components/time/time-module";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";
import { getTimeModuleSnapshot } from "@/lib/time/data";

export default async function EmployeesPage() {
  const identity = await getShellIdentity("ops_manager");

  try {
    const snapshot = await getTimeModuleSnapshot();
    return <TimeEmployeesPage users={snapshot.users} canManage={identity.role === "admin"} />;
  } catch (error) {
    return (
      <TimeModuleError
        message={error instanceof Error ? error.message : "Unable to load imported QuickBooks users."}
      />
    );
  }
}

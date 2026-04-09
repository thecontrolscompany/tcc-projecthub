export const dynamic = "force-dynamic";

import { TimeEmployeesPage, TimeModuleError } from "@/components/time/time-module";
import { getTimeModuleSnapshot } from "@/lib/time/data";

export default async function EmployeesPage() {
  try {
    const snapshot = await getTimeModuleSnapshot();
    return <TimeEmployeesPage users={snapshot.users} />;
  } catch (error) {
    return (
      <TimeModuleError
        message={error instanceof Error ? error.message : "Unable to load imported QuickBooks users."}
      />
    );
  }
}

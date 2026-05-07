export const dynamic = "force-dynamic";

import { TimeEmployeesPage, TimeModuleError } from "@/components/time/time-module";
export default async function EmployeesPage() {
  try {
    return <TimeEmployeesPage />;
  } catch (error) {
    return (
      <TimeModuleError
        message={error instanceof Error ? error.message : "Unable to load imported QuickBooks users."}
      />
    );
  }
}

export const dynamic = "force-dynamic";

import { TimeModuleError, TimeProjectsPage } from "@/components/time/time-module";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";
import { getTimeModuleSnapshot } from "@/lib/time/data";

export default async function ProjectsPage() {
  const identity = await getShellIdentity("ops_manager");

  try {
    const snapshot = await getTimeModuleSnapshot();
    return <TimeProjectsPage projects={snapshot.projects} canManage={identity.role === "admin"} />;
  } catch (error) {
    return (
      <TimeModuleError
        message={error instanceof Error ? error.message : "Unable to load imported QuickBooks jobcodes."}
      />
    );
  }
}

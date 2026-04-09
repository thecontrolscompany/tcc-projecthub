export const dynamic = "force-dynamic";

import { TimeModuleError, TimeProjectsPage } from "@/components/time/time-module";
import { getTimeModuleSnapshot } from "@/lib/time/data";

export default async function ProjectsPage() {
  try {
    const snapshot = await getTimeModuleSnapshot();
    return <TimeProjectsPage projects={snapshot.projects} />;
  } catch (error) {
    return (
      <TimeModuleError
        message={error instanceof Error ? error.message : "Unable to load imported QuickBooks jobcodes."}
      />
    );
  }
}

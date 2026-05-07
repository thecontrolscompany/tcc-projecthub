export const dynamic = "force-dynamic";

import { TimeModuleError, TimeProjectsPage } from "@/components/time/time-module";

export default async function ProjectsPage() {
  try {
    return <TimeProjectsPage />;
  } catch (error) {
    return (
      <TimeModuleError
        message={error instanceof Error ? error.message : "Unable to load imported QuickBooks jobcodes."}
      />
    );
  }
}

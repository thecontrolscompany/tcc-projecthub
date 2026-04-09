export const dynamic = "force-dynamic";

import { TimeClockPage, TimeModuleError } from "@/components/time/time-module";
import { getTimeModuleSnapshot } from "@/lib/time/data";

export default async function ClockPage() {
  try {
    const snapshot = await getTimeModuleSnapshot();
    return <TimeClockPage projects={snapshot.projects} latestRun={snapshot.latestRun} />;
  } catch (error) {
    return (
      <TimeModuleError
        message={error instanceof Error ? error.message : "Unable to load time clock data."}
      />
    );
  }
}

export const dynamic = "force-dynamic";

import { TimeClockPage, TimeModuleError } from "@/components/time/time-module";
import { TimeSubnav } from "@/components/time/time-subnav";
import { getTimeModuleSnapshot } from "@/lib/time/data";

export default async function ClockPage() {
  try {
    const snapshot = await getTimeModuleSnapshot();
    return (
      <div className="space-y-6">
        <TimeSubnav />
        <TimeClockPage latestRun={snapshot.latestRun} />
      </div>
    );
  } catch (error) {
    return (
      <div className="space-y-6">
        <TimeSubnav />
        <TimeModuleError
          message={error instanceof Error ? error.message : "Unable to load time clock data."}
        />
      </div>
    );
  }
}

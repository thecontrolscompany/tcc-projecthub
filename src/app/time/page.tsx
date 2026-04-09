export const dynamic = "force-dynamic";

import { TimeModuleError, TimeModuleHome } from "@/components/time/time-module";
import { getTimeModuleSnapshot } from "@/lib/time/data";

export default async function TimeHomePage() {
  try {
    const snapshot = await getTimeModuleSnapshot();
    return <TimeModuleHome snapshot={snapshot} />;
  } catch (error) {
    return (
      <TimeModuleError
        message={error instanceof Error ? error.message : "Unable to load the TCC Time module."}
      />
    );
  }
}

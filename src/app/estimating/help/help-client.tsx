"use client";

import Link from "next/link";
import { HelpPanel } from "@/modules/hvac-estimator/shared/HelpPanel";

export function EstimatorHelpClient() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/estimating" className="text-sm font-semibold text-text-secondary hover:text-text-primary">
          Back to Estimating
        </Link>
      </div>
      <div className="min-h-[720px] overflow-hidden rounded-xl border border-border-default bg-surface-raised">
        <HelpPanel contextKey="quick-start" onClose={() => {}} />
      </div>
    </div>
  );
}

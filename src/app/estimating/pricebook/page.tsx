import Link from "next/link";
import PriceBookPage from "@/modules/hvac-estimator/components/pricebook/PriceBookPage";

export default function EstimatingPriceBookPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/estimating" className="text-sm font-semibold text-text-secondary hover:text-text-primary">
          Back to Estimating
        </Link>
      </div>
      <div className="overflow-hidden rounded-xl border border-border-default bg-surface-raised">
        <PriceBookPage />
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function QuotesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Quote Requests</h1>
        <p className="mt-1 text-text-secondary">
          Manage incoming quote requests, assign estimators, and track status through the bid lifecycle.
        </p>
      </div>
      <div className="rounded-xl border border-border-default bg-surface-raised p-8 text-center">
        <p className="mb-4 text-4xl">📋</p>
        <h2 className="font-heading text-lg font-semibold text-text-primary">Coming Soon</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
          The Quote Requests module is under active development. It will allow customers to submit
          requests, estimators to manage the queue, and admins to track win rates and turnaround time.
        </p>
      </div>
    </div>
  );
}

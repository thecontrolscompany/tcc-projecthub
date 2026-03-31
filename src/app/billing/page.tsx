export const dynamic = "force-dynamic";

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Billing</h1>
        <p className="mt-1 text-text-secondary">
          Monthly billing management, roll-forward, and financial reporting.
        </p>
      </div>
      <div className="rounded-xl border border-border-default bg-surface-raised p-8">
        <h2 className="font-heading text-lg font-semibold text-text-primary">Billing Management</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Billing management is currently available in the Admin portal.
        </p>
        <a
          href="/admin"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-hover"
        >
          Go to Admin Billing Portal →
        </a>
      </div>
    </div>
  );
}

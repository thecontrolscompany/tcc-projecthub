export const dynamic = "force-dynamic";

export default function EstimatingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Estimating</h1>
        <p className="mt-1 text-text-secondary">
          Create and manage HVAC controls estimates.
        </p>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-raised p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-semibold text-text-primary">
              Current Estimating Tool
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              The estimating tool is available at estimates.thecontrolscompany.com.
            </p>
          </div>
          <a
            href="https://estimates.thecontrolscompany.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-hover"
          >
            Open Estimating Tool →
          </a>
        </div>
        <p className="mt-4 text-xs text-text-tertiary">
          The estimating module will be integrated into this portal in a future phase.
          Until then, use the link above to access the tool at estimates.thecontrolscompany.com.
        </p>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-raised p-6">
        <h2 className="font-heading text-lg font-semibold text-text-primary">Integrated Estimating - Coming Soon</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Phase 5 will bring the full estimating module into this portal, including the
          445-assembly price book, HVAC system editors, and proposal generation.
        </p>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function EstimatingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Estimating</h1>
        <p className="mt-1 text-text-secondary">
          Start in OpportunityHub, price the work in HVAC Estimator, then attach the estimate back to the same opportunity.
        </p>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-raised p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-semibold text-text-primary">
              HVAC Estimator
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Open the estimator from here or from a specific OpportunityHub detail page.
            </p>
          </div>
          <a
            href="https://estimates.thecontrolscompany.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-hover"
          >
            Open Estimating Tool
          </a>
        </div>
        <p className="mt-4 text-xs text-text-tertiary">
          Opportunity detail pages pass the opportunity id, number, project name, and customer in the estimator URL.
          The next integration step is making HVAC Estimator consume those values and persist estimates against the same CRM opportunity.
        </p>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-raised p-6">
        <h2 className="font-heading text-lg font-semibold text-text-primary">Working Flow</h2>
        <ol className="mt-3 space-y-2 text-sm text-text-secondary">
          <li>1. Create the opportunity in OpportunityHub from Pipeline &gt; New Opportunity.</li>
          <li>2. Open the opportunity and choose Estimate in HVAC Estimator.</li>
          <li>3. Build the estimate using the same opportunity number and project/customer context.</li>
          <li>4. Use the estimate total to update the opportunity value and move the opportunity to Proposal Sent.</li>
          <li>5. When awarded, convert the opportunity/quote to ProjectHub and keep the estimate id as the project source estimate.</li>
        </ol>
        <p className="mt-4 text-xs text-text-tertiary">
          Integration notes are tracked in docs/hvac-estimator-projecthub-workflow.md.
        </p>
      </div>
    </div>
  );
}

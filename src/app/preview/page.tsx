export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-surface-base p-8 space-y-8">
      <h1 className="font-heading text-3xl font-bold text-text-primary">TCC ProjectHub - Preview</h1>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-text-secondary">Surfaces</h2>
        <div className="flex gap-4">
          <div className="h-16 w-32 rounded-lg bg-surface-base border border-border-default flex items-center justify-center text-text-tertiary text-sm">base</div>
          <div className="h-16 w-32 rounded-lg bg-surface-raised border border-border-default flex items-center justify-center text-text-secondary text-sm">raised</div>
          <div className="h-16 w-32 rounded-lg bg-surface-overlay border border-border-default flex items-center justify-center text-text-primary text-sm">overlay</div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-text-secondary">Brand</h2>
        <div className="flex gap-4">
          <button className="px-4 py-2 rounded-lg bg-brand-primary text-text-inverse font-medium">Primary Button</button>
          <button className="px-4 py-2 rounded-lg border border-brand-primary text-brand-primary font-medium">Outline Button</button>
          <span className="px-4 py-2 text-brand-primary font-medium">Brand Link</span>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-text-secondary">Status</h2>
        <div className="flex gap-4">
          <span className="px-3 py-1 rounded-full bg-status-success/10 text-status-success text-sm font-medium">Active</span>
          <span className="px-3 py-1 rounded-full bg-status-warning/10 text-status-warning text-sm font-medium">At Risk</span>
          <span className="px-3 py-1 rounded-full bg-status-danger/10 text-status-danger text-sm font-medium">Critical</span>
          <span className="px-3 py-1 rounded-full bg-status-info/10 text-status-info text-sm font-medium">In Review</span>
          <span className="px-3 py-1 rounded-full bg-surface-overlay text-text-tertiary text-sm font-medium">Complete</span>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-text-secondary">Typography</h2>
        <p className="font-heading text-2xl font-bold text-text-primary">Heading Bold - Raleway</p>
        <p className="font-heading text-xl font-semibold text-text-primary">Heading SemiBold</p>
        <p className="font-body text-base text-text-primary">Body regular - The Controls Company, LLC</p>
        <p className="font-body text-sm text-text-secondary">Secondary label text</p>
        <p className="font-body text-xs text-text-tertiary">Tertiary / caption text</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold text-text-secondary">Borders</h2>
        <div className="flex gap-4">
          <div className="h-16 w-40 rounded-lg border border-border-default flex items-center justify-center text-text-tertiary text-sm">default border</div>
          <div className="h-16 w-40 rounded-lg border border-border-strong flex items-center justify-center text-text-secondary text-sm">strong border</div>
        </div>
      </section>
    </div>
  );
}

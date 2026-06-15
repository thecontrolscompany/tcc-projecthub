export default function BillingLoading() {
  return (
    <main className="mx-auto max-w-screen-2xl px-6 py-6">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <div className="h-10 w-24 animate-pulse rounded-lg bg-surface-overlay" />
          <div className="h-10 w-28 animate-pulse rounded-lg bg-surface-overlay" />
          <div className="h-10 w-24 animate-pulse rounded-lg bg-surface-overlay" />
          <div className="h-10 w-32 animate-pulse rounded-lg bg-surface-overlay" />
          <div className="h-10 w-32 animate-pulse rounded-lg bg-surface-overlay" />
        </div>

        <section className="rounded-3xl border border-border-default bg-surface-raised p-6">
          <div className="h-4 w-36 animate-pulse rounded bg-surface-overlay" />
          <div className="mt-3 h-8 w-72 animate-pulse rounded bg-surface-overlay" />
          <div className="mt-2 h-4 w-[28rem] max-w-full animate-pulse rounded bg-surface-overlay" />
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl bg-surface-overlay" />
            ))}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr),minmax(360px,0.65fr)]">
          <section className="h-[28rem] animate-pulse rounded-2xl border border-border-default bg-surface-overlay" />
          <section className="space-y-4">
            <div className="h-48 animate-pulse rounded-2xl border border-border-default bg-surface-overlay" />
            <div className="h-40 animate-pulse rounded-2xl border border-border-default bg-surface-overlay" />
          </section>
        </div>
      </div>
    </main>
  );
}

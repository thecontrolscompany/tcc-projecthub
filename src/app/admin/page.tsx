import Link from "next/link";

const ADMIN_SECTIONS = [
  {
    title: "People & Access",
    description: "Manage the global directory, portal users, roles, and access.",
    links: [
      { href: "/people", label: "People Directory" },
      { href: "/admin/users", label: "Portal Users" },
      { href: "/admin/contacts", label: "Directory Admin" },
    ],
  },
  {
    title: "System Tools",
    description: "Behind-the-curtain maintenance for data, integrations, and project infrastructure.",
    links: [
      { href: "/admin/migrate-sharepoint", label: "SharePoint Migration" },
      { href: "/admin/analytics", label: "System Analytics" },
      { href: "/time/reconciliation", label: "QuickBooks Time Reconciliation" },
    ],
  },
  {
    title: "Billing Operations",
    description: "Billing work now lives in BillingHub.",
    links: [
      { href: "/billing", label: "Open BillingHub" },
      { href: "/admin/billing-import", label: "Historical Billing Import" },
    ],
  },
];

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-screen-xl px-6 py-8">
      <section className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-primary">Admin</p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-text-primary">System Administration</h1>
        <p className="mt-3 max-w-3xl text-sm text-text-secondary">
          User administration, access control, and system maintenance. Billing-heavy workflows have moved to BillingHub.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {ADMIN_SECTIONS.map((section) => (
          <div key={section.title} className="rounded-2xl border border-border-default bg-surface-raised p-5">
            <h2 className="font-heading text-lg font-semibold text-text-primary">{section.title}</h2>
            <p className="mt-2 min-h-10 text-sm text-text-secondary">{section.description}</p>
            <div className="mt-5 space-y-2">
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-xl border border-border-default bg-surface-base px-4 py-3 text-sm font-medium text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
                >
                  <span>{link.label}</span>
                  <span aria-hidden="true">-&gt;</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}

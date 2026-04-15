"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/quotes", label: "Pipeline" },
  { href: "/quotes/pursuits", label: "Pursuits" },
  { href: "/quotes/import", label: "Import" },
  { href: "/quotes/import/mass", label: "Mass Import" },
  { href: "/quotes/import/review", label: "Review Queue" },
  { href: "/estimating", label: "Estimating" },
];

export function OpportunityHubSubnav() {
  const pathname = usePathname();

  return (
    <nav className="rounded-2xl border border-border-default bg-surface-raised p-2">
      <div className="flex flex-wrap gap-2">
        {ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-brand-primary text-text-inverse"
                  : "bg-surface-overlay text-text-secondary hover:text-text-primary"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

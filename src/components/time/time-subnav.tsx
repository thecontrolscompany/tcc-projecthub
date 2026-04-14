"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const ITEMS = [
  { href: "/time/clock", label: "Clock" },
  { href: "/time/reconciliation?tab=overview", label: "Reconciliation" },
  { href: "/time/employees", label: "Employees" },
  { href: "/time/projects", label: "Projects" },
  { href: "/time/export", label: "Export" },
];

export function TimeSubnav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  return (
    <nav className="rounded-2xl border border-border-default bg-surface-raised p-2">
      <div className="flex flex-wrap gap-2">
        {ITEMS.map((item) => {
          const [itemPath, itemQuery] = item.href.split("?");
          const itemTab = itemQuery ? new URLSearchParams(itemQuery).get("tab") : null;
          const active =
            pathname === itemPath &&
            (itemPath !== "/time/reconciliation" || itemTab === tab || (!tab && itemTab === "employees"));

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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Dashboard",     href: "/crm/dashboard" },
  { label: "Accounts",      href: "/crm/accounts" },
  { label: "Contacts",      href: "/crm/contacts" },
  { label: "Pipeline",      href: "/crm/opportunities" },
  { label: "Activities",    href: "/crm/activities" },
  { label: "Tasks",         href: "/crm/tasks" },
];

const WRITE_TABS = [
  { label: "Targets",       href: "/crm/targets" },
];

export function CrmSubnav({ role }: { role: string }) {
  const pathname = usePathname();
  const isWriteRole = role === "admin" || role === "ops_manager";
  const tabs = isWriteRole ? [...TABS, ...WRITE_TABS] : TABS;

  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-border-default pb-0">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              "rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-b-2 border-brand-primary text-brand-primary"
                : "text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

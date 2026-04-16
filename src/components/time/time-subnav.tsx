"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ADMIN_ITEMS = [
  { href: "/time/clock", label: "Clock" },
  { href: "/time/employees", label: "Employees" },
  { href: "/time/projects", label: "Projects" },
  { href: "/time/export", label: "Reports" },
  { href: "/time/reconciliation?tab=overview", label: "Reconciliation" },
];

const OPS_MANAGER_ITEMS = [
  { href: "/time/clock", label: "Clock" },
  { href: "/time/reconciliation?tab=overview", label: "Approval" },
  { href: "/time/export", label: "Reports" },
];

export function TimeSubnav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const [items, setItems] = useState(ADMIN_ITEMS);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.role === "ops_manager") {
            setItems(OPS_MANAGER_ITEMS);
          }
        });
    });
  }, []);

  return (
    <nav className="rounded-2xl border border-border-default bg-surface-raised p-2">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
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

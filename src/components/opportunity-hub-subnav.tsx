"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ALL_ITEMS = [
  { href: "/quotes", label: "Pipeline" },
  { href: "/quotes/pursuits", label: "Pursuits" },
  { href: "/quotes/analytics", label: "Analytics" },
  { href: "/quotes/reconcile", label: "Reconcile" },
  { href: "/quotes/reconcile/umbrella", label: "Umbrella" },
  { href: "/quotes/import", label: "Import" },
  { href: "/quotes/import/mass", label: "Mass Import" },
  { href: "/quotes/import/review", label: "Review Queue" },
  { href: "/estimating", label: "Estimating" },
];

const OPS_MANAGER_ITEMS = [
  { href: "/quotes", label: "Pipeline" },
  { href: "/estimating", label: "Estimating" },
];

export function OpportunityHubSubnav() {
  const pathname = usePathname();
  const [items, setItems] = useState(ALL_ITEMS);

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

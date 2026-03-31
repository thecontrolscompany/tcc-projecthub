"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

const NAV_LINKS = [
  { label: "Dashboard", href: "/", roles: ["admin", "pm", "estimator", "billing", "accounting", "executive"] },
  { label: "Quotes", href: "/quotes", roles: ["admin", "estimator"] },
  { label: "Estimating", href: "/estimating", roles: ["admin", "estimator"] },
  { label: "Projects", href: "/projects", roles: ["admin", "pm", "estimator", "billing", "accounting", "executive"] },
  { label: "PM Updates", href: "/pm", roles: ["admin", "pm"] },
  { label: "Billing", href: "/billing", roles: ["admin", "billing", "accounting", "executive"] },
  { label: "Analytics", href: "/admin/analytics", roles: ["admin", "accounting", "executive"] },
  { label: "SharePoint Migration", href: "/admin/migrate-sharepoint", roles: ["admin"] },
  { label: "Users", href: "/admin/users", roles: ["admin"] },
  { label: "My Portal", href: "/customer", roles: ["customer"] },
];

export function SidebarNav({ role, userEmail }: { role: string; userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createBrowserClient();

  const links = NAV_LINKS.filter((link) => link.roles.includes(role));

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-surface-raised border-r border-border-default flex flex-col z-30">
      <div className="px-3 py-4 border-b border-border-default">
          <img
            src="/logo.png"
            alt="TCC ProjectHub"
            className="h-8 w-auto"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextElementSibling?.removeAttribute("hidden");
            }}
          />
        <span hidden className="text-text-primary font-heading font-semibold text-lg">
          TCC ProjectHub
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-surface-overlay text-text-primary font-medium"
                  : "text-text-secondary hover:bg-surface-overlay hover:text-text-primary",
              ].join(" ")}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-border-default">
        <p className="truncate text-sm text-text-secondary">{userEmail}</p>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}

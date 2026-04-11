export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";

export default async function TimeLayout({ children }: { children: React.ReactNode }) {
  const identity = await getShellIdentity("ops_manager");

  return (
    <AppShell role={identity.role} userEmail={identity.email} hasPortalAccess={identity.hasPortalAccess}>
      {children}
    </AppShell>
  );
}

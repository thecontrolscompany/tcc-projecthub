export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";

export default async function InstallerLayout({ children }: { children: React.ReactNode }) {
  const identity = await getShellIdentity("installer");

  return (
    <AppShell role={identity.role} userEmail={identity.email} hasPortalAccess={identity.hasPortalAccess}>
      {children}
    </AppShell>
  );
}

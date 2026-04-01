export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await getShellIdentity("admin");

  return (
    <AppShell role={identity.role} userEmail={identity.email}>
      {children}
    </AppShell>
  );
}

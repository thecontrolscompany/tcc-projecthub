export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";
import { AdminOpsView } from "@/components/admin-ops-view";

export default async function AdminOpsPage() {
  const identity = await getShellIdentity("admin");

  return (
    <AppShell role={identity.role} userEmail={identity.email}>
      <AdminOpsView />
    </AppShell>
  );
}

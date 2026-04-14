export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";
import { roleHome } from "@/lib/auth/role-routes";

export default async function TimeReconcileProjectsRoute() {
  const identity = await getShellIdentity("admin");

  if (identity.role !== "admin") {
    redirect(roleHome(identity.role));
  }

  redirect("/time/reconciliation?tab=projects");
}

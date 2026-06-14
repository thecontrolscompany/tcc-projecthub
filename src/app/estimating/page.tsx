import { EstimatingListClient } from "./estimating-list-client";
import { getShellIdentity } from "@/lib/auth/get-shell-identity";

export const dynamic = "force-dynamic";

export default async function EstimatingPage() {
  const identity = await getShellIdentity("customer");
  return <EstimatingListClient role={identity.role} />;
}

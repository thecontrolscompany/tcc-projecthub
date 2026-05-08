import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { EditAccountClient } from "./edit-account-client";

export const dynamic = "force-dynamic";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role ?? "pm";

  if (role !== "admin" && role !== "ops_manager") {
    redirect(`/crm/accounts/${id}`);
  }

  const [accountResult, profilesResult] = await Promise.all([
    supabase
      .from("crm_accounts")
      .select("*")
      .eq("id", id)
      .single(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["admin", "ops_manager", "pm"])
      .order("full_name", { ascending: true }),
  ]);

  if (accountResult.error || !accountResult.data) {
    notFound();
  }

  return (
    <EditAccountClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      account={accountResult.data as any}
      profiles={profilesResult.data ?? []}
      role={role}
    />
  );
}

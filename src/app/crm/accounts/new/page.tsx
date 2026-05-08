import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewAccountClient } from "./new-account-client";

export const dynamic = "force-dynamic";

type SearchParams = {
  returnTo?: string;
};

export default async function NewAccountPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role ?? "pm";

  if (role !== "admin" && role !== "ops_manager") {
    redirect("/crm/accounts");
  }

  const returnTo =
    typeof params.returnTo === "string" && params.returnTo.startsWith("/")
      ? params.returnTo
      : null;

  return <NewAccountClient role={role} returnTo={returnTo} />;
}

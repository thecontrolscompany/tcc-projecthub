import { redirect } from "next/navigation";

// Targets page — coming soon. Redirect to dashboard for now.
export default function TargetsPage() {
  redirect("/crm/dashboard");
}

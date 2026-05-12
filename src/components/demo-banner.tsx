import { getOrgContext } from "@/lib/tenant/server";

export async function DemoBanner() {
  const org = await getOrgContext();
  if (!org?.is_demo) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-brand-primary/10 border-b border-brand-primary/20 px-4 py-2 text-xs text-brand-primary">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
      <span>
        <strong>Live demo</strong> — Apex Mechanical · Fake data · Resets nightly
      </span>
    </div>
  );
}

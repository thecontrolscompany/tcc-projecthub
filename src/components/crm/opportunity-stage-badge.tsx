import type { CrmOpportunityStage } from "@/types/database";
import { CRM_STAGES } from "@/lib/crm/stages";

type OpportunityStageBadgeProps = {
  stage: CrmOpportunityStage;
  size?: "sm" | "md";
};

export function OpportunityStageBadge({ stage, size = "md" }: OpportunityStageBadgeProps) {
  const meta = CRM_STAGES[stage];
  return (
    <span
      className={[
        "inline-flex items-center rounded-full font-medium",
        meta.color,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
      ].join(" ")}
    >
      {meta.label}
    </span>
  );
}

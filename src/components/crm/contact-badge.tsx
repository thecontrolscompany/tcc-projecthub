import type { CrmContact } from "@/types/database";
import { CRM_ROLE_TYPE_LABELS, CRM_CONFIDENCE_BADGES, CRM_CONFIDENCE_LABELS } from "@/lib/crm/utils";

type ContactBadgeProps = {
  contact: Pick<CrmContact, "id" | "display_name" | "role_type" | "confidence_level">;
  showRole?: boolean;
  size?: "sm" | "md";
};

const CONFIDENCE_RING: Record<string, string> = {
  confirmed:           "border-l-2 border-status-success",
  partially_confirmed: "border-l-2 border-status-warning",
  needs_verification:  "border-l-2 border-border-default",
};

export function ContactBadge({ contact, showRole = true, size = "md" }: ContactBadgeProps) {
  const badgeClass = CRM_CONFIDENCE_BADGES[contact.confidence_level];

  return (
    <span
      className={[
        "inline-flex items-center rounded-lg pl-2 pr-3 gap-2 border border-border-default bg-surface-overlay",
        CONFIDENCE_RING[contact.confidence_level],
        size === "sm" ? "py-0.5" : "py-1",
      ].join(" ")}
      title={`${CRM_CONFIDENCE_LABELS[contact.confidence_level]} — ${CRM_ROLE_TYPE_LABELS[contact.role_type]}`}
    >
      <span className={`text-${size === "sm" ? "xs" : "sm"} font-medium text-text-primary`}>
        {contact.display_name}
      </span>
      {showRole && (
        <span className={`rounded-full px-1.5 py-0.5 text-xs ${badgeClass}`}>
          {CRM_ROLE_TYPE_LABELS[contact.role_type]}
        </span>
      )}
    </span>
  );
}

import type { CrmAccount } from "@/types/database";

type HandoffSummaryProps = {
  account: Pick<
    CrmAccount,
    "who_buys" | "who_issues_po" | "who_influences_spec" | "who_owns_estimating_relationship" | "handoff_notes"
  >;
};

function FieldRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">{label}</span>
      <span className={value ? "text-sm text-text-primary" : "text-sm text-text-tertiary italic"}>
        {value ?? "Not set"}
      </span>
    </div>
  );
}

export function HandoffSummary({ account }: HandoffSummaryProps) {
  return (
    <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-5">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">Account Intel (Handoff Card)</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldRow label="Who actually buys" value={account.who_buys} />
        <FieldRow label="Who issues the PO" value={account.who_issues_po} />
        <FieldRow label="Who influences spec / selection" value={account.who_influences_spec} />
        <FieldRow label="Who owns estimating relationship" value={account.who_owns_estimating_relationship} />
      </div>
      {account.handoff_notes && (
        <div className="mt-4 border-t border-brand-primary/10 pt-4">
          <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Handoff Notes</span>
          <p className="mt-1 text-sm text-text-secondary whitespace-pre-wrap">{account.handoff_notes}</p>
        </div>
      )}
    </div>
  );
}

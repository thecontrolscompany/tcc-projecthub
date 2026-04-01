export function ViewReportLink({ updateId }: { updateId: string }) {
  return (
    <a
      href={`/reports/weekly-update/${updateId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
    >
      View Report
      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M2 10L10 2M6 2h4v4" />
      </svg>
    </a>
  );
}

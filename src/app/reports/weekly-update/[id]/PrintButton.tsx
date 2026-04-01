"use client";

export function PrintButton() {
  return (
    <div className="no-print print-actions">
      <button type="button" onClick={() => window.print()}>
        Print / Save as PDF
      </button>
    </div>
  );
}

"use client";

import { useEffect } from "react";

export function PrintButton({ documentTitle }: { documentTitle?: string }) {
  useEffect(() => {
    if (!documentTitle) {
      return;
    }

    const previousTitle = document.title;
    document.title = documentTitle;

    return () => {
      document.title = previousTitle;
    };
  }, [documentTitle]);

  return (
    <div className="no-print print-actions">
      <button type="button" onClick={() => window.print()}>
        Print / Save as PDF
      </button>
    </div>
  );
}

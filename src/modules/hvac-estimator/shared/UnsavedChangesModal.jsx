import { createPortal } from "react-dom";

export function UnsavedChangesModal({ open, onStay, onDiscard }) {
  if (!open) return null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-border-default bg-surface-raised shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <h3 className="text-base font-semibold text-text-primary">Unsaved changes</h3>
        </div>
        <div className="px-5 py-5 text-sm text-text-secondary">
          You have unsaved changes to this line item. Going back now will discard them.
        </div>
        <div className="flex justify-end gap-3 border-t border-border-default px-5 py-4">
          <button
            type="button"
            onClick={onStay}
            className="rounded-lg border border-border-default px-4 py-2 text-sm font-semibold text-text-secondary transition hover:bg-surface-overlay hover:text-text-primary"
          >
            Stay and save
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
          >
            Discard and go back
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

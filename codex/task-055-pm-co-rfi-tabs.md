# Task 055 — PM Portal: Change Orders Tab + RFI Stub Tab

## Context

Task 054 restructured the PM project detail into 4 tabs: Overview, Weekly Update,
POC & Progress, BOM. Change orders currently live as a section inside the Overview
tab (lines ~732–759 of `src/app/pm/page.tsx`). RFIs have no UI at all yet
(roadmap doc exists at `codex/roadmap-rfi-submittal-log.md`).

This task adds **Change Orders** and **RFIs** as first-class tabs so they have room
to grow into full PM workflows without another restructure.

---

## New tab structure (6 tabs total)

| Tab key | Label | Position |
|---------|-------|----------|
| `overview` | Overview | 1 |
| `update` | Weekly Update | 2 |
| `poc` | POC & Progress | 3 |
| `change-orders` | Change Orders | 4 |
| `rfis` | RFIs | 5 |
| `bom` | BOM | 6 |

Update the `ProjectTab` type:

```ts
type ProjectTab = "overview" | "update" | "poc" | "change-orders" | "rfis" | "bom";
```

No other state changes. `activeTab` default stays `"overview"`.

---

## Changes required

### 1. Tab bar — add two new buttons

In the tab bar (`<div className="flex flex-wrap gap-2 ...">`, the block containing
the 4 `PmTabButton` elements), add after the POC button and before BOM:

```tsx
<PmTabButton active={activeTab === "change-orders"} onClick={() => setActiveTab("change-orders")}>
  Change Orders
  {activeChangeOrders.length > 0 && (
    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-surface-overlay px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
      {activeChangeOrders.length}
    </span>
  )}
</PmTabButton>
<PmTabButton active={activeTab === "rfis"} onClick={() => setActiveTab("rfis")}>
  RFIs
</PmTabButton>
```

The count badge on Change Orders gives PMs a quick visual without navigating in.

---

### 2. Change Orders tab content

Add a new `{activeTab === "change-orders" && (...)}` block after the BOM block. Move
the existing change orders rendering from the Overview tab into this block.

**New tab content:**

```tsx
{activeTab === "change-orders" && (
  <div className="space-y-4">
    <div>
      <h3 className="text-base font-semibold text-text-primary">Change Orders</h3>
      <p className="mt-1 text-sm text-text-tertiary">
        Change orders on this project. Contact admin to add or update change orders.
      </p>
    </div>

    {coError ? (
      <p className="text-sm text-status-danger">{coError}</p>
    ) : changeOrders.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-border-default px-6 py-10 text-center">
        <p className="text-sm font-medium text-text-secondary">No change orders on file.</p>
        <p className="mt-1 text-xs text-text-tertiary">Change orders will appear here once added by admin.</p>
      </div>
    ) : (
      <div className="space-y-3">
        {changeOrders.map((co) => (
          <div
            key={co.id}
            className={[
              "flex items-center justify-between rounded-xl border px-4 py-3 text-sm",
              co.status === "void"
                ? "border-border-default bg-surface-base opacity-50"
                : "border-border-default bg-surface-raised",
            ].join(" ")}
          >
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-text-primary">{co.co_number}</span>
                <span className="text-text-secondary">—</span>
                <span className="text-text-primary">{co.title}</span>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    co.status === "approved"
                      ? "bg-status-success/10 text-status-success"
                      : co.status === "rejected"
                        ? "bg-status-danger/10 text-status-danger"
                        : co.status === "void"
                          ? "bg-surface-overlay text-text-tertiary"
                          : "bg-status-warning/10 text-status-warning",
                  ].join(" ")}
                >
                  {co.status}
                </span>
              </div>
              {co.reference_doc && (
                <p className="text-xs text-text-tertiary">Ref: {co.reference_doc}</p>
              )}
            </div>
            <span
              className={[
                "shrink-0 font-semibold",
                co.status === "void"
                  ? "text-text-tertiary"
                  : co.amount >= 0
                    ? "text-status-success"
                    : "text-status-danger",
              ].join(" ")}
            >
              {co.amount >= 0 ? "+" : ""}
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(co.amount)}
            </span>
          </div>
        ))}
      </div>
    )}

    {changeOrders.filter((co) => co.status === "approved").length > 0 && (
      <div className="rounded-xl border border-status-success/20 bg-status-success/5 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Total Approved CO Value</p>
        <p className="mt-1 text-base font-bold text-status-success">
          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
            changeOrders
              .filter((co) => co.status === "approved")
              .reduce((sum, co) => sum + co.amount, 0)
          )}
        </p>
      </div>
    )}
  </div>
)}
```

Note: show **all** change orders on this tab including voided ones (with dimmed/opacity
styling), so PMs have full visibility. The `activeChangeOrders` filter (no void) is
only used for the count badge in the tab label.

---

### 3. RFIs tab content — stub

Add a `{activeTab === "rfis" && (...)}` block after the Change Orders block:

```tsx
{activeTab === "rfis" && (
  <div className="space-y-4">
    <div>
      <h3 className="text-base font-semibold text-text-primary">RFI Log</h3>
      <p className="mt-1 text-sm text-text-tertiary">
        Request for Information tracking for this project.
      </p>
    </div>
    <div className="rounded-2xl border border-dashed border-border-default px-6 py-12 text-center">
      <p className="text-sm font-semibold text-text-secondary">Coming Soon</p>
      <p className="mt-2 max-w-sm mx-auto text-xs text-text-tertiary">
        RFI logging, GC/design team question tracking, and submittal linking
        will be available here in a future update.
      </p>
    </div>
  </div>
)}
```

---

### 4. Remove change orders section from Overview tab

In the Overview tab content block (`{activeTab === "overview" && ...}`), remove the
entire "Change Orders" section — the `<div className="space-y-3">` block that starts
with the "Change Orders" heading and contains the `coError` / `activeChangeOrders.map`
rendering (currently around lines 732–759).

Replace it with a compact summary widget that links to the Change Orders tab:

```tsx
{(activeChangeOrders.length > 0 || coError) && (
  <div className="flex items-center justify-between rounded-xl border border-border-default bg-surface-raised px-4 py-3">
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Change Orders</p>
      {coError ? (
        <p className="mt-0.5 text-sm text-status-danger">Failed to load</p>
      ) : (
        <p className="mt-0.5 text-sm font-medium text-text-primary">
          {activeChangeOrders.length} active change order{activeChangeOrders.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
    <button
      type="button"
      onClick={() => setActiveTab("change-orders")}
      className="rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-base hover:text-text-primary"
    >
      View all →
    </button>
  </div>
)}
```

If `activeChangeOrders.length === 0` and no error, show nothing on Overview — no
clutter for projects without COs.

---

## Files to change

| File | What changes |
|------|-------------|
| `src/app/pm/page.tsx` | Only file — tab type, tab bar, CO tab, RFI stub, Overview CO summary |

No new API routes. No database changes. No new dependencies.

---

## Acceptance criteria

- [ ] Tab bar shows 6 tabs in order: Overview, Weekly Update, POC & Progress,
      Change Orders, RFIs, BOM
- [ ] Change Orders tab badge shows count of non-voided COs when > 0
- [ ] Change Orders tab shows all COs (including voided, dimmed), approved CO total
      summary at the bottom when applicable, proper empty state when none
- [ ] RFIs tab shows "Coming Soon" stub
- [ ] Overview tab no longer has the full CO list — replaced by compact summary widget
      that only shows when there are active COs, with "View all →" linking to CO tab
- [ ] Overview tab has no visible CO section when a project has zero change orders
- [ ] `npm run build` passes clean

## Commit and push

Commit message: `PM portal: add Change Orders and RFI stub tabs`
Push to main.

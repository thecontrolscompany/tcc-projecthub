# Task 070 — Standalone BOM Report Page

## Goal

Create a printable, landscape-oriented Bill of Materials report at
`/reports/bom/[projectId]` — same branded look as the weekly report and change
order report — and add a "Generate BOM Report" button to both the PM and
customer portals that opens it in a new tab.

---

## 1. New report page

### File to create
`src/app/reports/bom/[projectId]/page.tsx`

### Auth pattern
Copy the exact `canAccess` function from
`src/app/reports/change-order/[id]/page.tsx`. It handles admin, ops_manager, pm,
lead, and customer roles already. Redirect to `/login` if not authenticated; call
`notFound()` if the project doesn't exist; redirect to `/login` if access is
denied.

### Data to fetch (use service-role client)

```ts
// Project info
const { data: projectRaw } = await admin
  .from("projects")
  .select("id, name, job_number, site_address, general_contractor, customer:customers(name)")
  .eq("id", projectId)
  .maybeSingle();

// BOM items
const { data: rawItems } = await admin
  .from("bom_items")
  .select("id, section, designation, code_number, description, qty_required, sort_order")
  .eq("project_id", projectId)
  .order("sort_order")
  .order("section");

// Receipts
const itemIds = (rawItems ?? []).map((i) => i.id);
const { data: rawReceipts } = itemIds.length
  ? await admin
      .from("material_receipts")
      .select("bom_item_id, qty_received")
      .in("bom_item_id", itemIds)
  : { data: [] };
```

Compute `qty_received` per item and derive status:
- `qty_received === 0` → "Missing"
- `0 < qty_received < qty_required` → "Partial"
- `qty_received === qty_required` → "Received"
- `qty_received > qty_required` → "Surplus"

Build summary counts: total items, received, partial, missing.

### Page structure

The page is a plain HTML document (no Tailwind layout wrappers — same approach
as the other report pages). Use `export const dynamic = "force-dynamic"`.

#### CSS — inline `<style>` block

The entire document is landscape, so use:

```css
@page {
  size: letter landscape;
  margin: 0.6in 0.75in 0.8in 0.75in;

  @top-left {
    content: "The Controls Company, LLC";
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8pt;
    color: #4b5563;
    vertical-align: bottom;
    padding-bottom: 6pt;
    border-bottom: 1pt solid #017a6f;
  }

  @top-right {
    content: "{project.name} — Bill of Materials";
    /* interpolate project.name in the template literal */
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8pt;
    color: #4b5563;
    vertical-align: bottom;
    padding-bottom: 6pt;
    border-bottom: 1pt solid #017a6f;
  }

  @bottom-left {
    content: "thecontrolscompany.com  |  Service Disabled Veteran Owned Small Business";
    font-family: Arial, Helvetica, sans-serif;
    font-size: 7.5pt;
    color: #9ca3af;
    vertical-align: top;
    padding-top: 6pt;
  }

  @bottom-right {
    content: "Page " counter(page) " of " counter(pages);
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8pt;
    color: #4b5563;
    vertical-align: top;
    padding-top: 6pt;
  }
}

body {
  margin: 0;
  background: #f4f7f6;
  color: #111827;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
  line-height: 1.4;
}

/* Screen only: cap width so it's readable on screen in landscape */
.page {
  max-width: 10in;
  margin: 0 auto;
  padding: 24px;
}

.print-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-bottom: 18px;
}

.print-actions button {
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #111827;
  border-radius: 999px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.print-actions button:hover {
  border-color: #017a6f;
  color: #017a6f;
}

.report {
  background: #ffffff;
  padding: 28px;
  border: 1px solid #d1d5db;
}

.brand-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.logo { width: 120px; height: 120px; object-fit: contain; }
.badge { width: 90px; height: 90px; object-fit: contain; }

.brand-copy { flex: 1; text-align: center; }
.brand-copy h1 { margin: 0 0 4px; font-size: 18px; color: #017a6f; letter-spacing: 0.04em; }
.brand-copy p { margin: 0; font-size: 12px; color: #4b5563; }

.section-divider {
  margin: 18px 0 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #017a6f;
}
.section-divider h2 { margin: 0; font-size: 15px; color: #017a6f; letter-spacing: 0.08em; }

.meta-grid {
  display: grid;
  grid-template-columns: 160px 1fr 160px 1fr;
  gap: 6px 14px;
  margin-top: 14px;
  font-size: 13px;
}
.meta-label { font-weight: 700; color: #374151; }

.summary-bar {
  display: flex;
  gap: 24px;
  margin: 14px 0;
  padding: 10px 16px;
  background: #eef8f6;
  border-radius: 6px;
  font-size: 13px;
}
.summary-stat { display: flex; flex-direction: column; }
.summary-stat .label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #4b5563; }
.summary-stat .value { font-size: 18px; font-weight: 700; color: #017a6f; }
.summary-stat.danger .value { color: #dc2626; }
.summary-stat.warn .value { color: #d97706; }

table { width: 100%; border-collapse: collapse; margin-top: 12px; }
th, td { border: 1px solid #d1d5db; padding: 7px 9px; vertical-align: top; font-size: 12px; }
thead th {
  background: #eef8f6;
  color: #0f172a;
  text-align: left;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.number-cell { text-align: center; white-space: nowrap; }
.status-received { color: #15803d; font-weight: 600; }
.status-partial { color: #d97706; font-weight: 600; }
.status-missing { color: #dc2626; font-weight: 600; }
.status-surplus { color: #92400e; font-weight: 600; }

.footer {
  margin-top: 24px;
  padding-top: 10px;
  border-top: 2px solid #017a6f;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #4b5563;
}

@media print {
  body { background: #ffffff; }
  .no-print { display: none !important; }
  .page { max-width: none; margin: 0; padding: 0; }
  .report { border: 0; padding: 0; }
  .footer { display: none; }
}
```

#### JSX structure

```tsx
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{project.name} — Bill of Materials</title>
    <style>{/* css string above */}</style>
  </head>
  <body>
    <main className="page">
      <PrintButton />   {/* reuse from src/app/reports/weekly-update/[id]/PrintButton.tsx */}

      <article className="report">
        {/* Brand header — identical to weekly report */}
        <div className="brand-row">
          <img src="/logo.png" alt="The Controls Company" className="logo" />
          <div className="brand-copy">
            <h1>THE CONTROLS COMPANY, LLC</h1>
            <p>Service Disabled Veteran Owned Small Business</p>
          </div>
          <img src="/sdvosb.jpg" alt="SDVOSB badge" className="badge" />
        </div>

        <div className="section-divider">
          <h2>BILL OF MATERIALS</h2>
        </div>

        {/* Meta grid — 2 columns of label/value pairs */}
        <div className="meta-grid">
          <div className="meta-label">Project Name:</div>
          <div>{project.name}</div>
          <div className="meta-label">Job Number:</div>
          <div>{project.job_number || "Not assigned"}</div>

          <div className="meta-label">Customer:</div>
          <div>{customer?.name || "Not provided"}</div>
          <div className="meta-label">Generated:</div>
          <div>{format(new Date(), "MMMM d, yyyy")}</div>

          <div className="meta-label">Site Address:</div>
          <div>{project.site_address || "Not provided"}</div>
          <div className="meta-label">General Contractor:</div>
          <div>{project.general_contractor || "Not provided"}</div>
        </div>

        {/* Summary bar */}
        <div className="summary-bar">
          <div className="summary-stat">
            <span className="label">Total Items</span>
            <span className="value">{totalItems}</span>
          </div>
          <div className="summary-stat">
            <span className="label">Received</span>
            <span className="value">{receivedCount}</span>
          </div>
          <div className="summary-stat warn">
            <span className="label">Partial</span>
            <span className="value">{partialCount}</span>
          </div>
          <div className="summary-stat danger">
            <span className="label">Missing</span>
            <span className="value">{missingCount}</span>
          </div>
        </div>

        {/* BOM table — grouped by section */}
        {items.length === 0 ? (
          <p style={{ color: "#6b7280", marginTop: 24 }}>No BOM items on file for this project.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Section</th>
                <th>Designation</th>
                <th>Code Number</th>
                <th>Description</th>
                <th className="number-cell">Qty Req&apos;d</th>
                <th className="number-cell">Qty Rec&apos;d</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.flatMap((item, i) => {
                const prevSection = i > 0 ? items[i - 1].section : "";
                const rows = [];
                if (item.section !== prevSection) {
                  rows.push(
                    <tr key={`section-${i}`} style={{ background: "#e8f0fa" }}>
                      <td colSpan={7} style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e3a5f" }}>
                        {item.section}
                      </td>
                    </tr>
                  );
                }
                rows.push(
                  <tr key={item.id}>
                    <td>{item.section}</td>
                    <td>{item.designation || "-"}</td>
                    <td>{item.code_number || "-"}</td>
                    <td>{item.description}</td>
                    <td className="number-cell">{item.qty_required}</td>
                    <td className="number-cell">{item.qty_received}</td>
                    <td className={
                      item.status === "received" ? "status-received"
                      : item.status === "partial" ? "status-partial"
                      : item.status === "surplus" ? "status-surplus"
                      : "status-missing"
                    }>
                      {item.status === "received" ? "Received"
                       : item.status === "partial" ? "Partial"
                       : item.status === "surplus" ? "Surplus"
                       : "Missing"}
                    </td>
                  </tr>
                );
                return rows;
              })}
            </tbody>
          </table>
        )}

        <footer className="footer">
          <div>The Controls Company, LLC | thecontrolscompany.com</div>
          <div>Service Disabled Veteran Owned Small Business</div>
          <div>Generated: {format(new Date(), "MMMM d, yyyy")}</div>
        </footer>
      </article>
    </main>
  </body>
</html>
```

> **Note on the section column:** The table has a "Section" column so it reads
> clearly in the flat row layout (the section header rows are a bonus grouping,
> not the only indicator). Remove the section column if you prefer the
> section-header-row-only style — either works.

---

## 2. "Generate BOM Report" button — PM portal

**File:** `src/app/pm/page.tsx`

Find the BOM tab content block (`activeTab === "bom"`). It renders `<BomTab>`.
Above the `<BomTab>` component (before the existing content), add a button row:

```tsx
<div className="flex items-center justify-between">
  <div>
    <h3 className="text-base font-semibold text-text-primary">Bill of Materials</h3>
    <p className="mt-0.5 text-sm text-text-tertiary">Material schedule and receipt tracking for this project.</p>
  </div>
  <a
    href={`/reports/bom/${project.id}`}
    target="_blank"
    rel="noopener noreferrer"
    className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-inverse transition hover:opacity-90"
  >
    Generate BOM Report
  </a>
</div>
```

---

## 3. "Generate BOM Report" button — Customer portal

**File:** `src/app/customer/page.tsx`

Find the BOM section (`view === "bom"`). It renders `<BomTab>` inside a white
card. In the card header (the `px-6 pt-5 pb-2` div), add the button:

```tsx
<div className="flex items-start justify-between gap-4 px-6 pt-5 pb-2">
  <div>
    <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: HEADER_BG }}>
      Bill of Materials
    </p>
    <p className="mt-0.5 text-sm text-slate-500">
      Material schedule and receipt status for this project.
    </p>
  </div>
  <a
    href={`/reports/bom/${project.id}`}
    target="_blank"
    rel="noopener noreferrer"
    className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition"
    style={{ backgroundColor: HEADER_BG, color: "#ffffff" }}
  >
    Generate BOM Report
  </a>
</div>
```

Replace the existing `<div className="px-6 pt-5 pb-2">` header block with the
above (same content, just adds the button and adjusts to flex).

---

## Acceptance criteria

- `/reports/bom/[projectId]` renders in landscape layout on screen (max-width 10in)
  and prints landscape via `@page { size: letter landscape }`.
- Auth: admin/ops_manager always; PM/lead if assigned; customer if portal_access.
  Unauthenticated → redirect to `/login`. No access → redirect to `/login`.
  Project not found → 404.
- Summary bar shows correct counts for total, received, partial, missing.
- BOM table is grouped by section with section-header rows.
- Status cells are color-coded (green received, amber partial, red missing, brown surplus).
- PM BOM tab has "Generate BOM Report" button opening the report in a new tab.
- Customer Materials tab has "Generate BOM Report" button opening the report in a new tab.
- PrintButton renders "Print / Save as PDF" and is hidden at print time.
- No new migrations needed. No changes to existing API routes.

## When done

Run `npm run build` to confirm no type errors, then commit all new and modified
files and push to `main`.

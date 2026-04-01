"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { calcToBill } from "@/lib/billing/calculations";
import type { BillingRow } from "@/types/database";

interface BillingTableProps {
  rows: BillingRow[];
  onRowsChange: (rows: BillingRow[]) => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function BillingTable({ rows, onRowsChange }: BillingTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const supabase = createClient();

  const updateRow = useCallback(
    async (
      billingPeriodId: string,
      field: "pct_complete" | "prior_pct" | "prev_billed" | "actual_billed" | "estimated_income_snapshot" | "notes",
      value: number | string | null
    ) => {
      const rowToUpdate = rows.find((row) => row.billing_period_id === billingPeriodId);
      const updated = rows.map((r) => {
        if (r.billing_period_id !== billingPeriodId) return r;
        const next = { ...r };

        if (field === "estimated_income_snapshot") {
          next.estimated_income = Number(value ?? 0);
        } else if (field === "notes") {
          next.notes = typeof value === "string" ? value : null;
        } else {
          (next[field] as number | null) = typeof value === "number" ? value : null;
        }

        next.to_bill = calcToBill(next.estimated_income, next.pct_complete, next.prev_billed);
        next.backlog = Math.max(next.estimated_income - next.prev_billed, 0);
        next.prev_billed_pct = next.estimated_income > 0 ? next.prev_billed / next.estimated_income : 0;
        return next;
      });

      setSaveError(null);

      const { error } = await supabase
        .from("billing_periods")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", billingPeriodId);

      if (error) {
        setSaveError(
          `Failed to save ${rowToUpdate?.project_name ?? "billing row"} - please try again.`
        );
        return;
      }

      onRowsChange(updated);
    },
    [rows, onRowsChange, supabase]
  );

  const columns: ColumnDef<BillingRow>[] = [
    {
      accessorKey: "customer_name",
      header: "Customer",
      cell: ({ getValue }) => (
        <span className="font-medium text-text-primary">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "project_name",
      header: "Project",
      cell: ({ row, getValue }) => (
        <div className="space-y-1">
          <span className="text-text-secondary">{getValue<string>()}</span>
          {row.original.has_recent_update && (
            <span className="inline-flex w-fit rounded-full bg-status-success/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-status-success">
              Recent Update
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "pm_name",
      header: "PM",
      cell: ({ getValue }) => (
        <span className="text-text-secondary text-xs">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: "estimated_income",
      header: () => <span className="block text-right">Est. Income</span>,
      cell: ({ row }) => (
        <EditableCurrency
          value={row.original.estimated_income}
          onChange={(v) => updateRow(row.original.billing_period_id, "estimated_income_snapshot", v)}
          className="text-text-secondary"
        />
      ),
    },
    {
      accessorKey: "backlog",
      header: () => <span className="block text-right">Backlog</span>,
      cell: ({ getValue }) => (
        <span className="block text-right text-text-secondary">{fmt(getValue<number>())}</span>
      ),
    },
    {
      accessorKey: "prior_pct",
      header: () => <span className="block text-right">Prior %</span>,
      cell: ({ row }) => (
        <EditablePct
          value={row.original.prior_pct}
          onChange={(v) => updateRow(row.original.billing_period_id, "prior_pct", v)}
          warn={false}
          className="text-text-secondary"
        />
      ),
    },
    {
      accessorKey: "pct_complete",
      header: () => <span className="block text-right">% Complete</span>,
      cell: ({ row }) => (
        <div className="space-y-1">
          <EditablePct
            value={row.original.pct_complete}
            onChange={(v) => updateRow(row.original.billing_period_id, "pct_complete", v)}
            warn={row.original.pct_complete < row.original.prev_billed_pct}
          />
          <p className="text-right text-[11px] text-text-tertiary" title={row.original.poc_driven ? "Value is being driven by POC line items." : "Value was entered manually."}>
            {row.original.poc_driven ? "POC calculated" : "Manual"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "prev_billed",
      header: () => <span className="block text-right">Prev. Billed</span>,
      cell: ({ row }) => (
        <EditableCurrency
          value={row.original.prev_billed}
          onChange={(v) => updateRow(row.original.billing_period_id, "prev_billed", v)}
          className="text-text-secondary"
        />
      ),
    },
    {
      accessorKey: "prev_billed_pct",
      header: () => <span className="block text-right">Prev. %</span>,
      cell: ({ getValue }) => (
        <span className="block text-right text-text-secondary">{pct(getValue<number>())}</span>
      ),
    },
    {
      accessorKey: "to_bill",
      header: () => <span className="block text-right font-semibold text-brand-primary">To Bill</span>,
      cell: ({ getValue }) => (
        <span className="block text-right font-semibold text-brand-primary">{fmt(getValue<number>())}</span>
      ),
    },
    {
      accessorKey: "actual_billed",
      header: () => <span className="block text-right">Actual Billed</span>,
      cell: ({ row }) => (
        <EditableCurrency
          value={row.original.actual_billed}
          onChange={(v) => updateRow(row.original.billing_period_id, "actual_billed", v)}
        />
      ),
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => (
        <EditableText
          value={row.original.notes}
          onChange={(v) => updateRow(row.original.billing_period_id, "notes", v)}
        />
      ),
    },
  ];

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const totals = rows.reduce(
    (acc, r) => ({
      estimated_income: acc.estimated_income + r.estimated_income,
      backlog: acc.backlog + r.backlog,
      prev_billed: acc.prev_billed + r.prev_billed,
      to_bill: acc.to_bill + r.to_bill,
      actual_billed: acc.actual_billed + (r.actual_billed ?? 0),
    }),
    { estimated_income: 0, backlog: 0, prev_billed: 0, to_bill: 0, actual_billed: 0 }
  );

  return (
    <div className="space-y-3">
      {saveError && (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-2.5 text-sm text-status-danger">
          {saveError}
        </div>
      )}

      <input
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder="Filter projects, customers, PMs..."
        className="w-full max-w-sm rounded-xl border border-border-default bg-surface-raised px-4 py-2 text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary/50 focus:outline-none"
      />

      <div className="overflow-x-auto rounded-2xl border border-border-default">
        <table className="w-full min-w-[1260px] text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border-default bg-surface-raised/80">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer select-none px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary hover:text-text-primary"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc" && " ↑"}
                    {header.column.getIsSorted() === "desc" && " ↓"}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isComplete = row.original.pct_complete >= 1;
              const isBehind = row.original.pct_complete < row.original.prev_billed_pct;
              return (
                <tr
                  key={row.id}
                  className={[
                    "border-b border-border-default transition-colors",
                    isComplete
                      ? "bg-surface-raised/90 opacity-50"
                      : isBehind
                        ? "bg-status-danger/5 hover:bg-status-danger/10"
                        : "hover:bg-surface-raised",
                  ].join(" ")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="border-t border-border-default bg-surface-raised/80 font-semibold">
              <td colSpan={3} className="px-3 py-2.5 text-xs text-text-secondary uppercase tracking-wide">
                Totals
              </td>
              <td className="px-3 py-2.5 text-right text-text-primary">{fmt(totals.estimated_income)}</td>
              <td className="px-3 py-2.5 text-right text-text-secondary">{fmt(totals.backlog)}</td>
              <td colSpan={2} />
              <td className="px-3 py-2.5 text-right text-text-secondary">{fmt(totals.prev_billed)}</td>
              <td />
              <td className="px-3 py-2.5 text-right text-brand-primary">{fmt(totals.to_bill)}</td>
              <td className="px-3 py-2.5 text-right text-status-success">{fmt(totals.actual_billed)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-text-tertiary">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-status-danger/60" />
          % Complete below previously billed %
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-border-strong" />
          100% complete (archived)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-primary" />
          Editable cells highlighted
        </span>
      </div>
    </div>
  );
}

function EditablePct({
  value,
  onChange,
  warn,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  warn: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed)) {
      onChange(Math.min(Math.max(parsed / 100, 0), 1));
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={(value * 100).toFixed(1)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="w-20 rounded-lg border border-status-warning/50 bg-status-warning/10 px-2 py-1 text-right text-sm text-status-warning focus:outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft((value * 100).toFixed(1));
        setEditing(true);
      }}
      className={[
        "block w-full rounded-lg px-2 py-1 text-right text-sm transition hover:bg-status-warning/10",
        warn ? "text-status-danger" : className ?? "text-text-primary",
      ].join(" ")}
      title="Click to edit"
    >
      {(value * 100).toFixed(1)}%
    </button>
  );
}

function EditableCurrency({
  value,
  onChange,
  className,
}: {
  value: number | null;
  onChange: (v: number) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const parsed = parseFloat(draft.replace(/[^0-9.-]/g, ""));
    if (!isNaN(parsed)) onChange(parsed);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={value ?? ""}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="w-28 rounded-lg border border-status-warning/50 bg-status-warning/10 px-2 py-1 text-right text-sm text-status-warning focus:outline-none"
        placeholder="0"
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(String(value ?? ""));
        setEditing(true);
      }}
      className={`block w-full rounded-lg px-2 py-1 text-right text-sm transition hover:bg-status-warning/10 ${className ?? "text-status-success"}`}
      title="Click to edit"
    >
      {value !== null ? fmt(value) : <span className="text-text-tertiary">-</span>}
    </button>
  );
}

function EditableText({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    onChange(draft.trim() || null);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={value ?? ""}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="w-full min-w-[180px] rounded-lg border border-status-warning/50 bg-status-warning/10 px-2 py-1 text-left text-sm text-status-warning focus:outline-none"
        placeholder="Add note"
      />
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(value ?? "");
        setEditing(true);
      }}
      className="block w-full rounded-lg px-2 py-1 text-left text-sm text-text-secondary transition hover:bg-status-warning/10"
      title="Click to edit"
    >
      {value?.trim() ? value : <span className="text-text-tertiary">-</span>}
    </button>
  );
}

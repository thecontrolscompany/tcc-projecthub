"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatRangeLabel,
  getPresetRange,
  listPayPeriodOptions,
  type TimeRange,
  type TimeRangePreset,
} from "@/lib/time/date-range";

const PRESET_OPTIONS: Array<{ id: TimeRangePreset; label: string }> = [
  { id: "current_week", label: "Current week" },
  { id: "current_pay_period", label: "Pay period" },
  { id: "previous_week", label: "Previous week" },
  { id: "current_month", label: "Current month" },
  { id: "last_30_days", label: "Last 30 days" },
  { id: "custom", label: "Custom range" },
];

export function TimeRangePicker({
  value,
  preset,
  onChange,
}: {
  value: TimeRange;
  preset: TimeRangePreset;
  onChange: (next: { range: TimeRange; preset: TimeRangePreset }) => void;
}) {
  const [draftRange, setDraftRange] = useState<TimeRange>(value);
  const [draftPreset, setDraftPreset] = useState<TimeRangePreset>(preset);
  const payPeriodOptions = useMemo(() => listPayPeriodOptions(), []);
  const [selectedPayPeriodId, setSelectedPayPeriodId] = useState(() => `${value.startDate}:${value.endDate}`);

  useEffect(() => {
    setDraftRange(value);
    setDraftPreset(preset);
    setSelectedPayPeriodId(`${value.startDate}:${value.endDate}`);
  }, [preset, value.endDate, value.startDate]);

  function applyPreset(nextPreset: TimeRangePreset) {
    const range = getPresetRange(nextPreset);
    setDraftPreset(nextPreset);
    setDraftRange(range);
    if (nextPreset === "custom") {
      return;
    }

    if (nextPreset === "current_pay_period") {
      setSelectedPayPeriodId(`${range.startDate}:${range.endDate}`);
    }

    onChange({ range, preset: nextPreset });
  }

  function applyCustomRange() {
    if (!draftRange.startDate || !draftRange.endDate || draftRange.startDate > draftRange.endDate) {
      return;
    }

    onChange({ range: draftRange, preset: draftPreset });
  }

  return (
    <div className="mt-4 rounded-2xl border border-border-default bg-surface-overlay p-4">
      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <label className="space-y-1 text-sm text-text-secondary">
          <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Range type</span>
          <select
            value={draftPreset}
            onChange={(event) => applyPreset(event.target.value as TimeRangePreset)}
            className="w-full rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-text-primary"
          >
            {PRESET_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {draftPreset === "current_pay_period" ? (
          <label className="space-y-1 text-sm text-text-secondary">
            <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Pay period</span>
            <select
              value={selectedPayPeriodId}
              onChange={(event) => {
                const nextId = event.target.value;
                const [startDate, endDate] = nextId.split(":");
                const range = { startDate, endDate };
                setSelectedPayPeriodId(nextId);
                setDraftRange(range);
                onChange({ range, preset: "current_pay_period" });
              }}
              className="w-full rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-text-primary"
            >
              {payPeriodOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : draftPreset === "custom" ? (
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="space-y-1 text-sm text-text-secondary">
              <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Start date</span>
              <input
                type="date"
                value={draftRange.startDate}
                onChange={(event) => {
                  const nextRange = { ...draftRange, startDate: event.target.value };
                  setDraftRange(nextRange);
                }}
                className="w-full rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-text-primary"
              />
            </label>

            <label className="space-y-1 text-sm text-text-secondary">
              <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">End date</span>
              <input
                type="date"
                value={draftRange.endDate}
                onChange={(event) => {
                  const nextRange = { ...draftRange, endDate: event.target.value };
                  setDraftRange(nextRange);
                }}
                className="w-full rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-text-primary"
              />
            </label>

            <button
              type="button"
              onClick={applyCustomRange}
              disabled={!draftRange.startDate || !draftRange.endDate || draftRange.startDate > draftRange.endDate}
              className="self-end rounded-xl bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              Apply range
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-border-default bg-surface-raised px-4 py-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">Selected range</p>
            <p className="mt-1 text-sm text-text-primary">{formatRangeLabel(draftRange)}</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-text-tertiary">
        Pay period uses a biweekly Sunday-Saturday cycle anchored to Apr 5, 2026 through Apr 18, 2026.
      </p>
    </div>
  );
}

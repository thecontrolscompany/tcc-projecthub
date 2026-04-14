export type TimeRangePreset =
  | "current_week"
  | "previous_week"
  | "current_pay_period"
  | "current_month"
  | "last_30_days"
  | "custom";

export type TimeRange = {
  startDate: string;
  endDate: string;
};

const PAY_PERIOD_ANCHOR = startOfDay(new Date("2026-04-05T00:00:00"));

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatIsoDate(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

export function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return startOfDay(parsed);
}

export function getCurrentWeekRange(now = new Date()): TimeRange {
  const today = startOfDay(now);
  const day = today.getDay();
  const daysFromMonday = (day + 6) % 7;
  const weekStart = addDays(today, -daysFromMonday);
  const weekEnd = addDays(weekStart, 6);

  return {
    startDate: formatIsoDate(weekStart),
    endDate: formatIsoDate(weekEnd),
  };
}

export function getPreviousWeekRange(now = new Date()): TimeRange {
  const currentWeek = getCurrentWeekRange(now);
  const currentStart = parseIsoDate(currentWeek.startDate);
  if (!currentStart) {
    return currentWeek;
  }

  return {
    startDate: formatIsoDate(addDays(currentStart, -7)),
    endDate: formatIsoDate(addDays(currentStart, -1)),
  };
}

export function getCurrentMonthRange(now = new Date()): TimeRange {
  const today = startOfDay(now);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    startDate: formatIsoDate(monthStart),
    endDate: formatIsoDate(monthEnd),
  };
}

export function getLast30DaysRange(now = new Date()): TimeRange {
  const today = startOfDay(now);

  return {
    startDate: formatIsoDate(addDays(today, -29)),
    endDate: formatIsoDate(today),
  };
}

export function getCurrentPayPeriodRange(now = new Date()): TimeRange {
  const today = startOfDay(now);
  const diffDays = Math.floor((today.getTime() - PAY_PERIOD_ANCHOR.getTime()) / 86400000);
  const completedPeriods = Math.floor(diffDays / 14);
  const periodStart = addDays(PAY_PERIOD_ANCHOR, completedPeriods * 14);
  const periodEnd = addDays(periodStart, 13);

  return {
    startDate: formatIsoDate(periodStart),
    endDate: formatIsoDate(periodEnd),
  };
}

export function getPayPeriodRangeByOffset(offset: number, now = new Date()): TimeRange {
  const current = getCurrentPayPeriodRange(now);
  const currentStart = parseIsoDate(current.startDate) ?? PAY_PERIOD_ANCHOR;
  const periodStart = addDays(currentStart, offset * 14);
  const periodEnd = addDays(periodStart, 13);

  return {
    startDate: formatIsoDate(periodStart),
    endDate: formatIsoDate(periodEnd),
  };
}

export function formatShortDate(value: string) {
  const parsed = parseIsoDate(value);
  if (!parsed) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  }).format(parsed);
}

export function formatRangeLabel(range: TimeRange) {
  return `${formatShortDate(range.startDate)}-${formatShortDate(range.endDate)}`;
}

export function listPayPeriodOptions(now = new Date(), before = 8, after = 8) {
  return Array.from({ length: before + after + 1 }, (_, index) => {
    const offset = index - before;
    const range = getPayPeriodRangeByOffset(offset, now);
    return {
      id: `${range.startDate}:${range.endDate}`,
      range,
      label: formatRangeLabel(range),
    };
  });
}

export function getPresetRange(preset: TimeRangePreset, now = new Date()): TimeRange {
  switch (preset) {
    case "previous_week":
      return getPreviousWeekRange(now);
    case "current_pay_period":
      return getCurrentPayPeriodRange(now);
    case "current_month":
      return getCurrentMonthRange(now);
    case "last_30_days":
      return getLast30DaysRange(now);
    case "custom":
      return getCurrentWeekRange(now);
    case "current_week":
    default:
      return getCurrentWeekRange(now);
  }
}

export function resolveTimeRange(params: {
  startDate?: string | null;
  endDate?: string | null;
  weekStart?: string | null;
}) {
  const directStart = params.startDate ? parseIsoDate(params.startDate) : null;
  const directEnd = params.endDate ? parseIsoDate(params.endDate) : null;

  if (directStart && directEnd && directStart <= directEnd) {
    return {
      startDate: formatIsoDate(directStart),
      endDate: formatIsoDate(directEnd),
      endExclusive: formatIsoDate(addDays(directEnd, 1)),
    };
  }

  const legacyWeekStart = params.weekStart ? parseIsoDate(params.weekStart) : null;
  if (legacyWeekStart) {
    const legacyWeekEnd = addDays(legacyWeekStart, 6);
    return {
      startDate: formatIsoDate(legacyWeekStart),
      endDate: formatIsoDate(legacyWeekEnd),
      endExclusive: formatIsoDate(addDays(legacyWeekEnd, 1)),
    };
  }

  const fallback = getCurrentWeekRange();
  const fallbackEnd = parseIsoDate(fallback.endDate);

  return {
    startDate: fallback.startDate,
    endDate: fallback.endDate,
    endExclusive: fallbackEnd ? formatIsoDate(addDays(fallbackEnd, 1)) : fallback.endDate,
  };
}

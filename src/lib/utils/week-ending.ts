import { endOfWeek, format } from "date-fns";

function parseAsLocalDate(value: string | Date) {
  if (value instanceof Date) {
    return value;
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  return new Date(value);
}

export function normalizeWeekEndingSaturday(value: string | Date) {
  const parsed = parseAsLocalDate(value);
  return format(endOfWeek(parsed, { weekStartsOn: 0 }), "yyyy-MM-dd");
}

export function formatWeekEndingSaturday(value: string | Date, pattern: string) {
  const parsed = parseAsLocalDate(value);
  return format(endOfWeek(parsed, { weekStartsOn: 0 }), pattern);
}

import { DateTime } from "luxon";

export type DateParts = {
  year: number;
  month: number;
  day: number;
  isoDate: string;
  monthDay: string;
};

export function getTodayDateParts(tz: string): DateParts {
    const now = DateTime.now().setZone(tz);
  return {
      year: now.year,
      month: now.month,
      day: now.day,
      isoDate: now.toISODate()!,
      monthDay: `${now.month}/${now.day}`
  };
}

export function getDateRangeParts(tz: string, daysAhead: number): DateParts[] {
  const start = DateTime.now().setZone(tz).startOf("day");
  return Array.from({ length: daysAhead + 1 }, (_, offset) => {
    const date = start.plus({ days: offset });
    return {
      year: date.year,
      month: date.month,
      day: date.day,
      isoDate: date.toISODate()!,
      monthDay: `${date.month}/${date.day}`
    };
  });
}

export function nowIsoInTimezone(tz: string): string {
    return DateTime.now().setZone(tz).toISO()!;
}

export function formatIsoDateWithWeekday(isoDate: string, tz: string): string {
  const date = DateTime.fromISO(isoDate, { zone: tz });
  const weekdayText = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"][date.weekday - 1] ?? "";
  return `${date.toISODate()} (${weekdayText})`;
}

export function normalizeTimeValueToHour(timeValue: string): string {
  const matched = timeValue?.trim().match(/^(\d{1,2})[:：](\d{1,2})(?::\d{1,2})?$/);
  if (!matched) {
    return timeValue;
  }

  const hour = Number(matched[1]);
  const minute = Number(matched[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return timeValue;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return timeValue;
  }

  return `${String(hour).padStart(2, "0")}:00`;
}

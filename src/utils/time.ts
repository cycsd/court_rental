import { DateTime } from "luxon";

export function getTodayDateParts(tz: string): {
  year: number;
  month: number;
  day: number;
  isoDate: string;
  monthDay: string;
} {
    const now = DateTime.now().setZone(tz);
  return {
      year: now.year,
      month: now.month,
      day: now.day,
      isoDate: now.toISODate()!,
      monthDay: `${now.month}/${now.day}`
  };
}

export function nowIsoInTimezone(tz: string): string {
    return DateTime.now().setZone(tz).toISO()!;
}

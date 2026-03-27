import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export function getTodayDateParts(tz: string): {
  year: number;
  month: number;
  day: number;
  isoDate: string;
  monthDay: string;
} {
  const now = dayjs().tz(tz);
  return {
    year: now.year(),
    month: now.month() + 1,
    day: now.date(),
    isoDate: now.format("YYYY-MM-DD"),
    monthDay: `${now.month() + 1}/${now.date()}`
  };
}

export function nowIsoInTimezone(tz: string): string {
  return dayjs().tz(tz).format();
}

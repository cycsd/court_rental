import { env } from "../config/env.js";
import { parseTodaySlots } from "../parser/scheduleParser.js";
import { fetchVenuePageText } from "../scraper/venueScraper.js";
import type { TodayCheckResult } from "../types/schedule.js";
import { getTodayDateParts, nowIsoInTimezone } from "../utils/time.js";

export async function checkTodayStatus(): Promise<TodayCheckResult> {
  const today = getTodayDateParts(env.TIMEZONE);
  const text = await fetchVenuePageText(env.VENUE_URL, env.HEADLESS);

  const slots = parseTodaySlots({
    pageText: text,
    isoDate: today.isoDate,
    monthDay: today.monthDay,
    courtName: "網球場"
  });

  const expiredSlots = slots.filter((slot) => slot.isExpiredStopRent).length;

  return {
    venueUrl: env.VENUE_URL,
    checkedAt: nowIsoInTimezone(env.TIMEZONE),
    timezone: env.TIMEZONE,
    totalSlots: slots.length,
    expiredSlots,
    slots
  };
}

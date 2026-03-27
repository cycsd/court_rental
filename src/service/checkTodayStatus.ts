import { env } from "../config/env.js";
import { buildTimeSummary, parseTodaySlots } from "../parser/scheduleParser.js";
import { fetchAllCourtsData } from "../scraper/venueScraper.js";
import type { TodayCheckResult } from "../types/schedule.js";
import type { SlotStatus } from "../types/schedule.js";
import { getTodayDateParts, nowIsoInTimezone } from "../utils/time.js";

export async function checkTodayStatus(): Promise<TodayCheckResult> {
  const today = getTodayDateParts(env.TIMEZONE);
    const scrapeResult = await fetchAllCourtsData(env.VENUE_URL, env.HEADLESS);
    const { venueName, courtsData } = scrapeResult;

    const allSlots: SlotStatus[] = [];
    for (const courtData of courtsData) {
      const slots = parseTodaySlots({
        pageText: courtData.scheduleText,
        isoDate: today.isoDate,
        monthDay: today.monthDay,
        courtName: courtData.courtName
    });
      allSlots.push(...slots);
  }

    const courtNames = courtsData.map((c) => c.courtName);
    const rentedSlots = allSlots.filter((slot) => slot.isRented).length;
    const timeSummary = buildTimeSummary(allSlots, courtNames);

  return {
      venueName,
    venueUrl: env.VENUE_URL,
    checkedAt: nowIsoInTimezone(env.TIMEZONE),
    timezone: env.TIMEZONE,
      courts: courtNames,
      totalSlots: allSlots.length,
      rentedSlots,
      slots: allSlots,
      timeSummary
  };
}

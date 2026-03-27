import { env } from "../config/env.js";
import { buildTimeSummary, parseTodaySlots } from "../parser/scheduleParser.js";
import { fetchAllCourtsData } from "../scraper/venueScraper.js";
import type { TodayCheckResult } from "../types/schedule.js";
import type { SlotStatus } from "../types/schedule.js";
import { getTodayDateParts, nowIsoInTimezone } from "../utils/time.js";
import { fetchTodayHourlyWeather, mergeWeatherToSummary } from "../weather/openMeteoWeather.js";

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
    const baseTimeSummary = buildTimeSummary(allSlots, courtNames);

    let timeSummary = baseTimeSummary;
    try {
        const weatherMap = await fetchTodayHourlyWeather(env.WEATHER_LAT, env.WEATHER_LON, env.TIMEZONE);
        timeSummary = mergeWeatherToSummary(baseTimeSummary, weatherMap);
    } catch {
        // Weather is supplemental; continue without weather data when API fails.
        timeSummary = baseTimeSummary;
    }

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

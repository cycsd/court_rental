import pino from "pino";
import { env } from "../config/env.js";
import { buildTimeSummary, parseSlotsForDate } from "../parser/scheduleParser.js";
import { fetchAllCourtsData } from "../scraper/venueScraper.js";
import type { TodayCheckResult } from "../types/schedule.js";
import type { SlotStatus } from "../types/schedule.js";
import { getDateRangeParts, nowIsoInTimezone } from "../utils/time.js";
import { fetchTodayHourlyWeather, mergeWeatherToSummary } from "../weather/openMeteoWeather.js";

const logger = pino({ name: "check-today-status" });

export async function checkTodayStatus(): Promise<TodayCheckResult> {
  const dateRange = getDateRangeParts(env.TIMEZONE, 6);
  const monthWindowCount = new Set(dateRange.map((date) => `${date.year}-${date.month}`)).size;
  const includeNextMonth = monthWindowCount > 1;
  const scrapeResult = await fetchAllCourtsData(env.VENUE_URL, env.HEADLESS, {
    includeNextMonth
  });
    const { venueName, courtsData } = scrapeResult;

    const allSlots: SlotStatus[] = [];
    for (const courtData of courtsData) {
      for (const date of dateRange) {
        const slots = parseSlotsForDate({
          pageText: courtData.scheduleText,
          isoDate: date.isoDate,
          monthDay: date.monthDay,
          courtName: courtData.courtName
        });
        allSlots.push(...slots);
      }
  }

    const courtNames = courtsData.map((c) => c.courtName);
    const rentedSlots = allSlots.filter((slot) => slot.isRented).length;
    const baseTimeSummary = buildTimeSummary(allSlots, courtNames);

    let timeSummary = baseTimeSummary;
    try {
        const weatherMap = await fetchTodayHourlyWeather(env.WEATHER_LAT, env.WEATHER_LON, env.TIMEZONE);
        timeSummary = mergeWeatherToSummary(baseTimeSummary, weatherMap);
    } catch (error) {
      logger.warn({ err: error }, "Weather data unavailable, fallback to no-weather summary");
    // Weather is supplemental; continue without weather data when API fails.
        timeSummary = baseTimeSummary;
    }

  return {
      venueName,
    venueUrl: env.VENUE_URL,
    checkedAt: nowIsoInTimezone(env.TIMEZONE),
    timezone: env.TIMEZONE,
    dateRange: {
      startDate: dateRange[0]?.isoDate ?? "",
      endDate: dateRange[dateRange.length - 1]?.isoDate ?? "",
      days: dateRange.map((date) => date.isoDate)
    },
      courts: courtNames,
      totalSlots: allSlots.length,
      rentedSlots,
      slots: allSlots,
      timeSummary
  };
}

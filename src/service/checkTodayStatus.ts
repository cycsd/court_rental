import pino from "pino";
import { env } from "../config/env.js";
import { buildTimeSummary, parseSlotsForDate } from "../parser/scheduleParser.js";
import { fetchAllCourtsData } from "../scraper/venueScraper.js";
import type { TodayCheckResult } from "../types/schedule.js";
import type { SlotStatus } from "../types/schedule.js";
import { getDateRangeParts, nowIsoInTimezone } from "../utils/time.js";
import { fetchTodayHourlyWeather, mergeWeatherToSummary } from "../weather/openMeteoWeather.js";

const logger = pino({ name: "check-today-status" });

type DateRangePart = ReturnType<typeof getDateRangeParts>[number];

function collectSlots(
  courtsData: { courtName: string; scheduleText: string }[],
  dateRange: DateRangePart[]
): SlotStatus[] {
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

  return allSlots;
}

function findMissingNextMonthCoverage(
  slots: SlotStatus[],
  courtNames: string[],
  dateRange: DateRangePart[]
): string[] {
  if (dateRange.length === 0) {
    return [];
  }

  const firstMonth = dateRange[0].month;
  const nextMonthDates = dateRange.filter((date) => date.month !== firstMonth).map((date) => date.isoDate);
  if (nextMonthDates.length === 0) {
    return [];
  }

  const covered = new Set(slots.map((slot) => `${slot.court}|${slot.date}`));
  const missing: string[] = [];

  for (const courtName of courtNames) {
    for (const isoDate of nextMonthDates) {
      if (!covered.has(`${courtName}|${isoDate}`)) {
        missing.push(`${courtName} @ ${isoDate}`);
      }
    }
  }

  return missing;
}

export async function checkTodayStatus(): Promise<TodayCheckResult> {
  const dateRange = getDateRangeParts(env.TIMEZONE, 6);
  const monthWindowCount = new Set(dateRange.map((date) => `${date.year}-${date.month}`)).size;
  const includeNextMonth = monthWindowCount > 1;
  let scrapeResult = await fetchAllCourtsData(env.VENUE_URL, env.HEADLESS, {
    includeNextMonth
  });
  let { venueName, courtsData } = scrapeResult;
  let allSlots = collectSlots(courtsData, dateRange);

  if (includeNextMonth) {
    const initialMissingCoverage = findMissingNextMonthCoverage(allSlots, courtsData.map((c) => c.courtName), dateRange);
    if (initialMissingCoverage.length > 0) {
      logger.warn(
        {
          missingCount: initialMissingCoverage.length,
          missingCoverage: initialMissingCoverage.slice(0, 10)
        },
        "Detected incomplete next-month coverage, retrying scrape once"
      );

      await new Promise((resolve) => setTimeout(resolve, 1500));
      const retryScrapeResult = await fetchAllCourtsData(env.VENUE_URL, env.HEADLESS, {
        includeNextMonth
      });
      const retrySlots = collectSlots(retryScrapeResult.courtsData, dateRange);
      const retryMissingCoverage = findMissingNextMonthCoverage(
        retrySlots,
        retryScrapeResult.courtsData.map((c) => c.courtName),
        dateRange
      );

      if (retryMissingCoverage.length <= initialMissingCoverage.length) {
        scrapeResult = retryScrapeResult;
        venueName = retryScrapeResult.venueName;
        courtsData = retryScrapeResult.courtsData;
        allSlots = retrySlots;
      }

      if (retryMissingCoverage.length > 0) {
        logger.warn(
          {
            missingCount: retryMissingCoverage.length,
            missingCoverage: retryMissingCoverage.slice(0, 10)
          },
          "Next-month coverage still incomplete after retry"
        );
      }
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

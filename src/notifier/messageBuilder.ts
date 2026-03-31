import type { TodayCheckResult } from "../types/schedule.js";
import { formatIsoDateWithWeekday } from "../utils/time.js";
import { buildTelegramWeatherSummary, isCourtUsable } from "./weatherPresentation.js";

export function buildNotificationMessage(result: TodayCheckResult): string {
    const courts = result.courts.join("、");
    const timeLine = result.timeSummary
        .map((ts) => {
            const usable = isCourtUsable(ts);
            const icon = usable ? "✅" : ts.available === 0 ? "❌" : "⚠️";
            const label =
                ts.available === 0
                    ? "無可用(停止租借)場地"
                    : ts.availableCourts.join("、");
            const weatherSummary = buildTelegramWeatherSummary(
                ts.weatherText,
                ts.temperatureC,
                ts.precipitationMm,
                ts.wetScore
            );
            return `${icon} ${formatIsoDateWithWeekday(ts.date, result.timezone)} ${ts.time}  ${ts.available}/${ts.total}  ${weatherSummary}  ${label}`;
        })
        .join("\n");

    const usableCount = result.timeSummary.filter((ts) => isCourtUsable(ts)).length;

    const availableCount = result.timeSummary.filter((ts) => ts.available > 0).length;
  return [
      "🎾 Court Rental 未來 7 天場地狀態",
      `🕐 ${result.checkedAt}`,
      `📅 範圍：${formatIsoDateWithWeekday(result.dateRange.startDate, result.timezone)} ~ ${formatIsoDateWithWeekday(result.dateRange.endDate, result.timezone)}`,
      `🏟️ 場地：${courts}`,
      `📊 有可用(停止租借)場地的時段：${availableCount} / ${result.timeSummary.length}`,
      `🎯 適合打球的時段：${usableCount} / ${result.timeSummary.length}`,
    "",
      "各日期時段（✅ 適合打球  ⚠️ 有場地但天氣不佳  ❌ 無可用）",
      "─────────────────────────",
      timeLine,
    "",
    `來源: ${result.venueUrl}`
  ].join("\n");
}

import type { TodayCheckResult } from "../types/schedule.js";
import { buildTelegramWeatherSummary } from "./weatherPresentation.js";

export function buildNotificationMessage(result: TodayCheckResult): string {
    const courts = result.courts.join("、");
    const timeLine = result.timeSummary
        .map((ts) => {
            const usable = ts.isUsable ?? false;
            const icon = usable ? "✅" : ts.available === 0 ? "❌" : "⚠️";
            const label =
                ts.available === 0
                    ? "無可用(停止租借)場地"
                    : ts.availableCourts.join("、");
            const weatherSummary = buildTelegramWeatherSummary(
                ts.weatherText,
                ts.temperatureC,
                ts.precipitationProbability
            );
            return `${icon} ${ts.time}  ${ts.available}/${ts.total}  ${weatherSummary}  ${label}`;
        })
        .join("\n");

    const usableCount = result.timeSummary.filter((ts) => ts.isUsable ?? false).length;

    const availableCount = result.timeSummary.filter((ts) => ts.available > 0).length;
  return [
      "🎾 Court Rental 今日場地狀態",
      `🕐 ${result.checkedAt}`,
      `🏟️ 場地：${courts}`,
      `📊 有可用(停止租借)場地的時段：${availableCount} / ${result.timeSummary.length}`,
      `🎯 適合打球的時段：${usableCount} / ${result.timeSummary.length}`,
    "",
      "各時段（✅ 適合打球  ⚠️ 有場地但天氣不佳  ❌ 無可用）",
      "─────────────────────────",
      timeLine,
    "",
    `來源: ${result.venueUrl}`
  ].join("\n");
}

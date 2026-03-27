import type { TodayCheckResult } from "../types/schedule.js";

export function buildNotificationMessage(result: TodayCheckResult): string {
    const courts = result.courts.join("、");
    const timeLine = result.timeSummary
        .map((ts) => {
            const icon = ts.available === ts.total ? "✅" : ts.available > 0 ? "⚠️" : "❌";
            const label =
                ts.available === 0
                    ? "無可用(停止租借)場地"
                    : ts.availableCourts.join("、");
            return `${icon} ${ts.time}  ${ts.available}/${ts.total}  ${label}`;
        })
        .join("\n");

    const availableCount = result.timeSummary.filter((ts) => ts.available > 0).length;
  return [
      "🎾 Court Rental 今日場地狀態",
      `🕐 ${result.checkedAt}`,
      `🏟️ 場地：${courts}`,
      `📊 有可用(停止租借)場地的時段：${availableCount} / ${result.timeSummary.length}`,
    "",
      "各時段（✅ 全可用(停止租借)  ⚠️ 部分可用  ❌ 無可用）",
      "─────────────────────────",
      timeLine,
    "",
    `來源: ${result.venueUrl}`
  ].join("\n");
}

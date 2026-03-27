import type { TodayCheckResult } from "../types/schedule.js";

export function buildNotificationMessage(result: TodayCheckResult): string {
  const expiredSlots = result.slots.filter((slot) => slot.isExpiredStopRent);
  const activeSlots = result.slots.filter((slot) => !slot.isExpiredStopRent);

  const expiredText =
    expiredSlots.length > 0
      ? expiredSlots.map((slot) => `${slot.time} ${slot.rawStatus}`).join("\n")
      : "無";

  const activeText =
    activeSlots.length > 0 ? activeSlots.map((slot) => `${slot.time} ${slot.rawStatus}`).join("\n") : "無";

  return [
    "Court Rental 每日檢查結果",
    `時間: ${result.checkedAt}`,
    `總時段: ${result.totalSlots}`,
    `已過期/停止租借: ${result.expiredSlots}`,
    `可用或其他狀態: ${result.totalSlots - result.expiredSlots}`,
    "",
    "已過期/停止租借時段:",
    expiredText,
    "",
    "其他時段:",
    activeText,
    "",
    `來源: ${result.venueUrl}`
  ].join("\n");
}

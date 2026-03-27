import type { TodayCheckResult } from "../types/schedule.js";

export function printConsoleSummary(result: TodayCheckResult): void {
  console.log("=== Court Rental Today Status ===");
  console.log(`URL: ${result.venueUrl}`);
  console.log(`Checked At: ${result.checkedAt}`);
  console.log(`Timezone: ${result.timezone}`);
  console.log(`Total Slots: ${result.totalSlots}`);
  console.log(`Expired/Stop-rent Slots: ${result.expiredSlots}`);

  if (result.slots.length === 0) {
    console.log("No slots parsed for today. Please verify selector/format.");
    return;
  }

  console.log("\nTime | Expired | Status");
  console.log("------------------------");
  for (const slot of result.slots) {
    console.log(
      `${slot.time} | ${slot.isExpiredStopRent ? "Y" : "N"} | ${slot.rawStatus}`
    );
  }
}

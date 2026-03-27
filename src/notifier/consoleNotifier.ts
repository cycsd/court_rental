import type { TodayCheckResult } from "../types/schedule.js";
import { formatIsoDateWithWeekday } from "../utils/time.js";
import { isCourtUsable } from "./weatherPresentation.js";

export function printConsoleSummary(result: TodayCheckResult): void {
  console.log("=== Court Rental 7-Day Status ===");
    console.log(`Venue: ${result.venueName}`);
  console.log(`URL: ${result.venueUrl}`);
  console.log(`Checked At: ${result.checkedAt}`);
  console.log(`Timezone: ${result.timezone}`);
  console.log(`Date Range: ${formatIsoDateWithWeekday(result.dateRange.startDate, result.timezone)} ~ ${formatIsoDateWithWeekday(result.dateRange.endDate, result.timezone)}`);
    console.log(`Courts: ${result.courts.join(", ")}`);
  console.log(`Total Slots: ${result.totalSlots}`);
    console.log(`Rented Slots (視為不可用): ${result.rentedSlots}`);

    if (result.timeSummary.length === 0) {
      console.log("No slots parsed for the selected date range. Please verify selector/format.");
    return;
  }

  console.log("\n=== 各日期時段可用場地（停止租借） ===");
  console.log("日期       | 時間  | 可用數 | 天氣 | 可用場地(停止租借)");
  console.log("-----------+-------+--------+--------------------+------------------------------");
    for (const ts of result.timeSummary) {
        const usableIcon = isCourtUsable(ts) ? "✅" : "🚫";
        const ratio = `${ts.available}/${ts.total}`;
        const weather = ts.weatherText
            ? `${ts.weatherText} ${ts.temperatureC?.toFixed(1) ?? "-"}C/${ts.precipitationProbability ?? "-"}%`
            : "-";
        const available = ts.availableCourts.length > 0 ? ts.availableCourts.join(", ") : "無可用(停止租借)場地";
      console.log(`${usableIcon} ${formatIsoDateWithWeekday(ts.date, result.timezone)} | ${ts.time} | ${ratio.padEnd(6)} | ${weather.padEnd(18)} | ${available}`);
    }

  console.log("\n=== 各場地日期時段明細 ===");
    for (const court of result.courts) {
        console.log(`\n[ ${court} ]`);
        const courtSlots = result.slots
            .filter((s) => s.court === court)
          .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        for (const slot of courtSlots) {
          console.log(`  ${formatIsoDateWithWeekday(slot.date, result.timezone)} ${slot.time} | ${slot.isRented ? "Y" : "N"} | ${slot.rawStatus}`);
        }
  }
}

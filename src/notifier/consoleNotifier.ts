import type { TodayCheckResult } from "../types/schedule.js";

export function printConsoleSummary(result: TodayCheckResult): void {
  console.log("=== Court Rental Today Status ===");
    console.log(`Venue: ${result.venueName}`);
  console.log(`URL: ${result.venueUrl}`);
  console.log(`Checked At: ${result.checkedAt}`);
  console.log(`Timezone: ${result.timezone}`);
    console.log(`Courts: ${result.courts.join(", ")}`);
  console.log(`Total Slots: ${result.totalSlots}`);
    console.log(`Rented Slots (視為不可用): ${result.rentedSlots}`);

    if (result.timeSummary.length === 0) {
    console.log("No slots parsed for today. Please verify selector/format.");
    return;
  }

    console.log("\n=== 各時段可用場地（停止租借） ===");
    console.log("時間  | 可用數 | 可用場地(停止租借)");
    console.log("------+--------+------------------------------");
    for (const ts of result.timeSummary) {
        const ratio = `${ts.available}/${ts.total}`;
        const available = ts.availableCourts.length > 0 ? ts.availableCourts.join(", ") : "無可用(停止租借)場地";
        console.log(`${ts.time} | ${ratio.padEnd(6)} | ${available}`);
    }

    console.log("\n=== 各場地時段明細 ===");
    for (const court of result.courts) {
        console.log(`\n[ ${court} ]`);
        const courtSlots = result.slots
            .filter((s) => s.court === court)
            .sort((a, b) => a.time.localeCompare(b.time));
        for (const slot of courtSlots) {
            console.log(`  ${slot.time} | ${slot.isRented ? "Y" : "N"} | ${slot.rawStatus}`);
        }
  }
}

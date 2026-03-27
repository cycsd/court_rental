import { describe, expect, it } from "vitest";
import { buildTimeSummary, parseTodaySlots } from "../src/parser/scheduleParser.js";

describe("parseTodaySlots", () => {
  it("parses slots and marks expired keywords", () => {
    const text = `
      2026 / 3 / 27 ( 五 )
      3/27 08 : 00 | 已過期 停止租借
      3/27 09 : 00 | Xplus
      3/27 10 : 00 | 已過期
    `;

    const slots = parseTodaySlots({
      pageText: text,
      isoDate: "2026-03-27",
      monthDay: "3/27",
      courtName: "網球場5"
    });

    expect(slots).toHaveLength(3);
    expect(slots[0]).toEqual({
      date: "2026-03-27",
      court: "網球場5",
      time: "08:00",
      rawStatus: "已過期 停止租借",
      isExpiredStopRent: true
    });
    expect(slots[1].isExpiredStopRent).toBe(false);
    expect(slots[2].isExpiredStopRent).toBe(true);
  });
});

describe("buildTimeSummary", () => {
    const makeSlot = (time: string, court: string, expired: boolean) => ({
        date: "2026-03-27",
        court,
        time,
        rawStatus: expired ? "已過期 停止租借" : "Xplus",
        isExpiredStopRent: expired
    });

    it("aggregates available and unavailable courts per time slot", () => {
        const allSlots = [
            makeSlot("08:00", "網球場5", true),
            makeSlot("08:00", "網球場6", true),
            makeSlot("08:00", "網球場7", false),
            makeSlot("09:00", "網球場5", false),
            makeSlot("09:00", "網球場6", false),
            makeSlot("09:00", "網球場7", false)
        ];
        const courts = ["網球場5", "網球場6", "網球場7"];
        const summary = buildTimeSummary(allSlots, courts);

        expect(summary).toHaveLength(2);

        expect(summary[0].time).toBe("08:00");
        expect(summary[0].available).toBe(1);
        expect(summary[0].availableCourts).toEqual(["網球場7"]);
        expect(summary[0].unavailableCourts).toEqual(["網球場5", "網球場6"]);
        expect(summary[0].total).toBe(3);

        expect(summary[1].time).toBe("09:00");
        expect(summary[1].available).toBe(3);
        expect(summary[1].total).toBe(3);
    });

    it("marks all-expired time slots correctly", () => {
        const allSlots = [
            makeSlot("10:00", "網球場5", true),
            makeSlot("10:00", "網球場6", true)
        ];
        const summary = buildTimeSummary(allSlots, ["網球場5", "網球場6"]);
        expect(summary[0].available).toBe(0);
        expect(summary[0].availableCourts).toEqual([]);
    });
});

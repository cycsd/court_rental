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
        isRented: false
    });
      expect(slots[1].isRented).toBe(true);
      expect(slots[2].isRented).toBe(true);
  });

  it("does not include page footer legend text in the last slot status", () => {
    const text = `
      2026 / 3 / 31 ( 二 )
      3/31 20:00 | X網球
      3/31 21:00 | 網球練習 可租借時段 ( Can be rented ) 不可租借時段 ( Can not be rented ) 注意事項：申請租借日期需於活動前10天完成手續。
    `;

    const slots = parseTodaySlots({
      pageText: text,
      isoDate: "2026-03-31",
      monthDay: "3/31",
      courtName: "網球場5"
    });

    expect(slots).toHaveLength(2);
    expect(slots[1]).toMatchObject({
      time: "21:00",
      rawStatus: "網球練習"
    });
  });

  it("parses zero-padded next-month dates", () => {
    const text = `
      2026 / 4 / 01 ( 三 )
      4/01 08 : 00 | 已過期 停止租借
      4/01 09 : 00 | Xplus
      2026 / 4 / 02 ( 四 )
      4/02 08 : 00 | 已過期 停止租借
    `;

    const slots = parseTodaySlots({
      pageText: text,
      isoDate: "2026-04-01",
      monthDay: "4/1",
      courtName: "網球場5"
    });

    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({
      date: "2026-04-01",
      time: "08:00",
      rawStatus: "已過期 停止租借",
      isRented: false
    });
    expect(slots[1]).toMatchObject({
      time: "09:00",
      rawStatus: "Xplus",
      isRented: true
    });
  });
});

describe("buildTimeSummary", () => {
    const makeSlot = (time: string, court: string, rented: boolean) => ({
        date: "2026-03-27",
        court,
        time,
      rawStatus: rented ? "Xplus" : "已過期 停止租借",
      isRented: rented
    });

    it("aggregates available and unavailable courts per time slot", () => {
        const allSlots = [
            makeSlot("08:00", "網球場5", false),
            makeSlot("08:00", "網球場6", false),
            makeSlot("08:00", "網球場7", true),
            makeSlot("09:00", "網球場5", true),
            makeSlot("09:00", "網球場6", true),
            makeSlot("09:00", "網球場7", true)
        ];
        const courts = ["網球場5", "網球場6", "網球場7"];
        const summary = buildTimeSummary(allSlots, courts);

        expect(summary).toHaveLength(2);

        expect(summary[0].time).toBe("08:00");
        expect(summary[0].available).toBe(2);
        expect(summary[0].availableCourts).toEqual(["網球場5", "網球場6"]);
        expect(summary[0].unavailableCourts).toEqual(["網球場7"]);
        expect(summary[0].total).toBe(3);

        expect(summary[1].time).toBe("09:00");
        expect(summary[1].available).toBe(0);
        expect(summary[1].total).toBe(3);
    });

    it("marks all-expired time slots correctly", () => {
        const allSlots = [
            makeSlot("10:00", "網球場5", false),
            makeSlot("10:00", "網球場6", false)
        ];
        const summary = buildTimeSummary(allSlots, ["網球場5", "網球場6"]);
        expect(summary[0].available).toBe(2);
        expect(summary[0].availableCourts).toEqual(["網球場5", "網球場6"]);
    });

  it("groups the same time on different dates separately", () => {
    const allSlots = [
      {
        date: "2026-03-27",
        court: "網球場5",
        time: "08:00",
        rawStatus: "已過期 停止租借",
        isRented: false
      },
      {
        date: "2026-03-28",
        court: "網球場5",
        time: "08:00",
        rawStatus: "Xplus",
        isRented: true
      }
    ];

    const summary = buildTimeSummary(allSlots, ["網球場5"]);
    expect(summary).toHaveLength(2);
    expect(summary[0]).toMatchObject({ date: "2026-03-27", time: "08:00", available: 1 });
    expect(summary[1]).toMatchObject({ date: "2026-03-28", time: "08:00", available: 0 });
  });
});

import { describe, expect, it } from "vitest";
import { parseTodaySlots } from "../src/parser/scheduleParser.js";

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

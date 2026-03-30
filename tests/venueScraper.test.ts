import { describe, expect, it } from "vitest";
import { combineScheduleTexts, trimTrailingNonScheduleText } from "../src/scraper/venueScraper.js";

describe("trimTrailingNonScheduleText", () => {
  it("does not trim when marker appears before the first schedule slot", () => {
    const input = `
      可租借時段 ( Can be rented )
      3/31 20:00 | X網球
      3/31 21:00 | 網球練習
    `;

    const text = trimTrailingNonScheduleText(input);

    expect(text).toContain("3/31 20:00 | X網球");
    expect(text).toContain("3/31 21:00 | 網球練習");
  });

  it("trims footer marker text when it appears after schedule slots", () => {
    const input = `
      3/31 20:00 | X網球
      3/31 21:00 | 網球練習
      可租借時段 ( Can be rented ) 不可租借時段 ( Can not be rented )
      Notice: Users should complete the reservation procedure at least 10 days before the use date.
    `;

    const text = trimTrailingNonScheduleText(input);

    expect(text).toContain("3/31 20:00 | X網球");
    expect(text).toContain("3/31 21:00 | 網球練習");
    expect(text).not.toContain("可租借時段 ( Can be rented )");
    expect(text).not.toContain("Notice:");
  });

  it("combines current and next month schedules without duplicating identical blocks", () => {
    const combined = combineScheduleTexts([
      "2026 / 3 / 31 ( 二 ) 3/31 20:00 | X網球",
      "2026 / 4 / 01 ( 三 ) 4/1 08:00 | 已過期 停止租借",
      "2026 / 3 / 31 ( 二 ) 3/31 20:00 | X網球"
    ]);

    expect(combined).toContain("2026 / 3 / 31 ( 二 ) 3/31 20:00 | X網球");
    expect(combined).toContain("2026 / 4 / 01 ( 三 ) 4/1 08:00 | 已過期 停止租借");
    expect(combined.match(/2026 \/ 3 \/ 31/g)).toHaveLength(1);
  });
});

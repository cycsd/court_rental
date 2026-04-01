import { describe, expect, it } from "vitest";

import { normalizeTimeValueToHour } from "../src/utils/time.js";

describe("normalizeTimeValueToHour", () => {
  it("normalizes minutes to full hour", () => {
    expect(normalizeTimeValueToHour("10:03")).toBe("10:00");
    expect(normalizeTimeValueToHour("10:59")).toBe("10:00");
  });

  it("supports non-zero-padded hour/minute and optional seconds", () => {
    expect(normalizeTimeValueToHour("9:7")).toBe("09:00");
    expect(normalizeTimeValueToHour("10:03:59")).toBe("10:00");
  });

  it("supports full-width colon", () => {
    expect(normalizeTimeValueToHour("10：03")).toBe("10:00");
  });

  it("keeps invalid values unchanged", () => {
    expect(normalizeTimeValueToHour("")).toBe("");
    expect(normalizeTimeValueToHour("abc")).toBe("abc");
    expect(normalizeTimeValueToHour("24:00")).toBe("24:00");
    expect(normalizeTimeValueToHour("10:99")).toBe("10:99");
  });
});

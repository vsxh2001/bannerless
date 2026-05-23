import { describe, expect, it } from "vitest";
import { currentPeriod, formatPeriod, recentPeriods } from "./period";

describe("period", () => {
  it("formats the current period as YYYY-MM with zero padding", () => {
    expect(currentPeriod(new Date(2026, 4, 23))).toBe("2026-05");
    expect(currentPeriod(new Date(2026, 0, 1))).toBe("2026-01");
  });

  it("formats a period for display", () => {
    expect(formatPeriod("2026-05")).toBe("May 2026");
    expect(formatPeriod("2026-12")).toBe("December 2026");
  });

  it("lists recent periods newest-first", () => {
    expect(recentPeriods(3, new Date(2026, 4, 15))).toEqual([
      "2026-05",
      "2026-04",
      "2026-03",
    ]);
  });

  it("crosses year boundaries", () => {
    expect(recentPeriods(2, new Date(2026, 0, 10))).toEqual([
      "2026-01",
      "2025-12",
    ]);
  });
});

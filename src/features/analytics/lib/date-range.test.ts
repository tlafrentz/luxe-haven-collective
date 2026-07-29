import { describe, expect, it } from "vitest";
import { differenceInNights } from "./calculations";
import { addDays, resolveAnalyticsDateRange } from "./date-range";

describe("analytics reporting-period contract", () => {
  it("treats browser start and end dates as inclusive business dates", () => {
    const period = resolveAnalyticsDateRange({ startDate: "2026-06-01", endDate: "2026-06-30" });
    expect(period).toEqual({ startDate: "2026-06-01", endDate: "2026-07-01" });
    expect(addDays(period.endDate, -1)).toBe("2026-06-30");
    expect(differenceInNights(period.startDate, period.endDate)).toBe(30);
  });

  it("does not shift date-only values across leap days or DST boundaries", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });
});

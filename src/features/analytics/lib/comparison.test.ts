import { describe, expect, it } from "vitest";
import { calculateTrend } from "./comparison";

describe("analytics comparison trust", () => {
  it("labels a positive value after zero as a new measurement", () => {
    expect(calculateTrend(100, 0)).toMatchObject({
      status: "new-measurement",
      percentChange: 0,
      direction: "up",
    });
  });

  it("suppresses an extreme percentage from a near-zero baseline", () => {
    expect(calculateTrend(100, 0.001)).toMatchObject({
      status: "unavailable",
      percentChange: 0,
    });
  });

  it("retains useful ordinary comparisons", () => {
    expect(calculateTrend(120, 100)).toMatchObject({
      status: "available",
      percentChange: 20,
    });
  });
});

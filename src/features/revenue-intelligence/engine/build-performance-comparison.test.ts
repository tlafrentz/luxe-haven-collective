import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createPropertyPerformance,
} from "../test-support/factories";

import {
  buildPerformanceComparison,
} from "./build-performance-comparison";

describe("buildPerformanceComparison", () => {
  it("builds positive performance trends", () => {
    const previous =
      createPropertyPerformance();

    const current =
      createPropertyPerformance({
        revenue: {
          ...previous.revenue,
          grossRevenue: 3600,
          roomRevenue: 3000,
          averageDailyRate: 180,
          revPar: 96,
        },
        occupancy: {
          ...previous.occupancy,
          occupancyRate: 65,
        },
        bookings: {
          ...previous.bookings,
          averageLengthOfStay: 4,
          averageBookingLeadTime: 40,
          cancellationRate: 5,
        },
      });

    const result =
      buildPerformanceComparison({
        current,
        previous,
      });

    expect(result.grossRevenue).toMatchObject({
      difference: 600,
      percentChange: 20,
      direction: "up",
    });

    expect(result.roomRevenue).toMatchObject({
      difference: 600,
      percentChange: 25,
      direction: "up",
    });

    expect(result.occupancyRate.direction).toBe(
      "up",
    );

    expect(
      result.averageDailyRate.direction,
    ).toBe("up");

    expect(result.revPar.direction).toBe(
      "up",
    );

    expect(
      result.averageLengthOfStay.direction,
    ).toBe("up");

    expect(
      result.averageBookingLeadTime.direction,
    ).toBe("up");

    expect(
      result.cancellationRate.direction,
    ).toBe("up");
  });

  it("builds negative performance trends", () => {
    const previous =
      createPropertyPerformance();

    const current =
      createPropertyPerformance({
        revenue: {
          ...previous.revenue,
          grossRevenue: 2400,
          roomRevenue: 1800,
          averageDailyRate: 125,
          revPar: 60,
        },
        occupancy: {
          ...previous.occupancy,
          occupancyRate: 40,
        },
        bookings: {
          ...previous.bookings,
          averageLengthOfStay: 2,
          averageBookingLeadTime: 15,
          cancellationRate: 0,
        },
      });

    const result =
      buildPerformanceComparison({
        current,
        previous,
      });

    expect(result.grossRevenue.direction).toBe(
      "down",
    );

    expect(result.roomRevenue.direction).toBe(
      "down",
    );

    expect(result.occupancyRate.direction).toBe(
      "down",
    );

    expect(
      result.averageDailyRate.direction,
    ).toBe("down");

    expect(result.revPar.direction).toBe(
      "down",
    );

    expect(
      result.averageLengthOfStay.direction,
    ).toBe("down");

    expect(
      result.averageBookingLeadTime.direction,
    ).toBe("down");

    expect(
      result.cancellationRate.direction,
    ).toBe("neutral");
  });

  it("returns neutral trends when values are unchanged", () => {
    const performance =
      createPropertyPerformance();

    const result =
      buildPerformanceComparison({
        current: performance,
        previous: performance,
      });

    for (
      const trend of Object.values(result)
    ) {
      expect(trend).toEqual({
        difference: 0,
        percentChange: 0,
        direction: "neutral",
      });
    }
  });

  it("handles a zero previous-period value", () => {
    const previous =
      createPropertyPerformance({
        revenue: {
          ...createPropertyPerformance()
            .revenue,
          grossRevenue: 0,
          roomRevenue: 0,
        },
      });

    const current =
      createPropertyPerformance({
        revenue: {
          ...previous.revenue,
          grossRevenue: 1000,
          roomRevenue: 800,
        },
      });

    const result =
      buildPerformanceComparison({
        current,
        previous,
      });

    expect(
      result.grossRevenue.difference,
    ).toBe(1000);

    expect(
      result.grossRevenue.direction,
    ).toBe("up");

    expect(
      Number.isFinite(
        result.grossRevenue.percentChange,
      ),
    ).toBe(true);

    expect(
      result.roomRevenue.direction,
    ).toBe("up");
  });
});

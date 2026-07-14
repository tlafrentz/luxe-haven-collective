import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createRevenueIntelligence,
} from "../test-support/factories";

import {
  buildPortfolioSnapshot,
} from "./build-portfolio-snapshot";

describe("buildPortfolioSnapshot", () => {
  it("projects current performance and comparisons into the executive snapshot", () => {
    const intelligence =
      createRevenueIntelligence();

    const result =
      buildPortfolioSnapshot(
        intelligence,
      );

    expect(result).toMatchObject({
      propertyCount: 1,
      grossRevenue: {
        value: 3000,
      },
      roomRevenue: {
        value: 2400,
      },
      occupancyRate: {
        value: 51.6,
      },
      averageDailyRate: {
        value: 150,
      },
      revPar: {
        value: 77.42,
      },
      totalBookings: 5,
      upcomingBookings: 3,
      cancelledBookings: 0,
    });
  });
});

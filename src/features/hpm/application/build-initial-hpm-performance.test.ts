import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createOpportunity,
} from "@/features/revenue-intelligence/test-support/factories";

import {
  createRevenueIntelligence,
} from "@/features/executive-intelligence/test-support/factories";

import {
  buildInitialHpmPerformance,
} from "./build-initial-hpm-performance";

describe("buildInitialHpmPerformance", () => {
  it("measures revenue, partially measures risk, and leaves unsupported pillars unavailable", () => {
    const intelligence =
      createRevenueIntelligence({
        opportunities: [
          createOpportunity({
            severity: "high",
            impact: {
              type: "revenue-at-risk",
              estimatedAmount: 500,
              currency: "USD",
              basis: "Cancellation exposure.",
            },
          }),
        ],
      });

    const result =
      buildInitialHpmPerformance({
        intelligence,
      });

    expect(
      result.pillars.revenue.measurementStatus,
    ).toBe("measured");

    expect(
      result.pillars.revenue.score,
    ).toEqual(expect.any(Number));

    expect(
      result.pillars.risk.measurementStatus,
    ).toBe("partial");

    expect(
      result.pillars.investment.score,
    ).toBeNull();

    expect(result.overall.score).toBeNull();

    expect(result.dataCoverage).toEqual({
      measuredPillars: ["revenue"],
      partialPillars: ["risk"],
      unavailablePillars: [
        "investment",
        "financial",
        "operations",
        "guest-experience",
        "growth",
      ],
      measuredPillarCount: 1,
      totalPillarCount: 7,
      coveragePercentage: 21,
    });
  });

  it("reduces the partial risk score when high-severity risks are present", () => {
    const withoutRisk =
      buildInitialHpmPerformance({
        intelligence:
          createRevenueIntelligence(),
      });

    const withRisk =
      buildInitialHpmPerformance({
        intelligence:
          createRevenueIntelligence({
            opportunities: [
              createOpportunity({
                severity: "high",
                impact: {
                  type: "revenue-at-risk",
                  estimatedAmount: 800,
                  currency: "USD",
                  basis: "Test risk.",
                },
              }),
            ],
          }),
      });

    expect(
      withRisk.pillars.risk.score,
    ).toBeLessThan(
      withoutRisk.pillars.risk.score ?? 0,
    );
  });
});

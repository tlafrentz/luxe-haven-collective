import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createOpportunity,
} from "../test-support/factories";

import {
  summarizeOpportunities,
} from "./summarizer";

describe("summarizeOpportunities", () => {
  it("summarizes counts and revenue impact", () => {
    const result =
      summarizeOpportunities([
        createOpportunity({
          id: "pricing",
          category: "pricing",
          severity: "high",
          impact: {
            type: "revenue-increase",
            estimatedAmount: 250.25,
            currency: "USD",
            basis: "Test.",
          },
        }),
        createOpportunity({
          id: "operations",
          category: "operations",
          severity: "medium",
          impact: {
            type: "revenue-at-risk",
            estimatedAmount: 100.1,
            currency: "USD",
            basis: "Test.",
          },
        }),
        createOpportunity({
          id: "occupancy",
          category: "occupancy",
          severity: "low",
          impact: {
            type: "occupancy-increase",
            estimatedPercentage: 20,
            basis: "Test.",
          },
        }),
      ]);

    expect(result).toEqual({
      total: 3,
      highPriority: 1,
      mediumPriority: 1,
      lowPriority: 1,
      estimatedRevenueImpact: 350.35,
      currency: "USD",
      byCategory: {
        pricing: 1,
        occupancy: 1,
        revenue: 0,
        distribution: 0,
        operations: 1,
      },
      bySeverity: {
        high: 1,
        medium: 1,
        low: 1,
      },
    });
  });

  it("does not add non-revenue impacts to the revenue total", () => {
    const result =
      summarizeOpportunities([
        createOpportunity({
          impact: {
            type: "operational-risk",
            estimatedAmount: 500,
            currency: "USD",
            basis: "Test.",
          },
        }),
      ]);

    expect(
      result.estimatedRevenueImpact,
    ).toBe(0);
  });

  it("returns a stable empty summary", () => {
    expect(
      summarizeOpportunities([]),
    ).toEqual({
      total: 0,
      highPriority: 0,
      mediumPriority: 0,
      lowPriority: 0,
      estimatedRevenueImpact: 0,
      currency: "USD",
      byCategory: {
        pricing: 0,
        occupancy: 0,
        revenue: 0,
        distribution: 0,
        operations: 0,
      },
      bySeverity: {
        high: 0,
        medium: 0,
        low: 0,
      },
    });
  });
});

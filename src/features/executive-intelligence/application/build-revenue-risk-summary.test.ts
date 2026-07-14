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
} from "../test-support/factories";

import {
  buildRevenueRiskSummary,
} from "./build-revenue-risk-summary";

describe("buildRevenueRiskSummary", () => {
  it("includes only quantified revenue-at-risk items and sorts by amount", () => {
    const result =
      buildRevenueRiskSummary(
        createRevenueIntelligence({
          opportunities: [
            createOpportunity({
              id: "increase",
              impact: {
                type: "revenue-increase",
                estimatedAmount: 1000,
                currency: "USD",
                basis: "Upside.",
              },
            }),
            createOpportunity({
              id: "small-risk",
              impact: {
                type: "revenue-at-risk",
                estimatedAmount: 200,
                currency: "USD",
                basis: "Small risk.",
              },
            }),
            createOpportunity({
              id: "large-risk",
              impact: {
                type: "revenue-at-risk",
                estimatedAmount: 700,
                currency: "USD",
                basis: "Large risk.",
              },
            }),
          ],
        }),
      );

    expect(result.itemCount).toBe(2);
    expect(result.totalEstimatedAmount).toBe(
      900,
    );
    expect(
      result.items.map((item) => item.id),
    ).toEqual([
      "large-risk",
      "small-risk",
    ]);
  });
});

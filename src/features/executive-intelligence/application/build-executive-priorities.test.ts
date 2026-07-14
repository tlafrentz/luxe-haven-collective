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
  buildExecutivePriorities,
} from "./build-executive-priorities";

describe("buildExecutivePriorities", () => {
  it("filters closed opportunities, ranks open opportunities, and limits the result to five", () => {
    const opportunities = [
      createOpportunity({
        id: "dismissed",
        status: "dismissed",
      }),
      createOpportunity({
        id: "high-value",
        severity: "high",
        confidence: "high",
        impact: {
          type: "revenue-increase",
          estimatedAmount: 900,
          currency: "USD",
          basis: "High-value opportunity.",
        },
      }),
      createOpportunity({
        id: "medium-value",
        severity: "medium",
        confidence: "medium",
        impact: {
          type: "revenue-increase",
          estimatedAmount: 200,
          currency: "USD",
          basis: "Medium-value opportunity.",
        },
      }),
      ...Array.from(
        { length: 5 },
        (_, index) =>
          createOpportunity({
            id: `low-${index}`,
            severity: "low",
            impact: {
              type: "revenue-increase",
              estimatedAmount: index,
              currency: "USD",
              basis: "Low-value opportunity.",
            },
          }),
      ),
    ];

    const result =
      buildExecutivePriorities(
        createRevenueIntelligence({
          opportunities,
        }),
      );

    expect(result).toHaveLength(5);
    expect(result[0].sourceId).toBe(
      "high-value",
    );
    expect(
      result.some(
        (priority) =>
          priority.sourceId === "dismissed",
      ),
    ).toBe(false);

    expect(
      result.map((priority) => priority.rank),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it("maps distribution opportunities to the growth pillar", () => {
    const [result] =
      buildExecutivePriorities(
        createRevenueIntelligence({
          opportunities: [
            createOpportunity({
              category: "distribution",
            }),
          ],
        }),
      );

    expect(result.pillar).toBe("growth");
  });
});

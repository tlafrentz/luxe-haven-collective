import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createOpportunity,
} from "../test-support/factories";

import {
  sortOpportunities,
} from "./sorter";

describe("sortOpportunities", () => {
  it("sorts by severity, confidence, estimated impact, and id", () => {
    const result = sortOpportunities([
      createOpportunity({
        id: "low",
        severity: "low",
        confidence: "high",
        impact: {
          type: "revenue-increase",
          estimatedAmount: 1000,
          currency: "USD",
          basis: "Test.",
        },
      }),
      createOpportunity({
        id: "medium-low-confidence",
        severity: "medium",
        confidence: "low",
      }),
      createOpportunity({
        id: "high-low-impact",
        severity: "high",
        confidence: "high",
        impact: {
          type: "revenue-increase",
          estimatedAmount: 100,
          currency: "USD",
          basis: "Test.",
        },
      }),
      createOpportunity({
        id: "high-high-impact",
        severity: "high",
        confidence: "high",
        impact: {
          type: "revenue-increase",
          estimatedAmount: 500,
          currency: "USD",
          basis: "Test.",
        },
      }),
      createOpportunity({
        id: "medium-high-confidence",
        severity: "medium",
        confidence: "high",
      }),
    ]);

    expect(
      result.map(
        (opportunity) => opportunity.id,
      ),
    ).toEqual([
      "high-high-impact",
      "high-low-impact",
      "medium-high-confidence",
      "medium-low-confidence",
      "low",
    ]);
  });

  it("does not mutate the original array", () => {
    const original = [
      createOpportunity({
        id: "low",
        severity: "low",
      }),
      createOpportunity({
        id: "high",
        severity: "high",
      }),
    ];

    const result =
      sortOpportunities(original);

    expect(
      original.map(
        (opportunity) => opportunity.id,
      ),
    ).toEqual(["low", "high"]);

    expect(
      result.map(
        (opportunity) => opportunity.id,
      ),
    ).toEqual(["high", "low"]);
  });
});

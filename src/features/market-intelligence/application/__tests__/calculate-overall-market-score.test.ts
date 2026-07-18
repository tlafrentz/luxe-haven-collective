import { describe, expect, it } from "vitest";

import { calculateOverallMarketScore } from "../builders/calculate-overall-market-score";
import { createMarketIntelligenceFixtures } from "./test-market-intelligence-fixtures";

describe("calculateOverallMarketScore", () => {
  it("calculates the weighted market score", () => {
    const fixtures = createMarketIntelligenceFixtures();

    const result = calculateOverallMarketScore(fixtures);

    expect(result.value).toBeGreaterThan(75);
    expect(result.value).toBeLessThan(85);
  });

  it("normalizes custom weights", () => {
    const fixtures = createMarketIntelligenceFixtures();

    const result = calculateOverallMarketScore({
      ...fixtures,
      weights: {
        demand: 10,
        property: 0,
        comparables: 0,
        neighborhood: 0,
        supply: 0,
        trends: 0,
        confidence: 0,
      },
    });

    expect(result.value).toBe(88);
  });

  it("rejects invalid custom weights", () => {
    const fixtures = createMarketIntelligenceFixtures();

    expect(() =>
      calculateOverallMarketScore({
        ...fixtures,
        weights: {
          demand: -1,
        },
      }),
    ).toThrow(
      'Overall market score weight "demand" must be a finite, non-negative number.',
    );
  });
});

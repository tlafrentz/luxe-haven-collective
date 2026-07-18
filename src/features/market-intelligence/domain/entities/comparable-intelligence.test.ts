import { describe, expect, it } from "vitest";

import { ConfidenceScore } from "../value-objects/confidence-score";
import { MarketScore } from "../value-objects/market-score";
import { ComparableIntelligence } from "./comparable-intelligence";

describe("ComparableIntelligence", () => {
  it("calculates included evidence and strong-match ratio", () => {
    const result = ComparableIntelligence.create({
      totalComparableCount: 10,
      strongMatchCount: 5,
      moderateMatchCount: 2,
      weakMatchCount: 1,
      excludedMatchCount: 2,
      averageSimilarity: 84,
      medianSimilarity: 86,
      weightedEstimatedValue: 480000,
      medianComparableValue: 475000,
      currency: "USD",
      comparableScore: MarketScore.create(88),
      confidence: new ConfidenceScore(92),
      executiveSummary: "Comparable support is strong.",
    });

    expect(result.includedComparableCount).toBe(8);
    expect(result.strongMatchRatio).toBe(0.625);
    expect(result.hasSufficientComparableEvidence).toBe(true);
  });

  it("rejects classified counts above the total", () => {
    expect(() =>
      ComparableIntelligence.create({
        totalComparableCount: 3,
        strongMatchCount: 3,
        moderateMatchCount: 1,
        weakMatchCount: 0,
        excludedMatchCount: 0,
        averageSimilarity: 80,
        medianSimilarity: 80,
        comparableScore: MarketScore.create(80),
        confidence: new ConfidenceScore(80),
        executiveSummary: "Summary",
      }),
    ).toThrow();
  });
});

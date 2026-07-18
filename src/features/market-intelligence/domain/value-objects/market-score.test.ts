import { describe, expect, it } from "vitest";

import { IntelligenceRating } from "../enums/intelligence-rating";
import { MarketScore } from "./market-score";

describe("MarketScore", () => {
  it("creates a valid score", () => {
    const score = MarketScore.create(82);

    expect(score.value).toBe(82);
    expect(score.toNumber()).toBe(82);
    expect(score.toString()).toBe("82");
  });

  it.each([
    [100, IntelligenceRating.Exceptional],
    [85, IntelligenceRating.Exceptional],
    [84.99, IntelligenceRating.Strong],
    [70, IntelligenceRating.Strong],
    [69.99, IntelligenceRating.Moderate],
    [50, IntelligenceRating.Moderate],
    [49.99, IntelligenceRating.Weak],
    [30, IntelligenceRating.Weak],
    [29.99, IntelligenceRating.Insufficient],
    [0, IntelligenceRating.Insufficient],
  ])("maps %s to %s", (value, expectedRating) => {
    expect(MarketScore.create(value).rating).toBe(expectedRating);
  });

  it.each([-0.01, 100.01, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid score %s",
    (value) => {
      expect(() => MarketScore.create(value)).toThrow();
    },
  );

  it("compares scores by value", () => {
    expect(MarketScore.create(75).equals(MarketScore.create(75))).toBe(true);
    expect(MarketScore.create(75).equals(MarketScore.create(74))).toBe(false);
  });

  it("provides zero and maximum factories", () => {
    expect(MarketScore.zero().value).toBe(0);
    expect(MarketScore.maximum().value).toBe(100);
  });
});

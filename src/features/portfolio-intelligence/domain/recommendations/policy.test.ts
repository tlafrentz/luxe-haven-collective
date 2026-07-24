import { describe, expect, it } from "vitest";
import { Weight } from "@/platform/scoring";
import { PORTFOLIO_RECOMMENDATION_CATEGORIES, PORTFOLIO_RECOMMENDATION_TYPES } from "./contracts";
import { PORTFOLIO_RECOMMENDATION_POLICY_V1, validatePortfolioRecommendationPolicy } from "./policy";

describe("Portfolio recommendation policy", () => {
  it("defines bounded canonical categories, types, rules, and a version", () => {
    expect(PORTFOLIO_RECOMMENDATION_CATEGORIES).toEqual(["acquire", "improve", "preserve", "reduce-risk", "increase-liquidity", "diversify", "hold", "investigate", "monitor"]);
    expect(PORTFOLIO_RECOMMENDATION_TYPES).toContain("collect-missing-data");
    expect(PORTFOLIO_RECOMMENDATION_POLICY_V1.version).toBe("portfolio-recommendations-1");
    expect(() => validatePortfolioRecommendationPolicy(PORTFOLIO_RECOMMENDATION_POLICY_V1)).not.toThrow();
    expect(Object.values(PORTFOLIO_RECOMMENDATION_POLICY_V1.rankingWeights).reduce((sum, weight) => sum + weight.percentage, 0)).toBe(100);
  });

  it("rejects invalid weights, duplicate rules, and unsafe collection bounds", () => {
    expect(() => validatePortfolioRecommendationPolicy({ ...PORTFOLIO_RECOMMENDATION_POLICY_V1, rankingWeights: { ...PORTFOLIO_RECOMMENDATION_POLICY_V1.rankingWeights, priority: Weight.fromPercentage(20) } })).toThrow(/total 100/);
    expect(() => validatePortfolioRecommendationPolicy({ ...PORTFOLIO_RECOMMENDATION_POLICY_V1, rules: [PORTFOLIO_RECOMMENDATION_POLICY_V1.rules[0], PORTFOLIO_RECOMMENDATION_POLICY_V1.rules[0]] })).toThrow(/unique/);
    expect(() => validatePortfolioRecommendationPolicy({ ...PORTFOLIO_RECOMMENDATION_POLICY_V1, maximumRecommendations: 0 })).toThrow(/maximum/);
  });

  it("is immutable at the policy boundary", () => {
    expect(Object.isFrozen(PORTFOLIO_RECOMMENDATION_POLICY_V1)).toBe(true);
    expect(Object.isFrozen(PORTFOLIO_RECOMMENDATION_POLICY_V1.rules)).toBe(true);
    expect(Object.isFrozen(PORTFOLIO_RECOMMENDATION_POLICY_V1.rankingWeights)).toBe(true);
  });
});

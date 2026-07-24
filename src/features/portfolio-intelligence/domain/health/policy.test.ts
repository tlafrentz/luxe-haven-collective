import { describe, expect, it } from "vitest";
import { Weight } from "@/platform/scoring";
import { PORTFOLIO_HEALTH_POLICY_V1, createPortfolioHealthPolicy } from "./policy";

describe("Portfolio health policy", () => {
  it("is versioned, immutable, complete, and totals 100%", () => {
    expect(PORTFOLIO_HEALTH_POLICY_V1.version).toBe("portfolio-health-1");
    expect(Object.isFrozen(PORTFOLIO_HEALTH_POLICY_V1)).toBe(true);
    expect(Object.isFrozen(PORTFOLIO_HEALTH_POLICY_V1.dimensionWeights)).toBe(true);
    expect(Object.values(PORTFOLIO_HEALTH_POLICY_V1.dimensionWeights).reduce((sum, value) => sum + value.percentage, 0)).toBe(100);
  });
  it("rejects missing dimensions and invalid totals", () => {
    expect(() => createPortfolioHealthPolicy({ ...PORTFOLIO_HEALTH_POLICY_V1, dimensionWeights: { ...PORTFOLIO_HEALTH_POLICY_V1.dimensionWeights, performance: Weight.fromPercentage(20) } })).toThrow(/100%/);
    const missing = Object.fromEntries(Object.entries(PORTFOLIO_HEALTH_POLICY_V1.dimensionWeights).filter(([dimension]) => dimension !== "risk"));
    expect(() => createPortfolioHealthPolicy({ ...PORTFOLIO_HEALTH_POLICY_V1, dimensionWeights: missing as typeof PORTFOLIO_HEALTH_POLICY_V1.dimensionWeights })).toThrow(/every canonical dimension/);
  });
  it("rejects unordered bands, invalid freshness, coverage, and collection limits", () => {
    expect(() => createPortfolioHealthPolicy({ ...PORTFOLIO_HEALTH_POLICY_V1, thresholds: { ...PORTFOLIO_HEALTH_POLICY_V1.thresholds, healthy: 60 } })).toThrow(/ordered/);
    expect(() => createPortfolioHealthPolicy({ ...PORTFOLIO_HEALTH_POLICY_V1, freshness: { ...PORTFOLIO_HEALTH_POLICY_V1.freshness, agingDays: 1 } })).toThrow(/freshness/);
    expect(() => createPortfolioHealthPolicy({ ...PORTFOLIO_HEALTH_POLICY_V1, coverage: { ...PORTFOLIO_HEALTH_POLICY_V1.coverage, minimumOverallPercentage: 101 } })).toThrow(/coverage/);
    expect(() => createPortfolioHealthPolicy({ ...PORTFOLIO_HEALTH_POLICY_V1, attentionPriorityLimit: 0 })).toThrow(/limits/);
  });
});

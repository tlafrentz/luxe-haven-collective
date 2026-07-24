import { describe, expect, it } from "vitest";
import { createPortfolioId } from "@/features/portfolio";
import { comparePortfolioRecommendations } from "./comparison";
import { evaluatePortfolioRecommendations } from "./engine";
import { recommendationInput, recommendationObservation } from "./test-fixtures";

describe("Portfolio recommendation comparison", () => {
  it("identifies new, resolved, escalated, downgraded, unchanged, and posture changes", () => {
    const previous = evaluatePortfolioRecommendations(recommendationInput());
    const currentBase = evaluatePortfolioRecommendations(recommendationInput({ observations: [recommendationObservation()] }));
    const common = currentBase.recommendations.find((item) => previous.recommendations.some((prior) => prior.type === item.type && prior.recommendedAction.subject.id === item.recommendedAction.subject.id));
    const current = { ...currentBase, posture: "protect" as const, recommendations: currentBase.recommendations.map((item) => item.id.equals(common!.id) ? { ...item, priority: "critical" as const } : item) };
    const change = comparePortfolioRecommendations(previous, current);
    expect(change.comparable).toBe(true);
    expect(change.newRecommendations.length).toBeGreaterThan(0);
    expect(change.escalatedRecommendations).toContainEqual(common!.id);
    expect(change.postureChange).toEqual({ from: previous.posture, to: "protect" });

    const resolved = comparePortfolioRecommendations(current, previous);
    expect(resolved.resolvedRecommendations.length).toBeGreaterThan(0);
    expect(resolved.downgradedRecommendations.length).toBeGreaterThan(0);
  });

  it("requires compatible portfolio and policy and orders changes deterministically", () => {
    const previous = evaluatePortfolioRecommendations(recommendationInput());
    expect(comparePortfolioRecommendations(previous, { ...previous, portfolioId: createPortfolioId("portfolio-other") })).toMatchObject({ comparable: false, reasonCode: "PORTFOLIO_RECOMMENDATION_COMPARISON_PORTFOLIO_MISMATCH" });
    expect(comparePortfolioRecommendations(previous, { ...previous, recommendationPolicyVersion: "portfolio-recommendations-99" })).toMatchObject({ comparable: false, reasonCode: "PORTFOLIO_RECOMMENDATION_COMPARISON_POLICY_MISMATCH" });
    expect(comparePortfolioRecommendations(previous, previous)).toMatchObject({ comparable: true, newRecommendations: [], resolvedRecommendations: [], escalatedRecommendations: [], downgradedRecommendations: [] });
  });
});

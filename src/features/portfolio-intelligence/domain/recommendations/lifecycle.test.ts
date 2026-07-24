import { describe, expect, it } from "vitest";
import { evaluatePortfolioRecommendations } from "./engine";
import { createRecommendationHistory, transitionRecommendationHistory } from "./lifecycle";
import { recommendationInput } from "./test-fixtures";

describe("Portfolio recommendation lifecycle", () => {
  it("tracks generated, presented, acknowledged, resolved, and historical immutably", () => {
    const recommendation = evaluatePortfolioRecommendations(recommendationInput()).recommendations[0];
    const generated = createRecommendationHistory({ recommendationId: recommendation.id, portfolioId: recommendation.portfolioId, generatedAt: recommendation.generatedAt });
    const presented = transitionRecommendationHistory(generated, { status: "presented", occurredAt: new Date("2026-07-23T14:00:00Z") });
    const acknowledged = transitionRecommendationHistory(presented, { status: "acknowledged", occurredAt: new Date("2026-07-23T15:00:00Z"), actorId: "operator-1" });
    const resolved = transitionRecommendationHistory(acknowledged, { status: "resolved", occurredAt: new Date("2026-07-24T15:00:00Z"), reasonCode: "OPERATOR_CONFIRMED" });
    const historical = transitionRecommendationHistory(resolved, { status: "historical", occurredAt: new Date("2026-07-25T15:00:00Z") });
    expect(generated.currentStatus).toBe("generated");
    expect(historical.events.map((event) => event.status)).toEqual(["generated", "presented", "acknowledged", "resolved", "historical"]);
    expect(Object.isFrozen(historical.events)).toBe(true);
  });

  it("supports dismissed, superseded, and expired terminal paths without allowing invalid or retroactive transitions", () => {
    const recommendation = evaluatePortfolioRecommendations(recommendationInput()).recommendations[0];
    const generated = createRecommendationHistory({ recommendationId: recommendation.id, portfolioId: recommendation.portfolioId, generatedAt: recommendation.generatedAt });
    expect(transitionRecommendationHistory(generated, { status: "expired", occurredAt: new Date("2026-07-24") }).currentStatus).toBe("expired");
    expect(transitionRecommendationHistory(generated, { status: "superseded", occurredAt: new Date("2026-07-24") }).currentStatus).toBe("superseded");
    const presented = transitionRecommendationHistory(generated, { status: "presented", occurredAt: new Date("2026-07-24") });
    expect(transitionRecommendationHistory(presented, { status: "dismissed", occurredAt: new Date("2026-07-25") }).currentStatus).toBe("dismissed");
    expect(() => transitionRecommendationHistory(generated, { status: "resolved", occurredAt: new Date("2026-07-24") })).toThrow(/Cannot transition/);
    expect(() => transitionRecommendationHistory(presented, { status: "acknowledged", occurredAt: new Date("2026-01-01") })).toThrow(/chronological/);
  });
});

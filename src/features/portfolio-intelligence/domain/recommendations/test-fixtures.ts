import { ConfidenceAssessment, ConfidenceScore } from "@/platform/scoring";
import { evaluateCapitalAllocation } from "../allocation";
import { engineInput } from "../allocation/test-fixtures";
import { health } from "../allocation/test-fixtures";
import type { EvaluatePortfolioRecommendationsInput, PortfolioRecommendationObservation } from "./contracts";
import { PORTFOLIO_RECOMMENDATION_POLICY_V1 } from "./policy";

export const recommendationEvaluatedAt = new Date("2026-07-23T13:00:00.000Z");
export const recommendationConfidence = ConfidenceAssessment.create({ score: ConfidenceScore.create(85), rationale: ["Traceable public observation."] });
export function recommendationObservation(override: Partial<PortfolioRecommendationObservation> = {}): PortfolioRecommendationObservation {
  return Object.freeze({
    kind: "executive-observation",
    observationId: "observation-executive-occupancy",
    code: "EXECUTIVE_OCCUPANCY_DECLINING",
    subjectType: "property",
    subjectId: "property-a",
    severity: "high",
    confidence: recommendationConfidence,
    observedAt: new Date("2026-07-22T00:00:00.000Z"),
    sourceVersion: "executive-1",
    ...override,
  });
}
export function recommendationInput(override: Partial<EvaluatePortfolioRecommendationsInput> = {}): EvaluatePortfolioRecommendationsInput {
  const healthAssessment = health();
  return {
    portfolioId: healthAssessment.portfolioId,
    portfolioVersion: healthAssessment.portfolioVersion,
    health: healthAssessment,
    allocation: evaluateCapitalAllocation(engineInput()),
    strategy: Object.freeze({ available: true, defined: true, goals: Object.freeze([{ kind: "scale" as const, referenceId: "strategy-growth", priority: "high" as const }]), version: 2 }),
    observations: Object.freeze([]),
    policy: PORTFOLIO_RECOMMENDATION_POLICY_V1,
    observationWindow: healthAssessment.observationWindow,
    evaluatedAt: recommendationEvaluatedAt,
    ...override,
  };
}

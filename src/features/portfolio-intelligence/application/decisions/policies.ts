import { ConfidenceLevel } from "@/platform/scoring";
import type {
  PortfolioDecisionCandidate, CapitalReturn, DecisionPolicy, ExpectedImpact,
  RecommendationStrength, ResourceRequirement, StrategicAlternative,
} from "./contracts";

export const PORTFOLIO_DECISION_POLICY: DecisionPolicy = Object.freeze({
  version: "portfolio-decision-policy-v1",
  minimumConfidence: ConfidenceLevel.MODERATE,
  recommendationValidityDays: 30,
  staleApprovalBlocked: true,
  ownerOnlyCapitalApproval: true,
  defaultReviewDays: 90,
});

const confidenceRank: Record<ConfidenceLevel, number> = {
  [ConfidenceLevel.VERY_LOW]: 0, [ConfidenceLevel.LOW]: 1,
  [ConfidenceLevel.MODERATE]: 2, [ConfidenceLevel.HIGH]: 3,
  [ConfidenceLevel.VERY_HIGH]: 4,
};

export function calculateCapitalReturn(
  resources: readonly ResourceRequirement[],
  impact: ExpectedImpact,
): CapitalReturn {
  const cash = resources.filter((item) =>
    item.cadence === "one-time" && item.amount && ["cash", "capital-expense"].includes(item.type),
  );
  const revenue = impact.dimensions.find((item) =>
    item.dimension === "revenue" && item.value.type === "range",
  );
  if (cash.length !== 1 || !revenue || revenue.value.type !== "range") {
    return { expectedRoi: null, paybackMonths: null, unavailableReason: "Reliable one-time investment and annual net-benefit ranges are required." };
  }
  const investment = cash[0].amount!.amount;
  if (investment <= 0 || revenue.value.minimum <= 0) {
    return { expectedRoi: null, paybackMonths: null, unavailableReason: "Expected net benefit must be positive and reliable." };
  }
  return {
    expectedRoi: {
      minimum: revenue.value.minimum / investment,
      maximum: revenue.value.maximum / investment,
    },
    paybackMonths: {
      minimum: investment / revenue.value.maximum * 12,
      maximum: investment / revenue.value.minimum * 12,
    },
  };
}

export function evaluateRecommendationStrength(input: Readonly<{
  confidence: ConfidenceLevel; material: boolean; dependenciesReady: boolean;
  fresh: boolean; complete: boolean;
}>): RecommendationStrength {
  if (!input.complete || confidenceRank[input.confidence] < confidenceRank[PORTFOLIO_DECISION_POLICY.minimumConfidence]) return "insufficient-evidence";
  if (!input.fresh) return "monitor";
  if (input.material && input.dependenciesReady && confidenceRank[input.confidence] >= confidenceRank[ConfidenceLevel.HIGH]) return "strong-recommendation";
  if (input.material && input.dependenciesReady) return "recommendation";
  return "consider";
}

export function candidateReady(candidate: PortfolioDecisionCandidate): boolean {
  return candidate.sourceFindingIds.length > 0
    && candidate.expectedImpact.dimensions.length > 0
    && candidate.requestedResources.length > 0
    && candidate.alternatives.some(({ baseline }) => baseline)
    && candidate.alternatives.length >= 2
    && candidate.assumptions.length > 0
    && candidate.dependencies.length > 0
    && candidate.recommendationStrength !== "insufficient-evidence";
}

export function alternativesComplete(alternatives: readonly StrategicAlternative[]): boolean {
  return alternatives.length >= 2
    && alternatives.some(({ baseline }) => baseline)
    && alternatives.every((item) => item.expectedImpact.dimensions.length > 0 && item.tradeoffs.length > 0);
}

export function canApprovePortfolioDecision(role: string, candidate: PortfolioDecisionCandidate): boolean {
  if (role !== "owner") return false;
  return candidate.status === "ready-for-review" || candidate.status === "under-review";
}

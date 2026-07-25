import { ConfidenceLevel } from "@/platform/scoring";
import type {
  ConfidenceAdjustment, KnowledgeMaturity, PortfolioOutcomePolicy,
  PortfolioOutcomeSuccess,
} from "./contracts";

export const PORTFOLIO_OUTCOME_POLICY: PortfolioOutcomePolicy = Object.freeze({
  version: "portfolio-outcome-policy-v1", minimumElapsedDays: 30,
  minimumEvidenceReferences: 1, supportedKnowledgeReviews: 3,
  establishedKnowledgeReviews: 7, wellValidatedKnowledgeReviews: 15,
});

export function knowledgeMaturity(reviewCount: number, contradictory = false): KnowledgeMaturity {
  if (contradictory || reviewCount < PORTFOLIO_OUTCOME_POLICY.supportedKnowledgeReviews) return "emerging";
  if (reviewCount < PORTFOLIO_OUTCOME_POLICY.establishedKnowledgeReviews) return "supported";
  if (reviewCount < PORTFOLIO_OUTCOME_POLICY.wellValidatedKnowledgeReviews) return "established";
  return "well-validated";
}
export function confidenceAdjustment(success: PortfolioOutcomeSuccess): ConfidenceAdjustment {
  return success === "exceeded-expectations" || success === "met-expectations" ? "increase"
    : success === "did-not-meet" ? "reduce" : "maintain";
}
export function calibration(successful: number, reviewed: number): ConfidenceAdjustment {
  if (!reviewed) return "maintain";
  const rate = successful / reviewed;
  return rate >= 0.75 ? "increase" : rate < 0.4 ? "reduce" : "maintain";
}
export function confidenceForReviews(reviewed: number): ConfidenceLevel {
  return reviewed >= 10 ? ConfidenceLevel.HIGH : reviewed >= 3 ? ConfidenceLevel.MODERATE : ConfidenceLevel.LOW;
}


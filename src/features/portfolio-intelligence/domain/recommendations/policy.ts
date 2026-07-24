import { Weight } from "@/platform/scoring";
import type {
  PortfolioRecommendationCategory,
  PortfolioRecommendationPolicyVersion,
  PortfolioRecommendationPriority,
} from "./contracts";

export type PortfolioRecommendationRuleCode =
  | "RECOMMEND_RESOLVE_CRITICAL_RISK"
  | "RECOMMEND_RESOLVE_CAPITAL_SHORTFALL"
  | "RECOMMEND_INCREASE_RESERVE"
  | "RECOMMEND_ADDRESS_MARKET_CONCENTRATION"
  | "RECOMMEND_REDUCE_REVENUE_DEPENDENCE"
  | "RECOMMEND_COLLECT_MISSING_DATA"
  | "RECOMMEND_REEVALUATE_STRATEGY"
  | "RECOMMEND_PRIMARY_ALLOCATION"
  | "RECOMMEND_PRESERVE_CAPITAL"
  | "RECOMMEND_MONITOR";
export type PortfolioRecommendationRule = Readonly<{
  code: PortfolioRecommendationRuleCode;
  priority: PortfolioRecommendationPriority;
  category: PortfolioRecommendationCategory;
}>;
export type PortfolioRecommendationPolicy = Readonly<{
  version: PortfolioRecommendationPolicyVersion;
  rules: readonly PortfolioRecommendationRule[];
  rankingWeights: Readonly<{
    priority: Weight;
    confidence: Weight;
    healthImpact: Weight;
    capitalImpact: Weight;
    riskReduction: Weight;
    urgency: Weight;
  }>;
  maximumRecommendations: number;
  maximumEvidencePerRecommendation: number;
  maximumConflicts: number;
  staleObservationDays: number;
}>;

export const PORTFOLIO_RECOMMENDATION_POLICY_V1: PortfolioRecommendationPolicy = Object.freeze({
  version: "portfolio-recommendations-1",
  rules: Object.freeze([
    Object.freeze({ code: "RECOMMEND_RESOLVE_CRITICAL_RISK", priority: "critical", category: "reduce-risk" }),
    Object.freeze({ code: "RECOMMEND_RESOLVE_CAPITAL_SHORTFALL", priority: "critical", category: "increase-liquidity" }),
    Object.freeze({ code: "RECOMMEND_INCREASE_RESERVE", priority: "high", category: "increase-liquidity" }),
    Object.freeze({ code: "RECOMMEND_ADDRESS_MARKET_CONCENTRATION", priority: "high", category: "diversify" }),
    Object.freeze({ code: "RECOMMEND_REDUCE_REVENUE_DEPENDENCE", priority: "high", category: "diversify" }),
    Object.freeze({ code: "RECOMMEND_COLLECT_MISSING_DATA", priority: "high", category: "investigate" }),
    Object.freeze({ code: "RECOMMEND_REEVALUATE_STRATEGY", priority: "medium", category: "investigate" }),
    Object.freeze({ code: "RECOMMEND_PRIMARY_ALLOCATION", priority: "medium", category: "improve" }),
    Object.freeze({ code: "RECOMMEND_PRESERVE_CAPITAL", priority: "high", category: "preserve" }),
    Object.freeze({ code: "RECOMMEND_MONITOR", priority: "informational", category: "monitor" }),
  ]),
  rankingWeights: Object.freeze({
    priority: Weight.fromPercentage(30),
    confidence: Weight.fromPercentage(15),
    healthImpact: Weight.fromPercentage(20),
    capitalImpact: Weight.fromPercentage(15),
    riskReduction: Weight.fromPercentage(15),
    urgency: Weight.fromPercentage(5),
  }),
  maximumRecommendations: 12,
  maximumEvidencePerRecommendation: 12,
  maximumConflicts: 12,
  staleObservationDays: 45,
});

export function validatePortfolioRecommendationPolicy(policy: PortfolioRecommendationPolicy): void {
  if (!policy.version || policy.rules.length === 0) throw new TypeError("Recommendation policy requires a version and rules.");
  const total = Object.values(policy.rankingWeights).reduce((sum, weight) => sum + weight.percentage, 0);
  if (Math.abs(total - 100) > 0.0001) throw new RangeError("Recommendation ranking weights must total 100.");
  if (!Number.isInteger(policy.maximumRecommendations) || policy.maximumRecommendations < 1 || policy.maximumRecommendations > 50) throw new RangeError("Recommendation maximum must be between 1 and 50.");
  if (new Set(policy.rules.map((rule) => rule.code)).size !== policy.rules.length) throw new TypeError("Recommendation rule codes must be unique.");
}

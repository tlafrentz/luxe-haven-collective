import type { PortfolioRecommendationAssessment, PortfolioRecommendationChange, PortfolioRecommendationPriority } from "./contracts";

export function comparePortfolioRecommendations(previous: PortfolioRecommendationAssessment, current: PortfolioRecommendationAssessment): PortfolioRecommendationChange {
  if (!previous.portfolioId.equals(current.portfolioId)) return notComparable(current, "PORTFOLIO_RECOMMENDATION_COMPARISON_PORTFOLIO_MISMATCH");
  if (previous.recommendationPolicyVersion !== current.recommendationPolicyVersion) return notComparable(current, "PORTFOLIO_RECOMMENDATION_COMPARISON_POLICY_MISMATCH");
  const prior = new Map(previous.recommendations.map((item) => [identity(item), item]));
  const next = new Map(current.recommendations.map((item) => [identity(item), item]));
  const common = [...prior.keys()].filter((key) => next.has(key)).sort();
  const escalated = common.filter((key) => priorityRank(next.get(key)!.priority) < priorityRank(prior.get(key)!.priority)).map((key) => next.get(key)!.id);
  const downgraded = common.filter((key) => priorityRank(next.get(key)!.priority) > priorityRank(prior.get(key)!.priority)).map((key) => next.get(key)!.id);
  const unchanged = common.filter((key) => next.get(key)!.priority === prior.get(key)!.priority).map((key) => next.get(key)!.id);
  return Object.freeze({
    portfolioId: current.portfolioId,
    comparable: true,
    newRecommendations: Object.freeze([...next.keys()].filter((key) => !prior.has(key)).sort().map((key) => next.get(key)!.id)),
    resolvedRecommendations: Object.freeze([...prior.keys()].filter((key) => !next.has(key)).sort().map((key) => prior.get(key)!.id)),
    escalatedRecommendations: Object.freeze(escalated),
    downgradedRecommendations: Object.freeze(downgraded),
    unchangedRecommendations: Object.freeze(unchanged),
    ...(previous.posture !== current.posture ? { postureChange: Object.freeze({ from: previous.posture, to: current.posture }) } : {}),
  });
}
function identity(item: PortfolioRecommendationAssessment["recommendations"][number]) { return `${item.type}:${item.recommendedAction.subject.type}:${item.recommendedAction.subject.id}`; }
function priorityRank(value: PortfolioRecommendationPriority) { return ({ critical: 0, high: 1, medium: 2, low: 3, informational: 4 } as const)[value]; }
function notComparable(current: PortfolioRecommendationAssessment, reasonCode: string): PortfolioRecommendationChange {
  return Object.freeze({ portfolioId: current.portfolioId, comparable: false, newRecommendations: Object.freeze([]), resolvedRecommendations: Object.freeze([]), escalatedRecommendations: Object.freeze([]), downgradedRecommendations: Object.freeze([]), unchangedRecommendations: Object.freeze([]), reasonCode });
}

export enum RecommendationPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export const RECOMMENDATION_PRIORITY_RANK: Readonly<
  Record<RecommendationPriority, number>
> = Object.freeze({
  [RecommendationPriority.LOW]: 0,
  [RecommendationPriority.MEDIUM]: 1,
  [RecommendationPriority.HIGH]: 2,
  [RecommendationPriority.CRITICAL]: 3,
});

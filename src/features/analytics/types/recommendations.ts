export type RecommendationPriority =
  | "high"
  | "medium"
  | "low";

export type RecommendationCategory =
  | "pricing"
  | "occupancy"
  | "revenue"
  | "payments"
  | "operations";

export type RecommendationConfidence =
  | "high"
  | "medium"
  | "low";

export type RecommendationEvidence = {
  label: string;
  value: string;
};

export type AnalyticsRecommendation = {
  id: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  confidence: RecommendationConfidence;
  title: string;
  description: string;
  suggestedAction: string;
  expectedImpact?: string;
  evidence: RecommendationEvidence[];
};

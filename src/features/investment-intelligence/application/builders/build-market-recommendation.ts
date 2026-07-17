import type { IntelligenceRecommendation } from "@/features/intelligence/domain";

export function buildMarketRecommendation(): IntelligenceRecommendation {
  return {
    headline: "",
    summary: "",
    recommendedActions: [],
    risks: [],
    opportunities: [],
  };
}

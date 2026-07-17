import type { IntelligenceAnalysis, IntelligenceHealth, IntelligenceRecommendation } from "../domain";
export interface RecommendationBuilder<TAnalysis extends IntelligenceAnalysis>{
  build(
    analyses: readonly TAnalysis[],
    health: IntelligenceHealth,
  ): IntelligenceRecommendation;
}

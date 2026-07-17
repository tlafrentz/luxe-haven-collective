export interface IntelligenceRecommendation {
  readonly headline: string;
  readonly summary: string;
  readonly recommendedActions: readonly string[];
  readonly risks: readonly string[];
  readonly opportunities: readonly string[];
}

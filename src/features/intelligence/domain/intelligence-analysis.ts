export interface IntelligenceAnalysis {
  readonly score: number;
  readonly confidence: number;
  readonly summary: string;
  readonly strengths: readonly string[];
  readonly risks: readonly string[];
  readonly opportunities: readonly string[];
}

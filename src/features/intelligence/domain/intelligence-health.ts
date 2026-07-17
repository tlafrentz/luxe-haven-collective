export interface IntelligenceHealth {
  readonly overallScore: number;
  readonly status: "excellent"|"good"|"fair"|"poor";
  readonly summary: string;
}

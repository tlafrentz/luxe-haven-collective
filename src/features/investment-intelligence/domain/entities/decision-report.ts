export type DecisionReportStrategy =
  | "purchase"
  | "rental-arbitrage";

export type DecisionReportRecommendation =
  | "strong-buy"
  | "buy"
  | "buy-with-conditions"
  | "wait"
  | "pass";

export type DecisionReportConfidenceLevel =
  | "very-high"
  | "high"
  | "medium"
  | "low"
  | "very-low";

export type DecisionReportRiskSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low";

export interface DecisionReportThesis {
  readonly headline: string;
  readonly summary: string;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
}

export interface DecisionReportEvidence {
  readonly id: string;
  readonly category: string;
  readonly label: string;
  readonly finding: string;
  readonly value?: string;
  readonly direction: "positive" | "caution";
}

export interface DecisionReportRisk {
  readonly id: string;
  readonly title: string;
  readonly severity: DecisionReportRiskSeverity;
  readonly finding: string;
  readonly impact: string;
  readonly mitigation: string;
}

export interface DecisionReportOpportunity {
  readonly id: string;
  readonly title: string;
  readonly finding: string;
  readonly expectedUpside: string;
  readonly nextAction: string;
}

export interface DecisionReportConfidenceFactor {
  readonly label: string;
  readonly score: number;
  readonly weight: number;
  readonly explanation: string;
}

export interface DecisionReportConfidence {
  readonly score: number;
  readonly level: DecisionReportConfidenceLevel;
  readonly explanation: string;
  readonly factors: readonly DecisionReportConfidenceFactor[];
}

export interface DecisionReportRecommendationSummary {
  readonly value: DecisionReportRecommendation;
  readonly headline: string;
  readonly rationale: string;
  readonly conditions: readonly string[];
  readonly nextActions: readonly string[];
}

export interface DecisionReport {
  readonly strategy: DecisionReportStrategy;
  readonly thesis: DecisionReportThesis;
  readonly evidence: readonly DecisionReportEvidence[];
  readonly risks: readonly DecisionReportRisk[];
  readonly opportunities: readonly DecisionReportOpportunity[];
  readonly confidence: DecisionReportConfidence;
  readonly recommendation: DecisionReportRecommendationSummary;
}

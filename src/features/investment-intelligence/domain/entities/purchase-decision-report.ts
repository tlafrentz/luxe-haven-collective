import type {
  PurchaseFailurePoints,
  PurchaseScenario,
} from "./index";

export type PurchaseDecisionRecommendation =
  | "strong-buy"
  | "buy"
  | "buy-with-conditions"
  | "wait"
  | "pass";

export type PurchaseDecisionSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low";

export type PurchaseDecisionEvidenceCategory =
  | "financial"
  | "resilience"
  | "revenue"
  | "cost"
  | "financing";

export interface PurchaseInvestmentThesis {
  readonly headline: string;
  readonly summary: string;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
}

export interface PurchaseDecisionEvidence {
  readonly category:
    PurchaseDecisionEvidenceCategory;
  readonly label: string;
  readonly finding: string;
  readonly value?: string;
  readonly positive: boolean;
}

export interface PurchaseDecisionRisk {
  readonly code: string;
  readonly title: string;
  readonly severity:
    PurchaseDecisionSeverity;
  readonly finding: string;
  readonly impact: string;
  readonly mitigation: string;
}

export interface PurchaseDecisionOpportunity {
  readonly code: string;
  readonly title: string;
  readonly finding: string;
  readonly expectedUpside: string;
  readonly nextAction: string;
}

export interface PurchaseConfidenceFactor {
  readonly label: string;
  readonly score: number;
  readonly weight: number;
  readonly explanation: string;
}

export interface PurchaseConfidenceAnalysis {
  readonly score: number;
  readonly level:
    | "very-high"
    | "high"
    | "medium"
    | "low"
    | "very-low";
  readonly factors:
    readonly PurchaseConfidenceFactor[];
  readonly explanation: string;
}

export interface PurchaseInvestmentRecommendation {
  readonly recommendation:
    PurchaseDecisionRecommendation;
  readonly headline: string;
  readonly rationale: string;
  readonly conditions: readonly string[];
  readonly nextActions: readonly string[];
}

export interface PurchaseDecisionReport {
  readonly thesis: PurchaseInvestmentThesis;
  readonly evidence:
    readonly PurchaseDecisionEvidence[];
  readonly risks:
    readonly PurchaseDecisionRisk[];
  readonly opportunities:
    readonly PurchaseDecisionOpportunity[];
  readonly confidence:
    PurchaseConfidenceAnalysis;
  readonly recommendation:
    PurchaseInvestmentRecommendation;
  readonly scenarios:
    readonly PurchaseScenario[];
  readonly failurePoints:
    PurchaseFailurePoints;
}

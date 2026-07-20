import type { ActionCollection } from "@/platform/actions";
import type { ClaimCollection } from "@/platform/claims";
import type { Decision } from "@/platform/decisions";
import type { EvaluationCollection } from "@/platform/evaluations";
import type { EvidenceCollection } from "@/platform/evidence";
import type { IntelligenceReport } from "@/platform/intelligence";
import type { ObservationCollection } from "@/platform/observations";
import type { Outcome } from "@/platform/outcomes";
import type { Recommendation, RecommendationCollection } from "@/platform/recommendations";
import type { Score } from "@/platform/scoring";

import type { InvestmentDecision } from "./investment-decision";
import type { RentalArbitrageInvestmentAnalysis } from "./rental-arbitrage-investment-analysis";

export type InvestmentPlatformScores = Readonly<{
  overall: Score;
  revenuePotential: Score;
  financialStrength: Score;
  marketStrength: Score;
  competitivePosition: Score;
  riskExposure: Score;
}>;

/** Canonical reasoning output. The legacy InvestmentDecision remains a read projection. */
export type InvestmentPlatformAnalysis = Readonly<{
  observations: ObservationCollection;
  evidence: EvidenceCollection;
  claims: ClaimCollection;
  evaluations: EvaluationCollection;
  recommendations: RecommendationCollection;
  scores: InvestmentPlatformScores;
}>;

export type InvestmentCommitmentOutcome = "accepted" | "rejected" | "deferred";

export type InvestmentCommitment = Readonly<{
  recommendation: Recommendation;
  decision: Decision<InvestmentCommitmentOutcome>;
  actions: ActionCollection;
}>;

export type InvestmentMeasuredResult = Readonly<{
  outcome: Outcome;
  intelligence: IntelligenceReport;
}>;

/** Single boundary consumed by the Investment Workspace during migration. */
export type InvestmentWorkspaceView = Readonly<{
  projection: InvestmentDecision | RentalArbitrageInvestmentAnalysis;
  /** Rental-arbitrage remains a documented compatibility projection in PM-004. */
  platform?: InvestmentPlatformAnalysis;
}>;

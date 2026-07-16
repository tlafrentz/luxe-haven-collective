import {
  AcquisitionRecommendation,
  ConfidenceLevel,
} from "./enums";

import type {
  ComparableAnalysis,
  ExpenseProjection,
  FinancialPerformance,
  InvestmentAssumptions,
  InvestmentRisk,
  InvestmentScore,
  MarketSnapshot,
  PropertyProfile,
  RevenueProjection,
  SupportingEvidence,
} from "./entities";

export interface InvestmentDecision {
  readonly property: PropertyProfile;
  readonly market: MarketSnapshot;
  readonly assumptions: InvestmentAssumptions;

  readonly revenueProjection: RevenueProjection;
  readonly expenseProjection: ExpenseProjection;
  readonly financialPerformance: FinancialPerformance;

  readonly comparableAnalysis: ComparableAnalysis;

  readonly risks: readonly InvestmentRisk[];
  readonly supportingEvidence: readonly SupportingEvidence[];

  readonly score: InvestmentScore;

  readonly recommendation: AcquisitionRecommendation;
  readonly confidence: ConfidenceLevel;
}

import type {
  AcquisitionStrategy,
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

import type {
  AcquisitionRecommendation,
  AcquisitionType,
  ConfidenceLevel,
} from "./enums";

export interface InvestmentDecision {
  readonly acquisitionType: AcquisitionType;

  readonly property: PropertyProfile;
  readonly market: MarketSnapshot;
  readonly assumptions: InvestmentAssumptions;

  readonly revenueProjection: RevenueProjection;
  readonly expenseProjection: ExpenseProjection;
  readonly financialPerformance: FinancialPerformance;
  readonly comparableAnalysis: ComparableAnalysis;

  readonly score: InvestmentScore;

  readonly risks: readonly InvestmentRisk[];
  readonly supportingEvidence:
    readonly SupportingEvidence[];

  readonly recommendation:
    AcquisitionRecommendation;
  readonly confidence: ConfidenceLevel;

  readonly strategy: AcquisitionStrategy;
}

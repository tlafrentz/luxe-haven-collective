import type {
  ComparableAnalysis,
  InvestmentRisk,
  InvestmentScore,
  MarketSnapshot,
  RevenueProjection,
  SupportingEvidence,
} from "./entities";

import type {
  AcquisitionRecommendation,
  AcquisitionType,
  ConfidenceLevel,
} from "./enums";

/**
 * Shared explainable-analysis contract for every acquisition strategy.
 *
 * Strategy-specific models supply their own:
 * - acquisition type
 * - property contract
 * - assumptions
 * - expense projection
 * - financial performance
 */
export interface InvestmentAnalysisBase<
  TAcquisitionType extends AcquisitionType,
  TProperty,
  TAssumptions,
  TExpenseProjection,
  TFinancialPerformance,
> {
  readonly acquisitionType: TAcquisitionType;

  readonly property: TProperty;
  readonly market: MarketSnapshot;
  readonly assumptions: TAssumptions;

  readonly revenueProjection: RevenueProjection;
  readonly expenseProjection: TExpenseProjection;
  readonly financialPerformance: TFinancialPerformance;
  readonly comparableAnalysis: ComparableAnalysis;

  readonly score: InvestmentScore;

  readonly risks: readonly InvestmentRisk[];
  readonly supportingEvidence:
    readonly SupportingEvidence[];

  readonly recommendation:
    AcquisitionRecommendation;
  readonly confidence: ConfidenceLevel;
}

import type {
  AcquisitionType,
  ComparableAnalysis,
  ExpenseProjection,
  FinancialPerformance,
  InvestmentAssumptions,
  InvestmentDecision,
  MarketSnapshot,
  PropertyProfile,
  RevenueProjection,
} from "../domain";

import {
  assessInvestmentRisks,
} from "./assess-investment-risks";

import {
  buildAcquisitionStrategy,
} from "./build-acquisition-strategy";

import {
  buildSupportingEvidence,
} from "./build-supporting-evidence";

import {
  calculateInvestmentScore,
} from "./calculate-investment-score";

import {
  determineAcquisitionRecommendation,
} from "./determine-acquisition-recommendation";

import type {
  InvestmentDecisionPolicies,
} from "./investment-decision-policies";

export type BuildInvestmentDecisionInput<
  TAcquisitionType extends AcquisitionType =
    AcquisitionType,
> = {
  readonly acquisitionType:
    TAcquisitionType;

  readonly property: PropertyProfile;
  readonly market: MarketSnapshot;
  readonly assumptions: InvestmentAssumptions;

  readonly revenueProjection: RevenueProjection;
  readonly expenseProjection: ExpenseProjection;
  readonly financialPerformance: FinancialPerformance;
  readonly comparableAnalysis: ComparableAnalysis;

  readonly policies?: InvestmentDecisionPolicies;
};

export function buildInvestmentDecision<
  TAcquisitionType extends AcquisitionType,
>({
  acquisitionType,
  property,
  market,
  assumptions,
  revenueProjection,
  expenseProjection,
  financialPerformance,
  comparableAnalysis,
  policies,
}: BuildInvestmentDecisionInput<TAcquisitionType>):
  InvestmentDecision & {
    readonly acquisitionType:
      TAcquisitionType;
  } {
  const riskAssessment =
    assessInvestmentRisks({
      revenueProjection,
      financialPerformance,
      comparableAnalysis,
      market,
      policy: policies?.risk,
    });

  const score =
    calculateInvestmentScore({
      revenueProjection,
      financialPerformance,
      comparableAnalysis,
      riskExposure:
        riskAssessment.riskExposure,
      policy: policies?.scoring,
    });

  const supportingEvidence =
    buildSupportingEvidence({
      revenueProjection,
      financialPerformance,
      comparableAnalysis,
      market,
      risks: riskAssessment.risks,
      policy: policies?.evidence,
    });

  const decision =
    determineAcquisitionRecommendation({
      score,
      risks: riskAssessment.risks,
      supportingEvidence,
      revenueConfidence:
        revenueProjection.confidence,
      comparableConfidence:
        comparableAnalysis.confidence,
      policy:
        policies?.recommendation,
    });

  const strategy =
    buildAcquisitionStrategy({
      property,
      assumptions,
      revenueProjection,
      expenseProjection,
      financialPerformance,
      score,
      recommendation:
        decision.recommendation,
      risks: riskAssessment.risks,
      supportingEvidence,
    });

  return {
    acquisitionType,
    property,
    market,
    assumptions,
    revenueProjection,
    expenseProjection,
    financialPerformance,
    comparableAnalysis,
    risks: riskAssessment.risks,
    supportingEvidence,
    score,
    recommendation:
      decision.recommendation,
    confidence:
      decision.confidence,
    strategy,
  };
}

import type {
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

export type BuildInvestmentDecisionInput = {
  readonly property: PropertyProfile;
  readonly market: MarketSnapshot;
  readonly assumptions: InvestmentAssumptions;

  readonly revenueProjection: RevenueProjection;
  readonly expenseProjection: ExpenseProjection;
  readonly financialPerformance: FinancialPerformance;
  readonly comparableAnalysis: ComparableAnalysis;

  readonly policies?: InvestmentDecisionPolicies;
};

export function buildInvestmentDecision({
  property,
  market,
  assumptions,
  revenueProjection,
  expenseProjection,
  financialPerformance,
  comparableAnalysis,
  policies,
}: BuildInvestmentDecisionInput): InvestmentDecision {
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

  return {
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
  };
}

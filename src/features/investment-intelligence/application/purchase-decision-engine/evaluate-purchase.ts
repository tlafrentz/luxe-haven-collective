import {
  AcquisitionRecommendation,
  ConfidenceLevel,
  EvidenceDirection,
  EvidenceType,
} from "../../domain";

import type {
  PurchaseConfidenceAnalysis,
  PurchaseDecisionEvidence,
  PurchaseDecisionReport,
  PurchaseDecisionRisk,
  PurchaseInvestmentLifecycleResult,
  PurchaseInvestmentRecommendation,
} from "../../domain";

import {
  buildPurchaseDecisionOpportunities,
} from "./builders/build-purchase-decision-opportunities";
import {
  buildPurchaseInvestmentThesis,
} from "./builders/build-purchase-investment-thesis";

export function evaluatePurchase(
  result: PurchaseInvestmentLifecycleResult,
): PurchaseDecisionReport {
  const { analysis, derivedAnalysis } =
    result;
  const { scenarios, failurePoints } =
    derivedAnalysis;

  const evidence =
    projectEvidence(result);

  const risks = projectRisks(result);

  const opportunities =
    buildPurchaseDecisionOpportunities({
      analysis,
      scenarios,
      failurePoints,
    });

  const confidence =
    projectConfidence(result);

  const thesis =
    buildPurchaseInvestmentThesis({
      analysis,
      evidence,
      risks,
    });

  const recommendation =
    projectRecommendation(result);

  return {
    thesis,
    evidence,
    risks,
    opportunities,
    confidence,
    recommendation,
    scenarios,
    failurePoints,
  };
}

function projectEvidence(
  result: PurchaseInvestmentLifecycleResult,
): readonly PurchaseDecisionEvidence[] {
  return result.analysis.supportingEvidence.map(
    (evidence) => ({
      category:
        evidenceCategory(evidence.type),
      label: evidence.title,
      finding: evidence.description,
      positive:
        evidence.direction ===
        EvidenceDirection.Positive,
    }),
  );
}

function evidenceCategory(
  type: EvidenceType,
): PurchaseDecisionEvidence["category"] {
  switch (type) {
    case EvidenceType.FinancialModel:
      return "financial";

    case EvidenceType.ExpenseProjection:
      return "cost";

    case EvidenceType.RevenueProjection:
    case EvidenceType.Comparable:
    case EvidenceType.HistoricalPerformance:
    case EvidenceType.MarketTrend:
    case EvidenceType.Regulatory:
    case EvidenceType.Seasonality:
      return "revenue";
  }
}

function projectRisks(
  result: PurchaseInvestmentLifecycleResult,
): readonly PurchaseDecisionRisk[] {
  return result.analysis.risks.map(
    (risk) => ({
      code: risk.id,
      title: risk.title,
      severity: risk.severity,
      finding: risk.description,
      impact: risk.estimatedFinancialImpact
        ? `Estimated financial impact: ${formatCurrency(
            risk.estimatedFinancialImpact
              .amount,
          )}.`
        : risk.description,
      mitigation:
        risk.mitigation ??
        "Validate this risk before acquisition.",
    }),
  );
}

function projectConfidence(
  result: PurchaseInvestmentLifecycleResult,
): PurchaseConfidenceAnalysis {
  const score = confidenceScore(
    result.analysis.confidence,
  );

  return {
    score,
    level:
      result.analysis.confidence ===
      ConfidenceLevel.Moderate
        ? "medium"
        : result.analysis.confidence,
    explanation:
      `Projected from the canonical ${result.analysis.confidence} purchase decision confidence.`,
    factors: [
      {
        label: "Canonical decision confidence",
        score,
        weight: 100,
        explanation:
          "The purchase report presents the confidence established by the canonical decision policy.",
      },
    ],
  };
}

function confidenceScore(
  confidence: ConfidenceLevel,
): number {
  switch (confidence) {
    case ConfidenceLevel.VeryHigh:
      return 95;
    case ConfidenceLevel.High:
      return 80;
    case ConfidenceLevel.Moderate:
      return 60;
    case ConfidenceLevel.Low:
      return 40;
    case ConfidenceLevel.VeryLow:
      return 20;
  }
}

function projectRecommendation(
  result: PurchaseInvestmentLifecycleResult,
): PurchaseInvestmentRecommendation {
  const { analysis } = result;

  return {
    recommendation:
      analysis.recommendation,
    headline:
      recommendationHeadline(
        analysis.recommendation,
      ),
    rationale:
      `The canonical purchase policy produced ${analysis.recommendation} with an overall score of ${analysis.score.overall.value}/100 and ${analysis.confidence} confidence.`,
    conditions: analysis.risks
      .filter(
        ({ severity }) =>
          severity === "critical" ||
          severity === "high",
      )
      .map(
        ({ mitigation, title }) =>
          mitigation ??
          `Resolve ${title.toLowerCase()} before acquisition.`,
      ),
    nextActions:
      analysis.strategy
        .firstNinetyDayPriorities,
  };
}

function recommendationHeadline(
  recommendation:
    AcquisitionRecommendation,
): string {
  switch (recommendation) {
    case AcquisitionRecommendation.StrongBuy:
      return "Acquire within the modeled price discipline";
    case AcquisitionRecommendation.Buy:
      return "The acquisition is supportable at the modeled terms";
    case AcquisitionRecommendation.BuyWithConditions:
      return "Proceed only after resolving the identified conditions";
    case AcquisitionRecommendation.Wait:
      return "Do not advance until the economics improve";
    case AcquisitionRecommendation.Pass:
      return "The current acquisition should not proceed";
  }
}

function formatCurrency(
  amount: number,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    },
  ).format(amount);
}

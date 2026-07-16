import {
  AcquisitionRecommendation,
  ConfidenceLevel,
  EvidenceDirection,
  RiskSeverity,
} from "../domain";

import type {
  InvestmentRisk,
  InvestmentScore,
  Percentage,
  SupportingEvidence,
} from "../domain";

import {
  DEFAULT_ACQUISITION_RECOMMENDATION_POLICY,
} from "./acquisition-recommendation-policy";

import type {
  AcquisitionRecommendationPolicy,
} from "./acquisition-recommendation-policy";

import {
  calculateDecisionConfidence,
} from "./calculate-decision-confidence";

export type DetermineAcquisitionRecommendationInput = {
  readonly score: InvestmentScore;
  readonly risks: readonly InvestmentRisk[];
  readonly supportingEvidence: readonly SupportingEvidence[];
  readonly revenueConfidence: Percentage;
  readonly comparableConfidence: ConfidenceLevel;
  readonly policy?: AcquisitionRecommendationPolicy;
};

export type DetermineAcquisitionRecommendationResult = {
  readonly recommendation: AcquisitionRecommendation;
  readonly confidence: ConfidenceLevel;
};

function hasRiskSeverity(
  risks: readonly InvestmentRisk[],
  severity: RiskSeverity,
): boolean {
  return risks.some(
    (risk) => risk.severity === severity,
  );
}

function countPositiveEvidence(
  evidence: readonly SupportingEvidence[],
): number {
  return evidence.filter(
    ({ direction }) =>
      direction === EvidenceDirection.Positive,
  ).length;
}

function isLowConfidence(
  confidence: ConfidenceLevel,
): boolean {
  return (
    confidence === ConfidenceLevel.Low ||
    confidence === ConfidenceLevel.VeryLow
  );
}

export function determineAcquisitionRecommendation({
  score,
  risks,
  supportingEvidence,
  revenueConfidence,
  comparableConfidence,
  policy = DEFAULT_ACQUISITION_RECOMMENDATION_POLICY,
}: DetermineAcquisitionRecommendationInput): DetermineAcquisitionRecommendationResult {
  if (
    !Number.isFinite(score.overall.value) ||
    score.overall.value < 0 ||
    score.overall.value > score.overall.max
  ) {
    throw new Error(
      "Overall investment score must be between 0 and 100.",
    );
  }

  if (
    !Number.isFinite(
      score.riskExposure.value,
    ) ||
    score.riskExposure.value < 0 ||
    score.riskExposure.value >
      score.riskExposure.max
  ) {
    throw new Error(
      "Risk exposure must be between 0 and 100.",
    );
  }

  const confidence =
    calculateDecisionConfidence({
      revenueConfidence,
      comparableConfidence,
      supportingEvidence,
    });

  const overallScore =
    score.overall.value;

  const riskExposure =
    score.riskExposure.value;

  const positiveEvidenceCount =
    countPositiveEvidence(
      supportingEvidence,
    );

  const hasCriticalRisk =
    hasRiskSeverity(
      risks,
      RiskSeverity.Critical,
    );

  const hasHighRisk =
    hasRiskSeverity(
      risks,
      RiskSeverity.High,
    );

  if (
    hasCriticalRisk ||
    overallScore <
      policy.waitMinimumScore
  ) {
    return {
      recommendation:
        AcquisitionRecommendation.Pass,
      confidence,
    };
  }

  if (isLowConfidence(confidence)) {
    return {
      recommendation:
        AcquisitionRecommendation.Wait,
      confidence,
    };
  }

  if (
    overallScore >=
      policy.strongBuyMinimumScore &&
    riskExposure <=
      policy
        .strongBuyMaximumRiskExposure &&
    !hasHighRisk &&
    positiveEvidenceCount >=
      policy
        .strongBuyMinimumPositiveEvidence &&
    (
      confidence ===
        ConfidenceLevel.High ||
      confidence ===
        ConfidenceLevel.VeryHigh
    )
  ) {
    return {
      recommendation:
        AcquisitionRecommendation.StrongBuy,
      confidence,
    };
  }

  if (
    overallScore >=
      policy.buyMinimumScore &&
    riskExposure <=
      policy.buyMaximumRiskExposure &&
    !hasHighRisk &&
    positiveEvidenceCount >=
      policy.buyMinimumPositiveEvidence
  ) {
    return {
      recommendation:
        AcquisitionRecommendation.Buy,
      confidence,
    };
  }

  if (
    overallScore >=
      policy
        .buyWithConditionsMinimumScore &&
    riskExposure <=
      policy
        .buyWithConditionsMaximumRiskExposure
  ) {
    return {
      recommendation:
        AcquisitionRecommendation
          .BuyWithConditions,
      confidence,
    };
  }

  return {
    recommendation:
      AcquisitionRecommendation.Wait,
    confidence,
  };
}

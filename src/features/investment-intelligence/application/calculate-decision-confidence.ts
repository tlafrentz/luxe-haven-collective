import {
  ConfidenceLevel,
} from "../domain";

import type {
  Percentage,
  SupportingEvidence,
} from "../domain";

import {
  assertPercentage,
} from "./calculation-guards";

export type CalculateDecisionConfidenceInput = {
  readonly revenueConfidence: Percentage;
  readonly comparableConfidence: ConfidenceLevel;
  readonly supportingEvidence: readonly SupportingEvidence[];
};

function confidenceLevelToScore(
  confidence: ConfidenceLevel,
): number {
  switch (confidence) {
    case ConfidenceLevel.VeryHigh:
      return 100;

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

function scoreToConfidenceLevel(
  score: number,
): ConfidenceLevel {
  if (score >= 90) {
    return ConfidenceLevel.VeryHigh;
  }

  if (score >= 75) {
    return ConfidenceLevel.High;
  }

  if (score >= 60) {
    return ConfidenceLevel.Moderate;
  }

  if (score >= 40) {
    return ConfidenceLevel.Low;
  }

  return ConfidenceLevel.VeryLow;
}

export function calculateDecisionConfidence({
  revenueConfidence,
  comparableConfidence,
  supportingEvidence,
}: CalculateDecisionConfidenceInput): ConfidenceLevel {
  assertPercentage(
    revenueConfidence,
    "Revenue confidence",
  );

  const comparableConfidenceScore =
    confidenceLevelToScore(
      comparableConfidence,
    );

  const evidenceConfidenceScore =
    supportingEvidence.length === 0
      ? comparableConfidenceScore
      : supportingEvidence.reduce(
          (total, evidence) =>
            total +
            confidenceLevelToScore(
              evidence.confidence,
            ),
          0,
        ) / supportingEvidence.length;

  const combinedConfidenceScore =
    revenueConfidence.value * 0.4 +
    comparableConfidenceScore * 0.4 +
    evidenceConfidenceScore * 0.2;

  return scoreToConfidenceLevel(
    combinedConfidenceScore,
  );
}

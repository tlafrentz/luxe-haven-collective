import {
  ObservationBuilder,
  type AnyObservation,
} from "@/platform/observations";

import type {
  InvestmentDecision,
} from "../../domain/investment-decision";

import type {
  InvestmentScore,
} from "../../domain/entities/investment-score";

import {
  INVESTMENT_OBSERVATION_SOURCE,
  INVESTMENT_SCORE_UNIT,
  createInvestmentObservationSubject,
} from "../types/investment-observation-shared";

import {
  INVESTMENT_OBSERVATION_TYPES,
  type InvestmentObservationType,
} from "../types/investment-observation-types";

export function mapInvestmentScore(
  score: InvestmentScore,
  decision: InvestmentDecision,
  recordedAt: Date,
): readonly AnyObservation[] {
  const subject =
    createInvestmentObservationSubject(
      decision,
    );

  return [
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .score.overall,
      label: "Overall investment score",
      value: score.overall.value,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .score.revenuePotential,
      label: "Revenue potential score",
      value: score.revenuePotential.value,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .score.financialStrength,
      label: "Financial strength score",
      value: score.financialStrength.value,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .score.marketStrength,
      label: "Market strength score",
      value: score.marketStrength.value,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .score.competitivePosition,
      label: "Competitive position score",
      value: score.competitivePosition.value,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .score.riskExposure,
      label: "Risk exposure score",
      value: score.riskExposure.value,
    }),
  ];

  function build({
    type,
    label,
    value,
  }: {
    type: InvestmentObservationType;
    label: string;
    value: number;
  }): AnyObservation {
    return ObservationBuilder.create()
      .withType(type)
      .concerning(subject)
      .withLabel(label)
      .withValue(value)
      .fromSource(
        INVESTMENT_OBSERVATION_SOURCE,
      )
      .observedAt(recordedAt)
      .recordedAt(recordedAt)
      .measuredIn(INVESTMENT_SCORE_UNIT)
      .withProvenance({
        retrievedAt: recordedAt,
        effectiveAt: recordedAt,
        notes:
          "Mapped from the Investment Intelligence scorecard.",
      })
      .build();
  }
}
